// Add sample document directly to database for DocuSign testing
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addSampleDocument() {
    try {
        console.log('🔍 Adding sample document for DocuSign testing...\n');
        
        // Copy the demo PDF to uploads folder with a proper name
        const sourcePath = '/Users/williamwang/Esoteric/docusign-demo/demo_documents/World_Wide_Corp_lorem.pdf';
        const timestamp = Date.now();
        const randomId = Math.floor(Math.random() * 1000000000);
        const fileName = `document-${timestamp}-${randomId}.pdf`;
        const destPath = `/Users/williamwang/Esoteric/backend/uploads/${fileName}`;
        
        // Copy the file
        fs.copyFileSync(sourcePath, destPath);
        console.log('📄 Copied PDF file to uploads folder');
        
        // Get the demo user ID (assuming the demo user exists)
        const userResult = await pool.query(
            "SELECT id FROM users WHERE email = 'demo@esoteric.com' LIMIT 1"
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ Demo user not found. Please create a demo user first.');
            return;
        }
        
        const userId = userResult.rows[0].id;
        console.log('👤 Found demo user:', userId);
        
        // Insert the document into the database
        const result = await pool.query(`
            INSERT INTO documents (
                user_id, 
                title, 
                category, 
                file_path, 
                file_size, 
                upload_date
            ) VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `, [
            userId,
            'Sample Loan Agreement.pdf',
            'loan_agreement', 
            destPath,
            fs.statSync(destPath).size,
            new Date()
        ]);
        
        console.log('✅ Sample document added successfully!');
        console.log('📋 Document details:');
        console.log('   ID:', result.rows[0].id);
        console.log('   Title:', result.rows[0].title);
        console.log('   Category:', result.rows[0].category);
        console.log('   File path:', result.rows[0].file_path);
        
        console.log('\n🎉 You should now see a "Send for Signature" button on this document!');
        console.log('🌐 Refresh your browser at http://localhost:3000 and go to Document Center');
        
    } catch (error) {
        console.error('❌ Error adding sample document:', error.message);
    } finally {
        await pool.end();
    }
}

addSampleDocument();