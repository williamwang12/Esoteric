// Database setup for tests
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create test database and tables
async function setupTestDatabase() {
  // First connect to postgres database to create test database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default postgres database
  });

  try {
    // Drop test database if it exists and create fresh one
    await adminPool.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    console.log(`✅ Test database ${process.env.DB_NAME} created`);
  } catch (error) {
    console.log(`ℹ️  Database ${process.env.DB_NAME} setup: ${error.message}`);
  } finally {
    await adminPool.end();
  }

  // Now connect to the test database and set up tables
  const testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME
  });

  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await testPool.query(schema);
      console.log('✅ Test database schema created');
    }

    // Run migrations
    const migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const migrationPath = path.join(migrationsDir, file);
        const migration = fs.readFileSync(migrationPath, 'utf8');
        await testPool.query(migration);
        console.log(`✅ Migration ${file} applied`);
      }
    }

    // Create test users
    await createTestUsers(testPool);

  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    throw error;
  } finally {
    await testPool.end();
  }
}

async function createTestUsers(pool) {
  const bcrypt = require('bcryptjs');
  
  // Create demo user
  const demoPasswordHash = await bcrypt.hash('demo123456', 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role) 
     VALUES ($1, $2, $3, $4, $5) 
     ON CONFLICT (email) DO NOTHING`,
    ['demo@esoteric.com', demoPasswordHash, 'Demo', 'User', 'user']
  );

  // Create admin user  
  const adminPasswordHash = await bcrypt.hash('admin123456', 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role) 
     VALUES ($1, $2, $3, $4, $5) 
     ON CONFLICT (email) DO NOTHING`,
    ['admin@esoteric.com', adminPasswordHash, 'Admin', 'User', 'admin']
  );

  console.log('✅ Test users created');
}

// Clean up test database
async function cleanupTestDatabase() {
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres'
  });

  try {
    // Terminate connections to test database
    await adminPool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [process.env.DB_NAME]);

    // Drop test database
    await adminPool.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
    console.log(`✅ Test database ${process.env.DB_NAME} cleaned up`);
  } catch (error) {
    console.log(`ℹ️  Database cleanup: ${error.message}`);
  } finally {
    await adminPool.end();
  }
}

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase
};
