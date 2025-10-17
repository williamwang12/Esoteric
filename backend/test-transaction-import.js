// Create a test Excel file for transaction import
const XLSX = require('xlsx');
const path = require('path');

// Create test transaction data
const transactionData = [
  {
    email: 'demo@esoteric.com',
    amount: 1000.00,
    transaction_type: 'monthly_payment',
    transaction_date: '2024-01-15',
    bonus_percentage: 0.01,
    description: 'Monthly payment with 1% bonus',
    reference_id: 'MP-2024-001'
  },
  {
    email: 'demo@esoteric.com',
    amount: 500.00,
    transaction_type: 'bonus',
    transaction_date: '2024-01-20',
    bonus_percentage: 0.005,
    description: 'Performance bonus payment',
    reference_id: 'BONUS-2024-001'
  },
  {
    email: 'demo@esoteric.com',
    amount: 200.00,
    transaction_type: 'withdrawal',
    transaction_date: '2024-01-25',
    bonus_percentage: '',
    description: 'Withdrawal request',
    reference_id: 'WD-2024-001'
  }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(transactionData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

// Write the Excel file
const excelPath = path.join(__dirname, 'test_transactions.xlsx');
XLSX.writeFile(wb, excelPath);

console.log('✅ Created test transaction Excel file:', excelPath);
console.log('📄 Transaction data:');
transactionData.forEach((transaction, index) => {
  console.log(`  ${index + 1}. ${transaction.email} - ${transaction.transaction_type} - $${transaction.amount}`);
});