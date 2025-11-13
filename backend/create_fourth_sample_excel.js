#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');

// Fourth sample with completely different users and scenarios
const fourthSampleData = [
    // User 1: Patricia Williams - Legal Partner
    {
        email: 'patricia.williams@lawfirm.com',
        first_name: 'Patricia',
        last_name: 'Williams',
        phone: '555-9001',
        transaction_type: 'deposit',
        amount: 55000,
        transaction_date: '2024-01-03',
        description: 'Partnership profit distribution'
    },
    {
        email: 'patricia.williams@lawfirm.com',
        transaction_type: 'deposit',
        amount: 28000,
        transaction_date: '2024-02-14',
        description: 'Class action settlement fees'
    },
    {
        email: 'patricia.williams@lawfirm.com',
        transaction_type: 'withdrawal',
        amount: 15000,
        transaction_date: '2024-03-25',
        description: 'Office expansion and legal research tools'
    },
    
    // User 2: Antonio Garcia - Restaurant Chain Owner
    {
        email: 'antonio.garcia@tacochainfranchise.com',
        first_name: 'Antonio',
        last_name: 'Garcia',
        phone: '555-9002',
        transaction_type: 'deposit',
        amount: 42000,
        transaction_date: '2024-01-11',
        description: 'Multi-location franchise revenue'
    },
    {
        email: 'antonio.garcia@tacochainfranchise.com',
        transaction_type: 'deposit',
        amount: 31000,
        transaction_date: '2024-02-08',
        description: 'Catering contract payments'
    },
    {
        email: 'antonio.garcia@tacochainfranchise.com',
        transaction_type: 'withdrawal',
        amount: 18000,
        transaction_date: '2024-03-15',
        description: 'New location equipment and setup'
    },
    
    // User 3: Dr. Benjamin Carter - Veterinarian
    {
        email: 'benjamin.carter@animalclinic.com',
        first_name: 'Dr. Benjamin',
        last_name: 'Carter',
        transaction_type: 'deposit',
        amount: 24000,
        transaction_date: '2024-01-18',
        description: 'Veterinary practice quarterly income'
    },
    {
        email: 'benjamin.carter@animalclinic.com',
        transaction_type: 'deposit',
        amount: 19500,
        transaction_date: '2024-02-22',
        description: 'Emergency surgery fees'
    },
    {
        email: 'benjamin.carter@animalclinic.com',
        transaction_type: 'withdrawal',
        amount: 12000,
        transaction_date: '2024-04-05',
        description: 'Advanced diagnostic equipment purchase'
    },
    
    // User 4: Samantha Reed - Fashion Designer
    {
        email: 'samantha.reed@couturestudio.com',
        first_name: 'Samantha',
        last_name: 'Reed',
        phone: '555-9004',
        transaction_type: 'deposit',
        amount: 35000,
        transaction_date: '2024-01-25',
        description: 'Fashion week collection sales'
    },
    {
        email: 'samantha.reed@couturestudio.com',
        transaction_type: 'deposit',
        amount: 18500,
        transaction_date: '2024-03-02',
        description: 'Celebrity styling commission'
    },
    {
        email: 'samantha.reed@couturestudio.com',
        transaction_type: 'withdrawal',
        amount: 11000,
        transaction_date: '2024-04-18',
        description: 'Fabric sourcing and studio rent'
    },
    
    // User 5: Gregory Davis - Aerospace Engineer
    {
        email: 'gregory.davis@aerospacetech.com',
        first_name: 'Gregory',
        last_name: 'Davis',
        phone: '555-9005',
        transaction_type: 'deposit',
        amount: 48000,
        transaction_date: '2024-01-30',
        description: 'Defense contract milestone payment'
    },
    {
        email: 'gregory.davis@aerospacetech.com',
        transaction_type: 'deposit',
        amount: 22000,
        transaction_date: '2024-03-10',
        description: 'Patent licensing revenue'
    },
    {
        email: 'gregory.davis@aerospacetech.com',
        transaction_type: 'withdrawal',
        amount: 14000,
        transaction_date: '2024-04-20',
        description: 'Research lab equipment upgrade'
    },
    
    // User 6: Melissa Zhang - Investment Banker
    {
        email: 'melissa.zhang@investmentbank.com',
        first_name: 'Melissa',
        last_name: 'Zhang',
        transaction_type: 'deposit',
        amount: 75000,
        transaction_date: '2024-02-01',
        description: 'M&A transaction bonus'
    },
    {
        email: 'melissa.zhang@investmentbank.com',
        transaction_type: 'deposit',
        amount: 38000,
        transaction_date: '2024-03-18',
        description: 'IPO underwriting commission'
    },
    {
        email: 'melissa.zhang@investmentbank.com',
        transaction_type: 'withdrawal',
        amount: 25000,
        transaction_date: '2024-04-22',
        description: 'Professional certifications and executive MBA'
    },
    
    // User 7: Christopher Moore - Video Game Developer
    {
        email: 'christopher.moore@gamestudio.com',
        first_name: 'Christopher',
        last_name: 'Moore',
        phone: '555-9007',
        transaction_type: 'deposit',
        amount: 26000,
        transaction_date: '2024-02-05',
        description: 'Mobile game revenue share'
    },
    {
        email: 'christopher.moore@gamestudio.com',
        transaction_type: 'deposit',
        amount: 32000,
        transaction_date: '2024-03-12',
        description: 'Console game royalties'
    },
    {
        email: 'christopher.moore@gamestudio.com',
        transaction_type: 'withdrawal',
        amount: 16000,
        transaction_date: '2024-04-25',
        description: 'Development hardware and software licenses'
    },
    
    // User 8: Diana Lopez - International Trade Specialist
    {
        email: 'diana.lopez@globaltrade.com',
        first_name: 'Diana',
        last_name: 'Lopez',
        phone: '555-9008',
        transaction_type: 'deposit',
        amount: 39000,
        transaction_date: '2024-01-12',
        description: 'Import/export facilitation fees'
    },
    {
        email: 'diana.lopez@globaltrade.com',
        transaction_type: 'deposit',
        amount: 27500,
        transaction_date: '2024-02-28',
        description: 'Customs brokerage commissions'
    },
    {
        email: 'diana.lopez@globaltrade.com',
        transaction_type: 'withdrawal',
        amount: 13500,
        transaction_date: '2024-04-15',
        description: 'International business travel and logistics'
    },
    
    // User 9: Ryan O\'Sullivan - Craft Brewery Owner
    {
        email: 'ryan.osullivan@craftbrewery.com',
        first_name: 'Ryan',
        last_name: 'O\'Sullivan',
        transaction_type: 'deposit',
        amount: 21000,
        transaction_date: '2024-02-10',
        description: 'Seasonal beer sales'
    },
    {
        email: 'ryan.osullivan@craftbrewery.com',
        transaction_type: 'deposit',
        amount: 16500,
        transaction_date: '2024-03-20',
        description: 'Taproom and event revenue'
    },
    {
        email: 'ryan.osullivan@craftbrewery.com',
        transaction_type: 'withdrawal',
        amount: 9000,
        transaction_date: '2024-04-28',
        description: 'Brewing equipment maintenance and ingredients'
    },
    
    // User 10: Angela Kim - Pharmaceutical Researcher
    {
        email: 'angela.kim@pharmaresearch.com',
        first_name: 'Dr. Angela',
        last_name: 'Kim',
        phone: '555-9010',
        transaction_type: 'deposit',
        amount: 52000,
        transaction_date: '2024-01-15',
        description: 'Clinical trial completion bonus'
    },
    {
        email: 'angela.kim@pharmaresearch.com',
        transaction_type: 'deposit',
        amount: 29000,
        transaction_date: '2024-03-08',
        description: 'Research publication royalties'
    },
    {
        email: 'angela.kim@pharmaresearch.com',
        transaction_type: 'withdrawal',
        amount: 17000,
        transaction_date: '2024-04-30',
        description: 'Laboratory equipment and conference attendance'
    }
];

console.log('Creating fourth sample Excel file with high-earning professionals...');

// Create worksheet from JSON data
const worksheet = XLSX.utils.json_to_sheet(fourthSampleData);

// Create workbook and add the worksheet
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

// Set column widths for better readability
const columnWidths = [
    { wch: 40 }, // email
    { wch: 18 }, // first_name
    { wch: 15 }, // last_name
    { wch: 15 }, // phone
    { wch: 15 }, // transaction_type
    { wch: 12 }, // amount
    { wch: 15 }, // transaction_date
    { wch: 40 }  // description
];
worksheet['!cols'] = columnWidths;

// Write the file
const fileName = 'fourth_sample_transaction_import.xlsx';
const filePath = path.join(__dirname, fileName);

XLSX.writeFile(workbook, filePath);

console.log(`✅ Fourth sample Excel file created: ${filePath}`);
console.log('');
console.log('📊 File contains:');
console.log(`   • ${fourthSampleData.length} transactions`);
console.log('   • 10 unique high-earning professionals');
console.log('   • Premium business and professional services');
console.log('   • High-value transactions ($9K - $75K range)');
console.log('   • Date range: Jan-Apr 2024');
console.log('');
console.log('👥 High-Earning Professionals:');
console.log('   • Patricia Williams - Legal Partner ($68,000 net)');
console.log('   • Antonio Garcia - Restaurant Chain Owner ($55,000 net)');
console.log('   • Dr. Benjamin Carter - Veterinarian ($31,500 net)');
console.log('   • Samantha Reed - Fashion Designer ($42,500 net)');
console.log('   • Gregory Davis - Aerospace Engineer ($56,000 net)');
console.log('   • Melissa Zhang - Investment Banker ($88,000 net)');
console.log('   • Christopher Moore - Game Developer ($42,000 net)');
console.log('   • Diana Lopez - Trade Specialist ($53,000 net)');
console.log('   • Ryan O\'Sullivan - Craft Brewery Owner ($28,500 net)');
console.log('   • Dr. Angela Kim - Pharmaceutical Researcher ($64,000 net)');
console.log('');
console.log('🏆 Premium Industries:');
console.log('   • Legal Services & Law');
console.log('   • Food Service & Hospitality');
console.log('   • Veterinary Medicine');
console.log('   • Fashion & Design');
console.log('   • Aerospace & Defense');
console.log('   • Investment Banking & Finance');
console.log('   • Gaming & Entertainment Technology');
console.log('   • International Trade & Logistics');
console.log('   • Craft Beverage Manufacturing');
console.log('   • Pharmaceutical Research & Development');
console.log('');
console.log('💰 Total Portfolio Value: $528,500 net across all users');
console.log('🚀 Ready for high-value transaction testing!');