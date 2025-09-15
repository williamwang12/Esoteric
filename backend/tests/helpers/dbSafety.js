// Production database protection utilities
const { Pool } = require('pg');

// Production database protection
const PRODUCTION_DATABASES = [
  'esoteric_loans',
  'production',
  'prod',
  'live'
];

class SafeTestDatabase {
  constructor() {
    this.validateEnvironment();
    this.pool = new Pool({
      database: process.env.DB_NAME || 'esoteric_loans_test',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'williamwang',
      password: process.env.DB_PASSWORD || '',
    });
  }

  validateEnvironment() {
    // CRITICAL: Ensure we're in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database helper can only be used in test environment! Current NODE_ENV: ' + process.env.NODE_ENV);
    }
    
    // CRITICAL: Validate database name
    const dbName = process.env.DB_NAME || 'esoteric_loans_test';
    if (PRODUCTION_DATABASES.includes(dbName.toLowerCase())) {
      throw new Error(`DANGER: Attempted to use production database: ${dbName}`);
    }

    if (!dbName.includes('test')) {
      throw new Error(`Invalid test database name: ${dbName}. Must contain 'test'`);
    }

    console.log(`✅ Database safety validated - using: ${dbName}`);
  }

  async cleanDatabase() {
    // Safely clean test database only
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Clean in dependency order (child tables first)
      await client.query('TRUNCATE TABLE user_2fa CASCADE');
      await client.query('TRUNCATE TABLE user_2fa_attempts CASCADE');
      await client.query('TRUNCATE TABLE user_sessions CASCADE');
      await client.query('TRUNCATE TABLE documents CASCADE');
      await client.query('TRUNCATE TABLE loan_transactions CASCADE');
      await client.query('TRUNCATE TABLE payment_schedule CASCADE');
      await client.query('TRUNCATE TABLE withdrawal_requests CASCADE');
      await client.query('TRUNCATE TABLE meeting_requests CASCADE');
      await client.query('TRUNCATE TABLE account_verification_requests CASCADE');
      await client.query('TRUNCATE TABLE loan_accounts CASCADE');
      await client.query('TRUNCATE TABLE users CASCADE');
      
      // Reset sequences (check if they exist first)
      const sequences = [
        { table: 'users', column: 'id' },
        { table: 'documents', column: 'id' },
        { table: 'loan_accounts', column: 'id' },
        { table: 'loan_transactions', column: 'id' },
        { table: 'withdrawal_requests', column: 'id' },
        { table: 'meeting_requests', column: 'id' }
      ];

      for (const seq of sequences) {
        try {
          await client.query(`SELECT setval(pg_get_serial_sequence('${seq.table}', '${seq.column}'), 1, false)`);
        } catch (seqError) {
          // Ignore if sequence doesn't exist
          console.log(`⚠️ Sequence for ${seq.table}.${seq.column} not found, skipping`);
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ Test database cleaned successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to clean test database:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async seedTestData() {
    const client = await this.pool.connect();
    try {
      // Create test users
      const testUsers = [
        {
          email: 'test@example.com',
          password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewMuPcPz5p0dS5n2', // password: 'testpass123'
          first_name: 'Test',
          last_name: 'User',
          role: 'user'
        },
        {
          email: 'admin@example.com', 
          password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewMuPcPz5p0dS5n2', // password: 'testpass123'
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        }
      ];

      for (const user of testUsers) {
        await client.query(`
          INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, account_verified)
          VALUES ($1, $2, $3, $4, $5, true, true)
        `, [user.email, user.password_hash, user.first_name, user.last_name, user.role]);
      }

      console.log('✅ Test data seeded successfully');
    } catch (error) {
      console.error('❌ Failed to seed test data:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  getPool() {
    return this.pool;
  }
}

module.exports = SafeTestDatabase;