// Simple test to verify Excel upload behavior with replacement logic
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Create a test Excel file
function createTestExcel() {
  const testData = [
    {
      email: 'demo@esoteric.com',
      account_number: 'LOAN-123',
      current_balance: 10000.00,
      new_balance: 11000.00,
      notes: 'Test upload 1'
    },
    {
      email: 'demo@esoteric.com', 
      account_number: 'LOAN-456',
      current_balance: 15000.00,
      new_balance: 14500.00,
      notes: 'Test upload 2'
    }
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(testData);
  XLSX.utils.book_append_sheet(wb, ws, 'Loan Updates');

  const excelPath = path.join(__dirname, 'test_upload_replacement.xlsx');
  XLSX.writeFile(wb, excelPath);
  
  console.log('✅ Created test Excel file:', excelPath);
  console.log('📊 File contains 2 test updates');
  console.log('📋 You can now upload this file to test the replacement behavior');
  console.log('   - First upload should show 2 updates');
  console.log('   - Second upload should replace (not append) the updates');
}

createTestExcel();