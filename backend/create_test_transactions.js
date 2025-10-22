const XLSX = require('xlsx');

// Generate comprehensive test data spanning 3-4 years
function generateTestTransactions() {
    const transactions = [];
    
    // Define test accounts
    const accounts = [
        { 
            email: 'alice@testcorp.com', 
            first_name: 'Alice', 
            last_name: 'Johnson', 
            phone: '555-100-0001',
            profile: 'conservative_investor' 
        },
        { 
            email: 'bob@techstartup.com', 
            first_name: 'Bob', 
            last_name: 'Smith', 
            phone: '555-100-0002',
            profile: 'active_trader' 
        },
        { 
            email: 'carol@consulting.net', 
            first_name: 'Carol', 
            last_name: 'Williams', 
            phone: '555-100-0003',
            profile: 'steady_depositor' 
        },
        { 
            email: 'david@investments.com', 
            first_name: 'David', 
            last_name: 'Brown', 
            phone: '555-100-0004',
            profile: 'large_investor' 
        },
        { 
            email: 'emma@freelance.org', 
            first_name: 'Emma', 
            last_name: 'Davis', 
            phone: '555-100-0005',
            profile: 'irregular_pattern' 
        }
    ];
    
    // Generate transactions from 2021-01-01 to 2024-10-21 (almost 4 years)
    const startDate = new Date('2021-01-01');
    const endDate = new Date('2024-10-21');
    
    accounts.forEach(account => {
        let currentDate = new Date(startDate);
        let accountBalance = 0;
        
        // Generate transactions based on account profile
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            switch (account.profile) {
                case 'conservative_investor':
                    // Large initial deposit, then steady monthly additions, occasional small withdrawals
                    if (currentDate.getTime() === startDate.getTime()) {
                        // Initial large deposit
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: 50000,
                            transaction_date: dateStr,
                            description: 'Initial investment',
                            first_name: account.first_name,
                            last_name: account.last_name,
                            phone: account.phone
                        });
                        accountBalance += 50000;
                    }
                    
                    // Monthly deposits of $2000-3000
                    if (currentDate.getDate() === 15) {
                        const amount = 2000 + Math.random() * 1000;
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: Math.round(amount),
                            transaction_date: dateStr,
                            description: 'Monthly investment',
                            first_name: '',
                            last_name: '',
                            phone: ''
                        });
                        accountBalance += amount;
                    }
                    
                    // Occasional small withdrawals (every 6 months)
                    if (currentDate.getMonth() % 6 === 0 && currentDate.getDate() === 28 && accountBalance > 5000) {
                        const withdrawAmount = Math.min(3000 + Math.random() * 2000, accountBalance * 0.1);
                        transactions.push({
                            email: account.email,
                            transaction_type: 'withdrawal',
                            amount: Math.round(withdrawAmount),
                            transaction_date: dateStr,
                            description: 'Conservative withdrawal',
                            first_name: '',
                            last_name: '',
                            phone: ''
                        });
                        accountBalance -= withdrawAmount;
                    }
                    break;
                    
                case 'active_trader':
                    // Multiple deposits and withdrawals throughout
                    if (currentDate.getTime() === startDate.getTime()) {
                        // Initial deposit
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: 25000,
                            transaction_date: dateStr,
                            description: 'Initial trading capital',
                            first_name: account.first_name,
                            last_name: account.last_name,
                            phone: account.phone
                        });
                        accountBalance += 25000;
                    }
                    
                    // Random deposits and withdrawals (2-3 per month)
                    if (Math.random() < 0.15) { // ~15% chance each day = 2-3 times per month
                        if (Math.random() < 0.6) { // 60% chance deposit
                            const amount = 1000 + Math.random() * 8000;
                            transactions.push({
                                email: account.email,
                                transaction_type: 'deposit',
                                amount: Math.round(amount),
                                transaction_date: dateStr,
                                description: 'Trading profits deposit',
                                first_name: '',
                                last_name: '',
                                phone: ''
                            });
                            accountBalance += amount;
                        } else if (accountBalance > 2000) { // 40% chance withdrawal
                            const withdrawAmount = Math.min(500 + Math.random() * 5000, accountBalance * 0.3);
                            transactions.push({
                                email: account.email,
                                transaction_type: 'withdrawal',
                                amount: Math.round(withdrawAmount),
                                transaction_date: dateStr,
                                description: 'Trading withdrawal',
                                first_name: '',
                                last_name: '',
                                phone: ''
                            });
                            accountBalance -= withdrawAmount;
                        }
                    }
                    break;
                    
                case 'steady_depositor':
                    // Regular deposits, rare withdrawals
                    if (currentDate.getTime() === startDate.getTime()) {
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: 15000,
                            transaction_date: dateStr,
                            description: 'Initial investment',
                            first_name: account.first_name,
                            last_name: account.last_name,
                            phone: account.phone
                        });
                        accountBalance += 15000;
                    }
                    
                    // Bi-weekly deposits
                    if (currentDate.getDate() === 1 || currentDate.getDate() === 15) {
                        const amount = 1500 + Math.random() * 500;
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: Math.round(amount),
                            transaction_date: dateStr,
                            description: 'Regular savings deposit',
                            first_name: '',
                            last_name: '',
                            phone: ''
                        });
                        accountBalance += amount;
                    }
                    
                    // Very rare withdrawals (once per year)
                    if (currentDate.getMonth() === 11 && currentDate.getDate() === 20 && accountBalance > 10000) {
                        const withdrawAmount = Math.min(5000, accountBalance * 0.08);
                        transactions.push({
                            email: account.email,
                            transaction_type: 'withdrawal',
                            amount: Math.round(withdrawAmount),
                            transaction_date: dateStr,
                            description: 'Year-end withdrawal',
                            first_name: '',
                            last_name: '',
                            phone: ''
                        });
                        accountBalance -= withdrawAmount;
                    }
                    break;
                    
                case 'large_investor':
                    // Large infrequent deposits, strategic withdrawals
                    if (currentDate.getTime() === startDate.getTime()) {
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: 100000,
                            transaction_date: dateStr,
                            description: 'Major investment',
                            first_name: account.first_name,
                            last_name: account.last_name,
                            phone: account.phone
                        });
                        accountBalance += 100000;
                    }
                    
                    // Quarterly large deposits
                    if (currentDate.getMonth() % 3 === 0 && currentDate.getDate() === 10) {
                        const amount = 15000 + Math.random() * 25000;
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: Math.round(amount),
                            transaction_date: dateStr,
                            description: 'Quarterly investment',
                            first_name: '',
                            last_name: '',
                            phone: ''
                        });
                        accountBalance += amount;
                    }
                    
                    // Strategic withdrawals (every 8 months)
                    if (currentDate.getMonth() % 8 === 0 && currentDate.getDate() === 25 && accountBalance > 20000) {
                        const withdrawAmount = Math.min(10000 + Math.random() * 15000, accountBalance * 0.15);
                        transactions.push({
                            email: account.email,
                            transaction_type: 'withdrawal',
                            amount: Math.round(withdrawAmount),
                            transaction_date: dateStr,
                            description: 'Strategic rebalancing',
                            first_name: '',
                            last_name: '',
                            phone: ''
                        });
                        accountBalance -= withdrawAmount;
                    }
                    break;
                    
                case 'irregular_pattern':
                    // Unpredictable pattern with varying amounts
                    if (currentDate.getTime() === startDate.getTime()) {
                        transactions.push({
                            email: account.email,
                            transaction_type: 'deposit',
                            amount: 8000,
                            transaction_date: dateStr,
                            description: 'Freelance startup capital',
                            first_name: account.first_name,
                            last_name: account.last_name,
                            phone: account.phone
                        });
                        accountBalance += 8000;
                    }
                    
                    // Irregular deposits (varying frequency)
                    const randomChance = Math.random();
                    if (randomChance < 0.05) { // 5% chance each day
                        if (Math.random() < 0.7) { // 70% chance deposit
                            const amount = 500 + Math.random() * 4000;
                            transactions.push({
                                email: account.email,
                                transaction_type: 'deposit',
                                amount: Math.round(amount),
                                transaction_date: dateStr,
                                description: 'Freelance project payment',
                                first_name: '',
                                last_name: '',
                                phone: ''
                            });
                            accountBalance += amount;
                        } else if (accountBalance > 1000) { // 30% chance withdrawal
                            const withdrawAmount = Math.min(200 + Math.random() * 2000, accountBalance * 0.4);
                            transactions.push({
                                email: account.email,
                                transaction_type: 'withdrawal',
                                amount: Math.round(withdrawAmount),
                                transaction_date: dateStr,
                                description: 'Expense withdrawal',
                                first_name: '',
                                last_name: '',
                                phone: ''
                            });
                            accountBalance -= withdrawAmount;
                        }
                    }
                    break;
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    // Sort transactions chronologically (as they should be processed)
    transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
    
    return transactions;
}

// Generate the test data
console.log('🏗️  Generating comprehensive test transaction data...');
const testTransactions = generateTestTransactions();

console.log(`📊 Generated ${testTransactions.length} transactions across ${new Set(testTransactions.map(t => t.email)).size} accounts`);
console.log(`📅 Date range: ${testTransactions[0].transaction_date} to ${testTransactions[testTransactions.length-1].transaction_date}`);

// Count transactions by type
const deposits = testTransactions.filter(t => t.transaction_type === 'deposit').length;
const withdrawals = testTransactions.filter(t => t.transaction_type === 'withdrawal').length;
console.log(`💰 Deposits: ${deposits}, Withdrawals: ${withdrawals}`);

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(testTransactions);

// Set column widths for better readability
ws['!cols'] = [
    { width: 30 }, // email
    { width: 15 }, // transaction_type
    { width: 15 }, // amount
    { width: 15 }, // transaction_date
    { width: 40 }, // description
    { width: 20 }, // first_name
    { width: 20 }, // last_name
    { width: 20 }  // phone
];

// Add the worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

// Write the file
const filename = 'comprehensive_test_transactions.xlsx';
XLSX.writeFile(wb, filename);

console.log(`✅ Test file created: ${filename}`);
console.log('\n📋 Transaction Summary by Account:');

// Show summary by account
const accountSummary = {};
testTransactions.forEach(transaction => {
    if (!accountSummary[transaction.email]) {
        accountSummary[transaction.email] = {
            deposits: 0,
            withdrawals: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            transactionCount: 0
        };
    }
    
    const summary = accountSummary[transaction.email];
    summary.transactionCount++;
    
    if (transaction.transaction_type === 'deposit') {
        summary.deposits++;
        summary.totalDeposited += transaction.amount;
    } else {
        summary.withdrawals++;
        summary.totalWithdrawn += transaction.amount;
    }
});

Object.entries(accountSummary).forEach(([email, summary]) => {
    const netAmount = summary.totalDeposited - summary.totalWithdrawn;
    console.log(`\n👤 ${email}:`);
    console.log(`   📈 ${summary.deposits} deposits totaling $${summary.totalDeposited.toLocaleString()}`);
    console.log(`   📉 ${summary.withdrawals} withdrawals totaling $${summary.totalWithdrawn.toLocaleString()}`);
    console.log(`   💵 Net amount: $${netAmount.toLocaleString()}`);
    console.log(`   📊 Total transactions: ${summary.transactionCount}`);
});