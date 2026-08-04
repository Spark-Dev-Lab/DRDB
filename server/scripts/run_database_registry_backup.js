const {
  backupDatabaseRegistryRecords,
} = require("../api/services/databaseRegistryBackupService");

async function run() {
  try {
    const result = await backupDatabaseRegistryRecords();

    console.log("Database registry backup completed successfully.");
    console.log(`Mode: ${result.mode}`);
    console.log(`Files written: ${result.fileCount}`);
    console.log(`Destination: ${result.rootDir}`);
  } catch (error) {
    console.error("Database registry backup failed:", error.message);
    process.exit(1);
  }
}

run();
