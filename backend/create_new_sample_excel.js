#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');

// New sample transaction data with different users and scenarios
const newSampleData = [
    // User 1: Michael Rodriguez - Tech Entrepreneur
    {
        email: 'michael.rodriguez@techstartup.com',
        first_name: 'Michael',
        last_name: 'Rodriguez',
        phone: '555-7001',
        transaction_type: 'deposit',
        amount: 15000,
        transaction_date: '2024-01-08',
        description: 'Series A investment proceeds'
    },
    {
        email: 'michael.rodriguez@techstartup.com',
        transaction_type: 'deposit',
        amount: 8000,
        transaction_date: '2024-02-15',
        description: 'Q1 bonus deposit'
    },
    {
        email: 'michael.rodriguez@techstartup.com',
        transaction_type: 'withdrawal',
        amount: 5000,
        transaction_date: '2024-03-20',
        description: 'Office equipment purchase'
    },
    
    // User 2: Sarah Chen - Investment Advisor
    {
        email: 'sarah.chen@wealthmanagement.com',
        first_name: 'Sarah',
        last_name: 'Chen',
        phone: '555-7002',
        transaction_type: 'deposit',
        amount: 25000,
        transaction_date: '2024-01-12',
        description: 'Portfolio diversification'
    },
    {
        email: 'sarah.chen@wealthmanagement.com',
        transaction_type: 'deposit',
        amount: 12000,
        transaction_date: '2024-02-28',
        description: 'Client referral bonus'
    },
    
    // User 3: James Thompson - Retired Military
    {
        email: 'james.thompson@veterans.org',
        first_name: 'James',
        last_name: 'Thompson',
        phone: '555-7003',
        transaction_type: 'deposit',
        amount: 30000,
        transaction_date: '2024-01-05',
        description: 'Military pension lump sum'
    },
    {
        email: 'james.thompson@veterans.org',
        transaction_type: 'withdrawal',
        amount: 8000,
        transaction_date: '2024-02-10',
        description: 'Home renovation project'
    },
    {
        email: 'james.thompson@veterans.org',
        transaction_type: 'deposit',
        amount: 5000,
        transaction_date: '2024-03-01',
        description: 'Tax refund deposit'
    },
    
    // User 4: Lisa Wang - Real Estate Developer
    {
        email: 'lisa.wang@propertydevelopment.com',
        first_name: 'Lisa',
        last_name: 'Wang',
        transaction_type: 'deposit',
        amount: 50000,
        transaction_date: '2024-01-18',
        description: 'Property sale proceeds'
    },
    {
        email: 'lisa.wang@propertydevelopment.com',
        transaction_type: 'deposit',
        amount: 20000,
        transaction_date: '2024-02-22',
        description: 'Rental income reinvestment'
    },
    {
        email: 'lisa.wang@propertydevelopment.com',
        transaction_type: 'withdrawal',
        amount: 15000,
        transaction_date: '2024-04-05',
        description: 'New property down payment'
    },
    
    // User 5: Robert Kim - Small Business Owner
    {
        email: 'robert.kim@localrestaurant.com',
        first_name: 'Robert',
        last_name: 'Kim',
        phone: '555-7005',
        transaction_type: 'deposit',
        amount: 8000,
        transaction_date: '2024-01-25',
        description: 'Restaurant expansion savings'
    },
    {
        email: 'robert.kim@localrestaurant.com',
        transaction_type: 'deposit',
        amount: 6000,
        transaction_date: '2024-02-18',
        description: 'Holiday season profits'
    },
    {
        email: 'robert.kim@localrestaurant.com',
        transaction_type: 'deposit',
        amount: 4000,
        transaction_date: '2024-03-12',
        description: 'Catering contract payment'
    },
    {
        email: 'robert.kim@localrestaurant.com',
        transaction_type: 'withdrawal',
        amount: 3000,
        transaction_date: '2024-04-08',
        description: 'Kitchen equipment upgrade'
    },
    
    // User 6: Dr. Amanda Foster - Medical Professional
    {
        email: 'amanda.foster@medicalcenter.com',
        first_name: 'Dr. Amanda',
        last_name: 'Foster',
        phone: '555-7006',
        transaction_type: 'deposit',
        amount: 22000,
        transaction_date: '2024-01-30',
        description: 'Medical practice income'
    },
    {
        email: 'amanda.foster@medicalcenter.com',
        transaction_type: 'deposit',
        amount: 18000,
        transaction_date: '2024-03-15',
        description: 'Specialist consultation fees'
    },
    {
        email: 'amanda.foster@medicalcenter.com',
        transaction_type: 'withdrawal',
        amount: 7000,
        transaction_date: '2024-04-12',
        description: 'Medical equipment purchase'
    },
    
    // User 7: Kevin Martinez - Software Engineer
    {
        email: 'kevin.martinez@softwarecompany.com',
        first_name: 'Kevin',
        last_name: 'Martinez',
        phone: '555-7007',
        transaction_type: 'deposit',
        amount: 12000,
        transaction_date: '2024-02-05',
        description: 'Stock option exercise'
    },
    {
        email: 'kevin.martinez@softwarecompany.com',
        transaction_type: 'deposit',
        amount: 9000,
        transaction_date: '2024-03-08',
        description: 'Performance bonus'
    },
    {
        email: 'kevin.martinez@softwarecompany.com',
        transaction_type: 'withdrawal',
        amount: 4000,
        transaction_date: '2024-04-15',
        description: 'Conference and training expenses'
    }
];

console.log('Creating new sample Excel file with different users...');

// Create worksheet from JSON data
const worksheet = XLSX.utils.json_to_sheet(newSampleData);

// Create workbook and add the worksheet
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

// Set column widths for better readability
const columnWidths = [
    { wch: 35 }, // email
    { wch: 15 }, // first_name
    { wch: 15 }, // last_name
    { wch: 15 }, // phone
    { wch: 15 }, // transaction_type
    { wch: 12 }, // amount
    { wch: 15 }, // transaction_date
    { wch: 35 }  // description
];
worksheet['!cols'] = columnWidths;

// Write the file
const fileName = 'new_sample_transaction_import.xlsx';
const filePath = path.join(__dirname, fileName);

XLSX.writeFile(workbook, filePath);

console.log(`✅ New sample Excel file created: ${filePath}`);
console.log('');
console.log('📊 File contains:');
console.log(`   • ${newSampleData.length} transactions`);
console.log('   • 7 unique users with diverse backgrounds');
console.log('   • Mix of deposits and withdrawals');
console.log('   • Professional transaction descriptions');
console.log('   • Date range: Jan-Apr 2024');
console.log('');
console.log('👥 New Users:');
console.log('   • Michael Rodriguez - Tech Entrepreneur ($18,000 net)');
console.log('   • Sarah Chen - Investment Advisor ($37,000 net)');
console.log('   • James Thompson - Retired Military ($27,000 net)');
console.log('   • Lisa Wang - Real Estate Developer ($55,000 net)');
console.log('   • Robert Kim - Small Business Owner ($15,000 net)');
console.log('   • Dr. Amanda Foster - Medical Professional ($33,000 net)');
console.log('   • Kevin Martinez - Software Engineer ($17,000 net)');
console.log('');
console.log('💡 This file demonstrates:');
console.log('   • Diverse professional backgrounds');
console.log('   • Realistic transaction amounts and descriptions');
console.log('   • Business-related deposits and withdrawals');
console.log('   • Proper chronological date ordering');
console.log('   • Professional email formats');
console.log('');
console.log('🚀 Ready to upload via the Transaction Import tab!');