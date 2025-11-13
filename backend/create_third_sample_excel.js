#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');

// Third sample with completely different users and scenarios
const thirdSampleData = [
    // User 1: Jennifer Park - Marketing Director
    {
        email: 'jennifer.park@digitalagency.com',
        first_name: 'Jennifer',
        last_name: 'Park',
        phone: '555-8001',
        transaction_type: 'deposit',
        amount: 18500,
        transaction_date: '2024-01-10',
        description: 'Campaign success bonus'
    },
    {
        email: 'jennifer.park@digitalagency.com',
        transaction_type: 'deposit',
        amount: 7500,
        transaction_date: '2024-02-25',
        description: 'Client retention bonus'
    },
    {
        email: 'jennifer.park@digitalagency.com',
        transaction_type: 'withdrawal',
        amount: 6000,
        transaction_date: '2024-03-18',
        description: 'Professional development courses'
    },
    
    // User 2: Marcus Johnson - Financial Planner
    {
        email: 'marcus.johnson@wealthstrategies.com',
        first_name: 'Marcus',
        last_name: 'Johnson',
        phone: '555-8002',
        transaction_type: 'deposit',
        amount: 32000,
        transaction_date: '2024-01-14',
        description: 'Annual commission payout'
    },
    {
        email: 'marcus.johnson@wealthstrategies.com',
        transaction_type: 'withdrawal',
        amount: 9500,
        transaction_date: '2024-02-12',
        description: 'Investment in new practice'
    },
    {
        email: 'marcus.johnson@wealthstrategies.com',
        transaction_type: 'deposit',
        amount: 14000,
        transaction_date: '2024-03-28',
        description: 'Q1 performance bonus'
    },
    
    // User 3: Elena Vasquez - Architect
    {
        email: 'elena.vasquez@designstudio.com',
        first_name: 'Elena',
        last_name: 'Vasquez',
        transaction_type: 'deposit',
        amount: 27000,
        transaction_date: '2024-01-22',
        description: 'Commercial project completion'
    },
    {
        email: 'elena.vasquez@designstudio.com',
        transaction_type: 'deposit',
        amount: 15500,
        transaction_date: '2024-03-05',
        description: 'Residential design fees'
    },
    {
        email: 'elena.vasquez@designstudio.com',
        transaction_type: 'withdrawal',
        amount: 8000,
        transaction_date: '2024-04-10',
        description: 'CAD software and equipment'
    },
    
    // User 4: Thomas Lee - Manufacturing Executive
    {
        email: 'thomas.lee@industrialcorp.com',
        first_name: 'Thomas',
        last_name: 'Lee',
        phone: '555-8004',
        transaction_type: 'deposit',
        amount: 45000,
        transaction_date: '2024-01-08',
        description: 'Executive bonus'
    },
    {
        email: 'thomas.lee@industrialcorp.com',
        transaction_type: 'deposit',
        amount: 22000,
        transaction_date: '2024-02-20',
        description: 'Patent licensing income'
    },
    {
        email: 'thomas.lee@industrialcorp.com',
        transaction_type: 'withdrawal',
        amount: 12000,
        transaction_date: '2024-03-22',
        description: 'Manufacturing equipment investment'
    },
    
    // User 5: Rachel Green - Consultant
    {
        email: 'rachel.green@strategyconsulting.com',
        first_name: 'Rachel',
        last_name: 'Green',
        phone: '555-8005',
        transaction_type: 'deposit',
        amount: 16000,
        transaction_date: '2024-01-28',
        description: 'Client project payment'
    },
    {
        email: 'rachel.green@strategyconsulting.com',
        transaction_type: 'deposit',
        amount: 11000,
        transaction_date: '2024-02-15',
        description: 'Workshop facilitation fees'
    },
    {
        email: 'rachel.green@strategyconsulting.com',
        transaction_type: 'deposit',
        amount: 8500,
        transaction_date: '2024-03-30',
        description: 'Retainer fee quarterly'
    },
    {
        email: 'rachel.green@strategyconsulting.com',
        transaction_type: 'withdrawal',
        amount: 5000,
        transaction_date: '2024-04-08',
        description: 'Business travel and conferences'
    },
    
    // User 6: Daniel Wong - Sports Agent
    {
        email: 'daniel.wong@athletemanagement.com',
        first_name: 'Daniel',
        last_name: 'Wong',
        phone: '555-8006',
        transaction_type: 'deposit',
        amount: 38000,
        transaction_date: '2024-01-16',
        description: 'Contract negotiation commission'
    },
    {
        email: 'daniel.wong@athletemanagement.com',
        transaction_type: 'deposit',
        amount: 19500,
        transaction_date: '2024-02-28',
        description: 'Endorsement deal commission'
    },
    {
        email: 'daniel.wong@athletemanagement.com',
        transaction_type: 'withdrawal',
        amount: 11000,
        transaction_date: '2024-04-02',
        description: 'Client event and promotion'
    },
    
    // User 7: Nicole Taylor - E-commerce Owner
    {
        email: 'nicole.taylor@onlineboutique.com',
        first_name: 'Nicole',
        last_name: 'Taylor',
        transaction_type: 'deposit',
        amount: 13500,
        transaction_date: '2024-02-05',
        description: 'Black Friday sales profits'
    },
    {
        email: 'nicole.taylor@onlineboutique.com',
        transaction_type: 'deposit',
        amount: 9800,
        transaction_date: '2024-02-18',
        description: 'Valentine\'s Day campaign'
    },
    {
        email: 'nicole.taylor@onlineboutique.com',
        transaction_type: 'deposit',
        amount: 11200,
        transaction_date: '2024-03-25',
        description: 'Spring collection launch'
    },
    {
        email: 'nicole.taylor@onlineboutique.com',
        transaction_type: 'withdrawal',
        amount: 7500,
        transaction_date: '2024-04-12',
        description: 'Inventory and marketing investment'
    },
    
    // User 8: Victor Petrov - Energy Consultant
    {
        email: 'victor.petrov@renewableenergy.com',
        first_name: 'Victor',
        last_name: 'Petrov',
        phone: '555-8008',
        transaction_type: 'deposit',
        amount: 29000,
        transaction_date: '2024-01-20',
        description: 'Solar project consultation'
    },
    {
        email: 'victor.petrov@renewableenergy.com',
        transaction_type: 'deposit',
        amount: 16500,
        transaction_date: '2024-03-12',
        description: 'Wind farm feasibility study'
    },
    {
        email: 'victor.petrov@renewableenergy.com',
        transaction_type: 'withdrawal',
        amount: 8200,
        transaction_date: '2024-04-06',
        description: 'Research equipment and travel'
    }
];

console.log('Creating third sample Excel file with new professionals...');

// Create worksheet from JSON data
const worksheet = XLSX.utils.json_to_sheet(thirdSampleData);

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
const fileName = 'third_sample_transaction_import.xlsx';
const filePath = path.join(__dirname, fileName);

XLSX.writeFile(workbook, filePath);

console.log(`✅ Third sample Excel file created: ${filePath}`);
console.log('');
console.log('📊 File contains:');
console.log(`   • ${thirdSampleData.length} transactions`);
console.log('   • 8 unique professionals');
console.log('   • Diverse industry backgrounds');
console.log('   • Realistic business transactions');
console.log('   • Date range: Jan-Apr 2024');
console.log('');
console.log('👥 Professional Users:');
console.log('   • Jennifer Park - Marketing Director ($20,000 net)');
console.log('   • Marcus Johnson - Financial Planner ($36,500 net)');
console.log('   • Elena Vasquez - Architect ($34,500 net)');
console.log('   • Thomas Lee - Manufacturing Executive ($55,000 net)');
console.log('   • Rachel Green - Strategy Consultant ($30,500 net)');
console.log('   • Daniel Wong - Sports Agent ($46,500 net)');
console.log('   • Nicole Taylor - E-commerce Owner ($27,000 net)');
console.log('   • Victor Petrov - Energy Consultant ($37,300 net)');
console.log('');
console.log('💼 Industries Represented:');
console.log('   • Digital Marketing & Advertising');
console.log('   • Financial Planning & Wealth Management');
console.log('   • Architecture & Design');
console.log('   • Manufacturing & Industrial');
console.log('   • Strategy Consulting');
console.log('   • Sports & Entertainment');
console.log('   • E-commerce & Retail');
console.log('   • Renewable Energy');
console.log('');
console.log('🚀 Ready for transaction import testing!');