const { exec } = require("child_process");
const { existsSync, statSync } = require("fs");
require("dotenv").config();

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
};

const MIGRATION_FILE = "src/migrations/init.sql";

function validateConfig() {
  if (!DB_CONFIG.user || !DB_CONFIG.database) {
    console.error("❌ Missing DB_USER or DB_NAME in .env");
    process.exit(1);
  }
}

function createDatabase() {
  return new Promise((resolve, reject) => {
    console.log(`🏗️ Creating database ${DB_CONFIG.database}...`);

    const command = `createdb -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} ${DB_CONFIG.database}`;
    const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        if (error.message.includes("already exists")) {
          console.log("✅ Database already exists");
          resolve();
        } else {
          reject(error);
        }
      } else {
        console.log("✅ Database created");
        resolve();
      }
    });
  });
}

function testConnection() {
  console.log("🔍 Testing database connection...");

  const command = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -c "SELECT 1"`;
  const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

  exec(command, { env }, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Connection failed:", error.message);
      process.exit(1);
    }
    console.log("✅ Database connection successful");
  });
}

function showStatus() {
  console.log("📁 Migration file status:");

  if (existsSync(MIGRATION_FILE)) {
    const stats = statSync(MIGRATION_FILE);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`✅ ${MIGRATION_FILE} (${sizeKB}KB)`);
  } else {
    console.log(`❌ ${MIGRATION_FILE} not found`);
  }
}

async function runMigration() {
  if (!existsSync(MIGRATION_FILE)) {
    console.error("❌ Migration file not found:", MIGRATION_FILE);
    process.exit(1);
  }

  try {
    await createDatabase();
  } catch (error) {
    console.error("❌ Failed to create database:", error.message);
    process.exit(1);
  }

  console.log("🚀 Running migration...");

  const command = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -f ${MIGRATION_FILE}`;
  const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

  exec(command, { env }, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Migration failed:", error.message);
      process.exit(1);
    }

    if (stderr) {
      console.error("⚠️ Warning:", stderr);
    }

    console.log("✅ Migration completed");
  });
}

// Handle command line arguments
const command = process.argv[2] || "run";

validateConfig();

switch (command) {
  case "test":
    testConnection();
    break;
  case "status":
    showStatus();
    break;
  case "run":
  default:
    runMigration();
    break;
}
