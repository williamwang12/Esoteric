#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');

// Sample transaction data for testing
const sampleData = [
    // User 1: Alice Johnson - Multiple deposits and a withdrawal
    {
        email: 'alice.johnson@example.com',
        first_name: 'Alice',
        last_name: 'Johnson',
        phone: '555-0101',
        transaction_type: 'deposit',
        amount: 5000,
        transaction_date: '2024-01-15',
        description: 'Initial investment'
    },
    {
        email: 'alice.johnson@example.com',
        transaction_type: 'deposit',
        amount: 2500,
        transaction_date: '2024-02-01',
        description: 'Additional deposit'
    },
    {
        email: 'alice.johnson@example.com',
        transaction_type: 'withdrawal',
        amount: 1000,
        transaction_date: '2024-03-15',
        description: 'Partial withdrawal'
    },
    
    // User 2: Bob Smith - Large deposit followed by partial withdrawal
    {
        email: 'bob.smith@example.com',
        first_name: 'Bob',
        last_name: 'Smith',
        phone: '555-0202',
        transaction_type: 'deposit',
        amount: 10000,
        transaction_date: '2024-01-20',
        description: 'Business investment'
    },
    {
        email: 'bob.smith@example.com',
        transaction_type: 'withdrawal',
        amount: 2500,
        transaction_date: '2024-04-01',
        description: 'Emergency withdrawal'
    },
    
    // User 3: Carol Davis - Multiple small deposits
    {
        email: 'carol.davis@example.com',
        first_name: 'Carol',
        last_name: 'Davis',
        transaction_type: 'deposit',
        amount: 1000,
        transaction_date: '2024-01-10',
        description: 'Monthly savings'
    },
    {
        email: 'carol.davis@example.com',
        transaction_type: 'deposit',
        amount: 1000,
        transaction_date: '2024-02-10',
        description: 'Monthly savings'
    },
    {
        email: 'carol.davis@example.com',
        transaction_type: 'deposit',
        amount: 1000,
        transaction_date: '2024-03-10',
        description: 'Monthly savings'
    },
    
    // User 4: David Wilson - Only deposits (no phone number)
    {
        email: 'david.wilson@example.com',
        first_name: 'David',
        last_name: 'Wilson',
        transaction_type: 'deposit',
        amount: 7500,
        transaction_date: '2024-02-15',
        description: 'Retirement savings'
    },
    {
        email: 'david.wilson@example.com',
        transaction_type: 'deposit',
        amount: 2500,
        transaction_date: '2024-03-20',
        description: 'Additional investment'
    },
    
    // User 5: Emma Brown - Complex transaction history
    {
        email: 'emma.brown@example.com',
        first_name: 'Emma',
        last_name: 'Brown',
        phone: '555-0505',
        transaction_type: 'deposit',
        amount: 3000,
        transaction_date: '2024-01-05',
        description: 'Initial deposit'
    },
    {
        email: 'emma.brown@example.com',
        transaction_type: 'deposit',
        amount: 4000,
        transaction_date: '2024-01-25',
        description: 'Bonus deposit'
    },
    {
        email: 'emma.brown@example.com',
        transaction_type: 'withdrawal',
        amount: 1500,
        transaction_date: '2024-02-20',
        description: 'School expenses'
    },
    {
        email: 'emma.brown@example.com',
        transaction_type: 'deposit',
        amount: 2000,
        transaction_date: '2024-03-05',
        description: 'Tax refund'
    }
];

console.log('Creating sample Excel file for transaction import testing...');

// Create worksheet from JSON data
const worksheet = XLSX.utils.json_to_sheet(sampleData);

// Create workbook and add the worksheet
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

// Set column widths for better readability
const columnWidths = [
    { wch: 25 }, // email
    { wch: 12 }, // first_name
    { wch: 12 }, // last_name
    { wch: 15 }, // phone
    { wch: 15 }, // transaction_type
    { wch: 10 }, // amount
    { wch: 15 }, // transaction_date
    { wch: 25 }  // description
];
worksheet['!cols'] = columnWidths;

// Write the file
const fileName = 'sample_transaction_import.xlsx';
const filePath = path.join(__dirname, fileName);

XLSX.writeFile(workbook, filePath);

console.log(`✅ Sample Excel file created: ${filePath}`);
console.log('');
console.log('📊 File contains:');
console.log(`   • ${sampleData.length} transactions`);
console.log('   • 5 unique users');
console.log('   • Mix of deposits and withdrawals');
console.log('   • Chronological date spread (Jan-Apr 2024)');
console.log('');
console.log('💡 This file demonstrates:');
console.log('   • User creation with contact info');
console.log('   • Multiple transaction types');
console.log('   • LIFO withdrawal processing');
console.log('   • Chronological transaction ordering');
console.log('   • 12% annual yield deposit creation');
console.log('');
console.log('🚀 Ready to upload via the Transaction Import tab in admin dashboard!');