const asyncHandler = require("express-async-handler");
const fs = require("fs");
const crypto = require("crypto");
const model = require("../models/DRDB");

const { google } = require("googleapis");
const { OAuth2 } = google.auth;

function resolveRedirectUri(req, redirectUris = []) {
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) return null;

  const normalize = (value) => (value || "").trim().replace(/\/$/, "");
  const toCallbackUri = (value) => {
    const normalized = normalize(value);
    return normalized ? `${normalized}/oauth/callback` : null;
  };
  const parseUrlSafe = (value) => {
    try {
      return new URL(value);
    } catch (error) {
      return null;
    }
  };
  const isLocalHostName = (hostname) =>
    hostname === "localhost" || hostname === "127.0.0.1";
  const isPrivateIpv4Host = (hostname) => {
    const parts = (hostname || "").split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      return false;
    }
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  };
  const isPrivateIpUri = (uri) => {
    const parsed = parseUrlSafe(uri);
    if (!parsed) return false;
    return isPrivateIpv4Host(parsed.hostname);
  };
  const parseOrigin = (value) => {
    const cleaned = normalize(value);
    if (!cleaned) return null;
    try {
      const parsed = new URL(cleaned);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
      return null;
    }
  };

  // 1) Explicit override for environments that require fixed OAuth redirect URI.
  const explicitRedirectUri = normalize(process.env.GOOGLE_REDIRECT_URI || "");
  if (explicitRedirectUri) {
    const exact = redirectUris.find((uri) => normalize(uri) === explicitRedirectUri);
    if (exact) return exact;
  }

  const normalizedAuthorizedMap = new Map(
    redirectUris.map((uri) => [normalize(uri), uri])
  );
  const localhostAuthorized = redirectUris.find((uri) => {
    const parsed = parseUrlSafe(uri);
    return parsed && isLocalHostName(parsed.hostname);
  });

  // Google can reject private-IP redirects with invalid_request. If localhost is
  // also authorized, prefer it consistently for both URL generation and token exchange.
  const preferLocalhostForPrivate = (uri) => {
    if (!uri) return uri;
    if (isPrivateIpUri(uri) && localhostAuthorized) return localhostAuthorized;
    return uri;
  };

  // 2) Stable environment-based selection so auth URL generation and token
  // exchange pick the same URI even if request host/origin differ.
  const envCandidates = [];
  const appUrlOrigin = parseOrigin(process.env.APP_URL);
  if (appUrlOrigin) envCandidates.push(toCallbackUri(appUrlOrigin));

  const frontendOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((value) => parseOrigin(value))
    .filter(Boolean);
  frontendOrigins.forEach((origin) => envCandidates.push(toCallbackUri(origin)));

  for (const candidate of envCandidates) {
    if (!candidate) continue;
    const resolved = normalizedAuthorizedMap.get(normalize(candidate));
    if (resolved) return preferLocalhostForPrivate(resolved);
  }

  const forwardedProto = (req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = (req.get("x-forwarded-host") || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host");
  const originHeader = parseOrigin(req.get("origin"));

  const originCandidates = [];
  if (originHeader) originCandidates.push(originHeader);
  if (host) originCandidates.push(`${proto}://${host}`);
  if (appUrlOrigin) originCandidates.push(appUrlOrigin);

  const candidates = [];
  originCandidates.forEach((origin) => {
    const normalizedOrigin = normalize(origin);
    candidates.push(`${normalizedOrigin}/oauth/callback`);
    candidates.push(`${normalizedOrigin}/oauth/callback/`);
  });

  const matched = candidates.find((uri) => redirectUris.includes(uri));
  if (matched) {
    return preferLocalhostForPrivate(matched);
  }

  const normalizedCandidateMatch = candidates.find((uri) =>
    normalizedAuthorizedMap.has(normalize(uri))
  );
  if (normalizedCandidateMatch) {
    const resolved = normalizedAuthorizedMap.get(normalize(normalizedCandidateMatch));
    return preferLocalhostForPrivate(resolved);
  }

  const publicFallback = redirectUris.find(
    (uri) => !/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(uri) && !isPrivateIpUri(uri)
  );

  const privateFallback = redirectUris.find((uri) => isPrivateIpUri(uri));

  return (
    preferLocalhostForPrivate(publicFallback) ||
    preferLocalhostForPrivate(privateFallback) ||
    localhostAuthorized ||
    redirectUris[0]
  );
}

async function resolveGmailAddress(gmailClient) {
  try {
    const sendAs = await gmailClient.users.settings.sendAs.list({ userId: "me" });
    const entries = sendAs?.data?.sendAs || [];
    const defaultEntry = entries.find((entry) => entry.isDefault) || entries[0];
    if (defaultEntry?.sendAsEmail) {
      return {
        email: defaultEntry.sendAsEmail,
        displayName: defaultEntry.displayName || null,
      };
    }
  } catch (error) {
    // Fall back to Gmail profile when sendAs endpoint is unavailable.
  }

  const profile = await gmailClient.users.getProfile({ userId: "me" });
  return {
    email: profile?.data?.emailAddress || null,
    displayName: null,
  };
}

exports.googleCredentialsURL = asyncHandler(async (req, res) => {
  try {
    const SCOPES = [
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.labels"
    ];

    const credentialsPath = "api/google/general/credentials.json";

    if (!fs.existsSync(credentialsPath)) {
      return res.status(404).send({
        message: "Google API credentials file is missing on the server. Please contact your administrator and ensure 'api/google/general/credentials.json' is present.",
      });
    }

    const credentials = fs.readFileSync(credentialsPath);
    const parsedCredentials = JSON.parse(credentials);
    const config = parsedCredentials.installed || parsedCredentials.web;
    const { client_secret, client_id, redirect_uris } = config;

    const valid_redirect_uri = resolveRedirectUri(req, redirect_uris);

    const oAuth2Client = new OAuth2(client_id, client_secret, valid_redirect_uri);

    // OAuth URLs are one-time and should never be cached.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: crypto.randomBytes(16).toString("hex"),
    });

    // check lab folder
    if (!fs.existsSync("api/google/labs")) {
      fs.mkdirSync("api/google/labs");
    }

    res.status(200).send(authUrl);
  } catch (error) {
    console.error("error in googleCredentialsURL:", error);
    return res.status(500).send({ 
      message: error.message || "Internal Server Error",
      details: "Ensure api/google/general/credentials.json is correct and contains valid JSON."
    });
  }
});

exports.googleToken = asyncHandler(async (req, res) => {
  try {
    const lab = req.body.lab || req.query.lab || req.userData?.lab;
    const code = req.body.signInCode || req.query.signInCode;

    if (!lab || !code) {
      return res.status(400).send({ message: "Missing lab id or sign-in code." });
    }

    const credentialsPath = "api/google/general/credentials.json";
    const tokenPath = "api/google/labs/lab" + lab + "/token.json";

    // check lab folder
    if (!fs.existsSync("api/google/labs")) {
      fs.mkdirSync("api/google/labs");
    }

    if (!fs.existsSync("api/google/labs/lab" + lab)) {
      fs.mkdirSync("api/google/labs/lab" + lab);
    }

    const credentials = fs.readFileSync(credentialsPath);
    const parsedCredentials = JSON.parse(credentials);
    const config = parsedCredentials.installed || parsedCredentials.web;
    const { client_secret, client_id, redirect_uris } = config;

    const valid_redirect_uri = resolveRedirectUri(req, redirect_uris);

    const oAuth2Client = new OAuth2(client_id, client_secret, valid_redirect_uri);

    var token = await oAuth2Client.getToken(code);

    let finalTokens = token.tokens;
    if (fs.existsSync(tokenPath)) {
      try {
        const oldToken = JSON.parse(fs.readFileSync(tokenPath));
        finalTokens = { ...oldToken, ...token.tokens };
      } catch (e) {
        console.error("Error parsing old token:", e);
      }
    }

    oAuth2Client.setCredentials(finalTokens);

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const resolved = await resolveGmailAddress(gmail);
    const labEmail = resolved.email;

    // update lab email info if found.
    if (labEmail) {
      await model.lab.update(
        { Email: labEmail },
        {
          where: { id: lab },
        }
      );
    }

    fs.writeFileSync(tokenPath, JSON.stringify(finalTokens));

    try {
      const SystemSettingModel = model.systemSetting || (model.sequelize && model.sequelize.models && model.sequelize.models.SystemSetting);
      if (SystemSettingModel) {
        await SystemSettingModel.update(
          { SettingValue: "false" },
          { where: { SettingKey: "isFirstRun" } }
        );
      }
    } catch (err) {
      console.error("Could not update isFirstRun setting:", err);
    }

    res.status(200).send({
      message: "Google account is successfully set up!",
      Email: labEmail,
    });
  } catch (error) {
    console.error("error in googleToken:", error);
    return res.status(500).send({ message: error.message || "Internal Server Error" });
  }
});

exports.adminToken = asyncHandler(async (req, res) => {
  if (req.body.signInCode) {
    var code = req.body.signInCode;
  } else {
    var code = req.query.signInCode;
  }

  try {
    const credentialsPath = "api/google/general/credentials.json";
    const tokenPath = "api/google/general/token.json";

    const credentials = fs.readFileSync(credentialsPath);
    const parsedCredentials = JSON.parse(credentials);
    const config = parsedCredentials.installed || parsedCredentials.web;
    const { client_secret, client_id, redirect_uris } = config;

    const valid_redirect_uri = resolveRedirectUri(req, redirect_uris);

    const oAuth2Client = new OAuth2(client_id, client_secret, valid_redirect_uri);

    var token = await oAuth2Client.getToken(code);

    let finalTokens = token.tokens;
    if (fs.existsSync(tokenPath)) {
      try {
        const oldToken = JSON.parse(fs.readFileSync(tokenPath));
        finalTokens = { ...oldToken, ...token.tokens };
      } catch (e) {
        console.error("Error parsing old admin token:", e);
      }
    }

    oAuth2Client.setCredentials(finalTokens);

    const adminGmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const resolved = await resolveGmailAddress(adminGmail);
    var adminEmail = resolved.email || null;

    fs.writeFileSync(tokenPath, JSON.stringify(finalTokens));

    res.status(200).send({
      message: "Admin account is successfully set up!",
      Email: adminEmail,
    });
  } catch (error) {
    console.error("error in adminToken:", error);
    return res.status(500).send({ message: error.message || "Internal Server Error" });
  }
});

exports.googleEmail = asyncHandler(async (req, res) => {
  const labId = req.body.lab || req.query.lab || req.userData?.lab;

  if (!labId) {
    return res.status(400).send({ message: "Missing lab id." });
  }

  let labEmail = null;
  let adminEmail = null;
  let labName = null;
  let adminEmailConfigured = false;
  let adminEmailFetchError = false;
  let labEmailFetchError = false;
  let profileError = null;

  // ── Lab email profile ─────────────────────────────────────────────
  try {
    const credentialsPath = "api/google/general/credentials.json";
    const tokenPath = "api/google/labs/lab" + labId + "/token.json";

    // Load credentials here — they are needed to build the OAuth2 client
    const credentials = fs.readFileSync(credentialsPath);
    const parsedCredentials = JSON.parse(credentials);
    const config = parsedCredentials.installed || parsedCredentials.web;
    const { client_secret, client_id, redirect_uris } = config;

    const valid_redirect_uri = resolveRedirectUri(req, redirect_uris);

    const oAuth2Client = new OAuth2(client_id, client_secret, valid_redirect_uri);

    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath);
      oAuth2Client.setCredentials(JSON.parse(token));

      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      const resolved = await resolveGmailAddress(gmail);
      labEmail = resolved.email;
      labName = resolved.displayName;

      if (labEmail) {
        await model.lab.update({ Email: labEmail }, {
          where: { id: labId },
        });
      }
    } else {
      labEmailFetchError = true;
      profileError =
        "Lab Google account is not connected for this lab. Please run Setup Google Account.";
    }

    // Fallback: If Gmail retrieval fails or token is missing, fetch from database to keep UI consistent
    if (!labEmail) {
      const currentLab = await model.lab.findByPk(labId);
      if (currentLab && currentLab.Email) {
        labEmail = currentLab.Email;
      }
    }

  } catch (error) {
    console.error("error in googleEmail lab profile:", error);
    labEmailFetchError = true;

    const detail =
      error?.response?.data?.error_description ||
      error?.response?.data?.error ||
      error?.message ||
      "unknown error";
    profileError =
      `Lab Google account token is invalid for this lab (${detail}). ` +
      "Please reconnect using Setup Google Account.";

    // Even on error, try to fetch from database to show current status
    const currentLab = await model.lab.findByPk(labId);
    if (currentLab && currentLab.Email) {
      labEmail = currentLab.Email;
    } else {
      labEmail = null;
    }
  }

  // admin profile
  try {
    const credentialsPath = "api/google/general/credentials.json";
    const tokenPath = "api/google/general/token.json";

    adminEmailConfigured = fs.existsSync(tokenPath);

    const credentials = fs.readFileSync(credentialsPath);
    const parsedCredentials = JSON.parse(credentials);
    const config = parsedCredentials.installed || parsedCredentials.web;
    const { client_secret, client_id, redirect_uris } = config;

    const valid_redirect_uri = resolveRedirectUri(req, redirect_uris);

    const oAuth2Client = new OAuth2(client_id, client_secret, valid_redirect_uri);

    if (adminEmailConfigured) {
      const token = fs.readFileSync(tokenPath);
      oAuth2Client.setCredentials(JSON.parse(token));

      const adminGmail = google.gmail({ version: "v1", auth: oAuth2Client });
      const resolved = await resolveGmailAddress(adminGmail);
      adminEmail = resolved.email || null;
      adminEmailFetchError = !adminEmail;
    }

  } catch (error) {
    // Keep adminEmail null on Gmail failures and report configuration state separately.
    adminEmailFetchError = adminEmailConfigured;
    console.error("error in googleEmail admin profile:", error);
  }

  res.status(200).send({
    labEmail: labEmail,
    adminEmail: adminEmail,
    labName: labName,
    error: profileError,
    labEmailFetchError: labEmailFetchError,
    adminEmailConfigured: adminEmailConfigured,
    adminEmailFetchError: adminEmailFetchError
  });
});
