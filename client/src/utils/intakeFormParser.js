import moment from "moment";

// Column positions in the Oberlin Community Contact List intake form
const COL = {
  TIMESTAMP: 0,
  PRIMARY_FIRST: 1,
  PRIMARY_LAST: 2,
  EMAIL: 3,
  PHONE: 4,
  ADDRESS: 5,
  HAS_SECONDARY: 6,
  SECONDARY_FIRST: 7,
  SECONDARY_LAST: 8,
  SECONDARY_EMAIL: 9,
  SECONDARY_PHONE: 10,
  SECONDARY_ADDRESS: 11,
  SECONDARY_RELATIONSHIP: 12,
  // Child slots (3 built-in)
  CHILD1_FIRST: 13, CHILD1_LAST: 14, CHILD1_DOB: 15, CHILD1_SEX: 16, CHILD1_GENDER: 17,
  ADD_CHILD2: 18,
  CHILD2_FIRST: 19, CHILD2_LAST: 20, CHILD2_DOB: 21, CHILD2_SEX: 22, CHILD2_GENDER: 23,
  ADD_CHILD3: 24,
  CHILD3_FIRST: 25, CHILD3_LAST: 26, CHILD3_DOB: 27, CHILD3_SEX: 28, CHILD3_GENDER: 29,
  CONTACT_TIME: 31,
  CONTACT_METHOD: 32,
  LANGUAGE: 33,
  ENGLISH_PERCENT: 34,
  NOTES: 35,
  PRIMARY_DOB: 36,
  SECONDARY_DOB: 37,
  ZIP: 38,
  // Additional household member blocks from col 50 in groups of 4: rel, first, last, dob
  ADDITIONAL_HM_START: 50,
  ADDITIONAL_HM_END: 81,
  ADDITIONAL_HM_BLOCK2_REL: 97,
  ADDITIONAL_HM_BLOCK2_FIRST: 98,
  ADDITIONAL_HM_BLOCK2_LAST: 99,
  ADDITIONAL_HM_BLOCK2_DOB: 100,
  PREFERRED_CONTACT_NOTES: 104,
  ZIP2: 107,
};

const DATE_FORMATS = [
  "M/D/YYYY", "MM/DD/YYYY",
  "D/M/YYYY", "DD/MM/YYYY",
  "YYYY-MM-DD",
  "M/D/YY", "MM/DD/YY",
];

function parseDate(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  // Excel serial date number
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    const m = moment.utc(d);
    return m.isValid() ? m.format("YYYY-MM-DD") : null;
  }
  const str = String(raw).trim();
  if (!str) return null;
  for (const fmt of DATE_FORMATS) {
    const m = moment(str, fmt, true);
    if (m.isValid()) return m.format("YYYY-MM-DD");
  }
  // Lenient fallback
  const m = moment(str);
  return m.isValid() ? m.format("YYYY-MM-DD") : null;
}

function parsePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits || null;
}

function parseSex(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "male" || s === "m") return "M";
  if (s === "female" || s === "f") return "F";
  return null;
}

function col(row, i) {
  const v = row[i];
  return v !== undefined && v !== null && v !== "" ? v : null;
}

function fullName(first, last) {
  const parts = [String(first || "").trim(), String(last || "").trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function parseRow(row, dynamicCols = {}) {
  const namePrimary = fullName(col(row, COL.PRIMARY_FIRST), col(row, COL.PRIMARY_LAST));
  const email = String(col(row, COL.EMAIL) || "").trim() || null;
  const phone = parsePhone(col(row, COL.PHONE));
  const address = String(col(row, COL.ADDRESS) || "").trim() || null;
  const zip = col(row, COL.ZIP) || col(row, COL.ZIP2) || null;
  const fullAddress = [address, zip ? String(zip).trim() : null].filter(Boolean).join(", ") || null;
  const dobPrimary = parseDate(col(row, COL.PRIMARY_DOB));

  const hasSecondary = String(col(row, COL.HAS_SECONDARY) || "").toLowerCase().includes("yes");
  const nameSecondary = hasSecondary
    ? fullName(col(row, COL.SECONDARY_FIRST), col(row, COL.SECONDARY_LAST))
    : null;
  const dobSecondary = parseDate(col(row, COL.SECONDARY_DOB));

  const preferredContactTime = col(row, COL.CONTACT_TIME)
    ? String(col(row, COL.CONTACT_TIME)).trim()
    : null;
  const preferredContactMethods = col(row, COL.CONTACT_METHOD)
    ? String(col(row, COL.CONTACT_METHOD)).trim().split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const family = {
    NamePrimary: namePrimary,
    DoBPrimary: dobPrimary,
    Email: email,
    Phone: phone,
    Address: fullAddress,
    NameSecondary: nameSecondary,
    DoBSecondary: dobSecondary,
    LanguagePrimary: col(row, COL.LANGUAGE) ? String(col(row, COL.LANGUAGE)).trim() : null,
    EnglishPercent: col(row, COL.ENGLISH_PERCENT) ? parseInt(col(row, COL.ENGLISH_PERCENT)) || null : null,
    Note: col(row, COL.NOTES) ? String(col(row, COL.NOTES)).trim() : null,
    PreferredContactTime: preferredContactTime,
    PreferredContactMethods: preferredContactMethods.length > 0 ? JSON.stringify(preferredContactMethods) : null,
    PreferredContactNotes: col(row, COL.PREFERRED_CONTACT_NOTES)
      ? String(col(row, COL.PREFERRED_CONTACT_NOTES)).trim()
      : null,
    RecruitmentMethod: dynamicCols.recruitmentCol >= 0
      ? (col(row, dynamicCols.recruitmentCol) ? String(col(row, dynamicCols.recruitmentCol)).trim() : null)
      : null,
    BrochureSeen: dynamicCols.brochureSeenCol >= 0
      ? (col(row, dynamicCols.brochureSeenCol) ? String(col(row, dynamicCols.brochureSeenCol)).trim() : null)
      : null,
    BrochureLocation: dynamicCols.brochureLocationCol >= 0
      ? (col(row, dynamicCols.brochureLocationCol) ? String(col(row, dynamicCols.brochureLocationCol)).trim() : null)
      : null,
  };

  const children = [];

  // Three built-in child slots
  const childSlots = [
    { first: COL.CHILD1_FIRST, last: COL.CHILD1_LAST, dob: COL.CHILD1_DOB, sex: COL.CHILD1_SEX, gender: COL.CHILD1_GENDER },
    { first: COL.CHILD2_FIRST, last: COL.CHILD2_LAST, dob: COL.CHILD2_DOB, sex: COL.CHILD2_SEX, gender: COL.CHILD2_GENDER },
    { first: COL.CHILD3_FIRST, last: COL.CHILD3_LAST, dob: COL.CHILD3_DOB, sex: COL.CHILD3_SEX, gender: COL.CHILD3_GENDER },
  ];

  for (const slot of childSlots) {
    const name = fullName(col(row, slot.first), col(row, slot.last));
    const dob = parseDate(col(row, slot.dob));
    if (name || dob) {
      children.push({
        Name: name,
        DoB: dob,
        Sex: parseSex(col(row, slot.sex)),
        Gender: col(row, slot.gender) ? String(col(row, slot.gender)).trim() : null,
      });
    }
  }

  // Additional household members (groups of 4: relationship, first, last, dob)
  for (let base = COL.ADDITIONAL_HM_START; base + 3 <= COL.ADDITIONAL_HM_END; base += 4) {
    const name = fullName(col(row, base + 1), col(row, base + 2));
    const dob = parseDate(col(row, base + 3));
    const rel = col(row, base) ? String(col(row, base)).trim() : null;
    if ((name || dob) && name !== namePrimary && name !== nameSecondary) {
      children.push({
        Name: name,
        DoB: dob,
        Sex: null,
        Gender: null,
        Note: rel ? `Relationship to primary: ${rel}` : null,
      });
    }
  }

  // Late additional member block (cols 97-100)
  if (row.length > COL.ADDITIONAL_HM_BLOCK2_DOB) {
    const name = fullName(col(row, COL.ADDITIONAL_HM_BLOCK2_FIRST), col(row, COL.ADDITIONAL_HM_BLOCK2_LAST));
    const dob = parseDate(col(row, COL.ADDITIONAL_HM_BLOCK2_DOB));
    const rel = col(row, COL.ADDITIONAL_HM_BLOCK2_REL) ? String(col(row, COL.ADDITIONAL_HM_BLOCK2_REL)).trim() : null;
    if ((name || dob) && name !== namePrimary && name !== nameSecondary) {
      children.push({
        Name: name,
        DoB: dob,
        Sex: null,
        Gender: null,
        Note: rel ? `Relationship to primary: ${rel}` : null,
      });
    }
  }

  return { family, children };
}

/**
 * Detect if rows (header array) came from the Oberlin intake form.
 * Checks column 0 = "Timestamp" and col 3 = "Email".
 */
export function isIntakeForm(headers) {
  if (!headers || headers.length < 5) return false;
  const h0 = String(headers[0] || "").trim().toLowerCase();
  const h3 = String(headers[3] || "").trim().toLowerCase();
  return h0 === "timestamp" && h3 === "email";
}

/**
 * Parse rows (header:1 format — rows[0] = headers, rows[1+] = data)
 * into an array of { family, children } objects.
 */
export function parseIntakeFormRows(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());

  // Locate new columns by partial header match — resilient to column reordering
  const recruitmentCol = headers.findIndex((h) =>
    h.includes("how did you hear") || h.includes("where have you seen or heard") ||
    h.includes("where have you seen our") || h.includes("where have you heard") ||
    h.includes("how have you heard")
  );
  const brochureSeenCol = headers.findIndex((h) =>
    h.includes("have you seen any of our") || h.includes("have you seen our brochure") ||
    (h.includes("have you seen") && (h.includes("brochure") || h.includes("flyer")))
  );
  const brochureLocationCol = headers.findIndex((h) =>
    h.includes("where did you see or receive") || h.includes("where did you see") ||
    h.includes("where did you receive")
  );

  const dynamicCols = { recruitmentCol, brochureSeenCol, brochureLocationCol };

  return rows
    .slice(1)
    .filter((row) => row && row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) => parseRow(row, dynamicCols));
}
