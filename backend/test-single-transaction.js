// Create a simple single transaction test file
const XLSX = require('xlsx');
const path = require('path');

// Create single transaction data
const transactionData = [
  {
    email: 'demo@esoteric.com',
    amount: 300.00,
    transaction_type: 'bonus',
    transaction_date: '2024-02-01',
    bonus_percentage: 0.02,
    description: 'Test bonus payment from frontend',
    reference_id: 'TEST-2024-001'
  }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(transactionData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

// Write the Excel file
const excelPath = path.join(__dirname, 'test_single_transaction.xlsx');
XLSX.writeFile(wb, excelPath);

console.log('✅ Created single transaction test file:', excelPath);
console.log('📄 Transaction data:', transactionData[0]);