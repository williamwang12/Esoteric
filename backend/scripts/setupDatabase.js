require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection for creating the database
const adminPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres', // Connect to default postgres database
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Database connection for the actual app database
const appPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'esoteric_loans',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
    try {
        console.log('🏗️  Setting up Esoteric Loans Database...');

        // Create database if it doesn't exist
        const dbName = process.env.DB_NAME || 'esoteric_loans';
        
        console.log(`📊 Creating database: ${dbName}`);
        try {
            await adminPool.query(`CREATE DATABASE "${dbName}"`);
            console.log(`✅ Database "${dbName}" created successfully`);
        } catch (error) {
            if (error.code === '42P04') {
                console.log(`ℹ️  Database "${dbName}" already exists`);
            } else {
                throw error;
            }
        }

        // Read and execute schema file
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at: ${schemaPath}`);
        }

        console.log('📋 Reading schema file...');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🛠️  Executing schema...');
        await appPool.query(schema);
        console.log('✅ Schema executed successfully');

        // Insert sample data (optional)
        console.log('📝 Inserting sample data...');
        await insertSampleData();

        console.log('🎉 Database setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        process.exit(1);
    } finally {
        await adminPool.end();
        await appPool.end();
    }
}

async function insertSampleData() {
    try {
        // Insert a demo user (optional for testing)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('demo123456', 12);
        
        await appPool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, phone) 
            VALUES ($1, $2, $3, $4, $5) 
            ON CONFLICT (email) DO NOTHING
        `, ['demo@esoteric.com', hashedPassword, 'Demo', 'User', '+1234567890']);

        console.log('✅ Sample data inserted');
        console.log('ℹ️  Demo user: demo@esoteric.com / demo123456');
        
    } catch (error) {
        console.log('⚠️  Sample data insertion failed:', error.message);
    }
}

// Run setup
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase }; 