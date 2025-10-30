-- Base schema for Esoteric Loans Platform
BEGIN;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requires_2fa BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    account_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    verified_by_admin INTEGER REFERENCES users(id),
    temp_password BOOLEAN DEFAULT FALSE
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_2fa_complete BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT
);

-- User 2FA table
CREATE TABLE IF NOT EXISTS user_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(255) NOT NULL,
    backup_codes TEXT[],
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    qr_code_shown_at TIMESTAMP
);

-- Loan accounts table
CREATE TABLE IF NOT EXISTS loan_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interest_rate DECIMAL(5,4),
    term_months INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan transactions table
CREATE TABLE IF NOT EXISTS loan_transactions (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment schedule table
CREATE TABLE IF NOT EXISTS payment_schedule (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount_due DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;