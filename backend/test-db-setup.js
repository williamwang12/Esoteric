const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Create a fresh test database
const dbPath = path.join(__dirname, 'test.db');
const db = new sqlite3.Database(dbPath);

console.log('Setting up test database...');

db.serialize(async () => {
  // Drop existing tables
  db.run('DROP TABLE IF EXISTS documents');
  db.run('DROP TABLE IF EXISTS loan_transactions');
  db.run('DROP TABLE IF EXISTS loan_accounts');
  db.run('DROP TABLE IF EXISTS users');

  // Users table with is_admin column
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Loan accounts table
  db.run(`CREATE TABLE loan_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    account_number TEXT UNIQUE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    monthly_rate DECIMAL(5,4) DEFAULT 0.01,
    total_bonuses DECIMAL(15,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(15,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Loan transactions table
  db.run(`CREATE TABLE loan_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_account_id INTEGER,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type TEXT NOT NULL,
    bonus_percentage DECIMAL(5,4),
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_account_id) REFERENCES loan_accounts(id)
  )`);

  // Documents table
  db.run(`CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    category TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Insert test users with hashed passwords
  const demoPasswordHash = await bcrypt.hash('demo123456', 10);
  const adminPasswordHash = await bcrypt.hash('admin123456', 10);

  db.run(`INSERT INTO users (email, password_hash, first_name, last_name, phone, is_admin) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    ['demo@esoteric.com', demoPasswordHash, 'Demo', 'User', '+1234567890', 0]
  );

  db.run(`INSERT INTO users (email, password_hash, first_name, last_name, phone, is_admin) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    ['admin@esoteric.com', adminPasswordHash, 'Admin', 'User', '+1234567891', 1]
  );

  // Insert test loan account
  db.run(`INSERT INTO loan_accounts (user_id, account_number, principal_amount, current_balance, monthly_rate, total_bonuses) 
          VALUES (1, 'LOAN-001', 100000.00, 125000.00, 0.01, 5000.00)`);

  // Insert test transactions
  const testTransactions = [
    [1, 100000.00, 'loan', null, 'Initial loan amount', '2024-01-01'],
    [1, 1000.00, 'monthly_payment', 0.01, 'Monthly payment + 1% base rate', '2024-02-01'],
    [1, 500.00, 'bonus', 0.005, 'Performance bonus payment', '2024-02-15'],
    [1, 1000.00, 'monthly_payment', 0.01, 'Monthly payment + 1% base rate', '2024-03-01']
  ];

  const insertTransaction = db.prepare(`INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, bonus_percentage, description, transaction_date) VALUES (?, ?, ?, ?, ?, ?)`);
  testTransactions.forEach(transaction => insertTransaction.run(transaction));
  insertTransaction.finalize();

  console.log('Test database setup complete!');
});

db.close();