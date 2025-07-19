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

const MIGRATION_FILES = {
  init: "src/migrations/init.sql",
  products: "src/migrations/products.sql",
};

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
  console.log("📁 Migration files status:");

  Object.entries(MIGRATION_FILES).forEach(([name, filePath]) => {
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`✅ ${name}: ${filePath} (${sizeKB}KB)`);
    } else {
      console.log(`❌ ${name}: ${filePath} not found`);
    }
  });
}

function runSingleMigration(migrationFile, migrationName) {
  return new Promise((resolve, reject) => {
    if (!existsSync(migrationFile)) {
      reject(new Error(`Migration file not found: ${migrationFile}`));
      return;
    }

    console.log(`🚀 Running ${migrationName} migration...`);

    const command = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -f ${migrationFile}`;
    const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(`${migrationName} migration failed: ${error.message}`)
        );
        return;
      }

      if (stderr) {
        console.warn(`⚠️ Warning in ${migrationName}:`, stderr);
      }

      console.log(`✅ ${migrationName} migration completed`);
      resolve();
    });
  });
}

async function runMigration() {
  try {
    await createDatabase();

    console.log("\n🔄 Running all migrations in order...\n");

    // Run init migration first (authentication system)
    if (existsSync(MIGRATION_FILES.init)) {
      await runSingleMigration(MIGRATION_FILES.init, "Authentication System");
    } else {
      console.error(
        `❌ Required init migration not found: ${MIGRATION_FILES.init}`
      );
      process.exit(1);
    }

    // Run products migration second (if it exists)
    if (existsSync(MIGRATION_FILES.products)) {
      await runSingleMigration(MIGRATION_FILES.products, "Product Management");
    } else {
      console.warn(
        `⚠️ Products migration not found: ${MIGRATION_FILES.products}`
      );
      console.warn("   Product management features will not be available.");
    }

    console.log("\n🎉 All migrations completed successfully!");
    console.log("\n📊 System Status:");
    console.log("   ✓ Authentication & User Management");
    console.log("   ✓ Admin Onboarding System");
    console.log("   ✓ Account Management");

    if (existsSync(MIGRATION_FILES.products)) {
      console.log("   ✓ Product Management System");
      console.log("   ✓ Inventory Management");
      console.log("   ✓ Category Management");
      console.log("   ✓ Bulk Operations & Excel Import");
    }

    console.log("\n🚀 Ready to start your application!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

async function runSpecificMigration(migrationName) {
  try {
    await createDatabase();

    if (!MIGRATION_FILES[migrationName]) {
      console.error(`❌ Unknown migration: ${migrationName}`);
      console.log(
        "Available migrations:",
        Object.keys(MIGRATION_FILES).join(", ")
      );
      process.exit(1);
    }

    await runSingleMigration(MIGRATION_FILES[migrationName], migrationName);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
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
  case "init":
    runSpecificMigration("init");
    break;
  case "products":
    runSpecificMigration("products");
    break;
  case "run":
  default:
    runMigration();
    break;
}
