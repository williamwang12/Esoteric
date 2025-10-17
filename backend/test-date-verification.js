// Create a test transaction with a specific date to verify frontend displays correct date
const XLSX = require('xlsx');
const path = require('path');

// Create transaction with a very specific older date to make it obvious
const transactionData = [
  {
    email: 'demo@esoteric.com',
    amount: 150.00,
    transaction_type: 'bonus',
    transaction_date: '2023-07-15', // Specific old date to make it obvious
    bonus_percentage: 0.015,
    description: 'Date verification test - should show July 15, 2023',
    reference_id: 'DATE-TEST-001'
  }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(transactionData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

// Write the Excel file
const excelPath = path.join(__dirname, 'test_date_verification.xlsx');
XLSX.writeFile(wb, excelPath);

console.log('✅ Created date verification test file:', excelPath);
console.log('📄 Transaction should display date as: July 15, 2023');
console.log('📄 Transaction data:', transactionData[0]);