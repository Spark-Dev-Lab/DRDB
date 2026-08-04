const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const zlib = require("zlib");
const { pipeline } = require("stream");
const { promisify } = require("util");
const model = require("../models/DRDB");

const pipelineAsync = promisify(pipeline);

const DAY_MS = 24 * 60 * 60 * 1000;

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function nowStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return {
    date: `${yyyy}${mm}${dd}`,
    timestamp: `${yyyy}${mm}${dd}_${hh}${mi}${ss}`,
  };
}

function sanitizeFileName(name) {
  return String(name || "table").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getBackupMode() {
  const mode = String(process.env.DB_REGISTRY_BACKUP_MODE || "single")
    .trim()
    .toLowerCase();

  if (mode === "tables" || mode === "multi") {
    return "tables";
  }
  return "single";
}

function getBackupFrequency() {
  const frequency = String(process.env.DB_REGISTRY_BACKUP_FREQUENCY || "daily")
    .trim()
    .toLowerCase();

  if (frequency === "weekly") {
    return "weekly";
  }
  return "daily";
}

function getBackupCronExpression() {
  const explicitCron = (process.env.DB_REGISTRY_BACKUP_CRON || "").trim();
  if (explicitCron) {
    return explicitCron;
  }

  return getBackupFrequency() === "weekly" ? "30 2 * * 0" : "30 2 * * *";
}

function isDatabaseRegistryBackupEnabled() {
  return parseBoolean(process.env.DB_REGISTRY_BACKUP_ENABLED, true);
}

function getRetentionDays() {
  const value = Number(process.env.DB_REGISTRY_BACKUP_RETENTION_DAYS || 30);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 30;
}

function shouldCompressBackups() {
  return parseBoolean(process.env.DB_REGISTRY_BACKUP_COMPRESS, true);
}

function getBackupRootDir() {
  const configured = (process.env.DB_REGISTRY_BACKUP_DIR || "").trim();
  if (configured) {
    return configured;
  }

  return "/Volumes/T7/database_registry_record_backups";
}

function getDbConnectionConfig() {
  const sequelizeConfig = model?.sequelize?.config || {};

  const dbName = process.env.DB_NAME || sequelizeConfig.database;
  const dbUser = process.env.DB_USER || sequelizeConfig.username;
  const dbPass =
    process.env.DB_PASS !== undefined ? process.env.DB_PASS : sequelizeConfig.password;
  const dbHost = process.env.DB_HOST || sequelizeConfig.host || "localhost";
  const dbPort = Number(process.env.DB_PORT || sequelizeConfig.port || 3306);

  if (!dbName) {
    throw new Error("Database backup failed: DB_NAME is not configured.");
  }
  if (!dbUser) {
    throw new Error("Database backup failed: DB_USER is not configured.");
  }

  return {
    dbName,
    dbUser,
    dbPass: dbPass || "",
    dbHost,
    dbPort,
  };
}

function runMysqldump({ dbName, dbUser, dbPass, dbHost, dbPort, tableName, outputPath }) {
  return new Promise((resolve, reject) => {
    const args = [
      "--single-transaction",
      "--quick",
      "--skip-lock-tables",
      "--host",
      dbHost,
      "--port",
      String(dbPort),
      "--user",
      dbUser,
      dbName,
    ];

    if (tableName) {
      args.push(tableName);
    }

    const outputStream = fs.createWriteStream(outputPath, { encoding: "utf8" });
    const child = spawn("mysqldump", args, {
      env: {
        ...process.env,
        MYSQL_PWD: dbPass,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrBuffer = "";

    child.stdout.pipe(outputStream);
    child.stderr.on("data", (chunk) => {
      stderrBuffer += String(chunk);
    });

    child.on("error", (error) => {
      outputStream.close();
      if (error.code === "ENOENT") {
        reject(
          new Error(
            "mysqldump is not installed or not available in PATH. Install MySQL client tools on the server."
          )
        );
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      outputStream.close();

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `mysqldump exited with code ${code}${
            stderrBuffer ? `: ${stderrBuffer.trim()}` : ""
          }`
        )
      );
    });
  });
}

async function getTableNames() {
  const [rows] = await model.sequelize.query("SHOW TABLES");
  return rows
    .map((row) => {
      const values = Object.values(row || {});
      return values.length > 0 ? String(values[0]) : null;
    })
    .filter(Boolean);
}

async function compressSqlFile(filePath) {
  const gzipPath = `${filePath}.gz`;

  await pipelineAsync(
    fs.createReadStream(filePath),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
    fs.createWriteStream(gzipPath)
  );

  fs.unlinkSync(filePath);
  return gzipPath;
}

function cleanupOldEntries(rootDir, mode, retentionDays) {
  const cutoff = Date.now() - retentionDays * DAY_MS;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    const stats = fs.statSync(fullPath);

    if (stats.mtimeMs >= cutoff) {
      continue;
    }

    if (
      mode === "single" &&
      entry.isFile() &&
      (entry.name.endsWith(".sql") || entry.name.endsWith(".sql.gz"))
    ) {
      fs.unlinkSync(fullPath);
      continue;
    }

    if (mode === "tables" && entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

async function backupDatabaseRegistryRecords() {
  const mode = getBackupMode();
  const rootDir = getBackupRootDir();
  const retentionDays = getRetentionDays();
  const compressBackups = shouldCompressBackups();
  const stamp = nowStamp();

  fs.mkdirSync(rootDir, { recursive: true });

  const dbConfig = getDbConnectionConfig();
  const writtenFiles = [];

  if (mode === "single") {
    const fileName = `${sanitizeFileName(dbConfig.dbName)}_registry_backup_${stamp.timestamp}.sql`;
    const outputPath = path.join(rootDir, fileName);

    await runMysqldump({
      ...dbConfig,
      outputPath,
    });

    if (compressBackups) {
      writtenFiles.push(await compressSqlFile(outputPath));
    } else {
      writtenFiles.push(outputPath);
    }
  } else {
    const folderPath = path.join(rootDir, stamp.date);
    fs.mkdirSync(folderPath, { recursive: true });

    const tables = await getTableNames();
    for (const tableName of tables) {
      const outputPath = path.join(folderPath, `${sanitizeFileName(tableName)}.sql`);
      await runMysqldump({
        ...dbConfig,
        tableName,
        outputPath,
      });

      if (compressBackups) {
        writtenFiles.push(await compressSqlFile(outputPath));
      } else {
        writtenFiles.push(outputPath);
      }
    }
  }

  cleanupOldEntries(rootDir, mode, retentionDays);

  return {
    mode,
    rootDir,
    fileCount: writtenFiles.length,
    files: writtenFiles,
    timestamp: stamp.timestamp,
    compressed: compressBackups,
  };
}

module.exports = {
  backupDatabaseRegistryRecords,
  getBackupCronExpression,
  getBackupFrequency,
  getBackupMode,
  getBackupRootDir,
  getRetentionDays,
  shouldCompressBackups,
  isDatabaseRegistryBackupEnabled,
};
