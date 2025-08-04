-- Esoteric Enterprises Loan Management Platform
-- Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan accounts table
CREATE TABLE loan_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    account_number VARCHAR(50) UNIQUE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    monthly_rate DECIMAL(5,4) DEFAULT 0.01,
    total_bonuses DECIMAL(15,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan transactions table
CREATE TABLE loan_transactions (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'loan', 'monthly_payment', 'bonus', 'withdrawal'
    bonus_percentage DECIMAL(5,4),
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    category VARCHAR(100) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Two-factor authentication
CREATE TABLE user_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    secret VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly payments schedule
CREATE TABLE payment_schedule (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id),
    payment_date DATE NOT NULL,
    base_amount DECIMAL(15,2) NOT NULL,
    bonus_amount DECIMAL(15,2) DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'processed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simple sessions tracking
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_loan_accounts_user_id ON loan_accounts(user_id);
CREATE INDEX idx_loan_transactions_account_id ON loan_transactions(loan_account_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_payment_schedule_account_id ON payment_schedule(loan_account_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id); 