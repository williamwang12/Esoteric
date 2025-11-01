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
    is_enabled BOOLEAN DEFAULT FALSE,
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
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    category VARCHAR(100),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    docusign_envelope_id VARCHAR(255),
    docusign_status VARCHAR(50)
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

-- User 2FA attempts table for security tracking
CREATE TABLE IF NOT EXISTS user_2fa_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    success BOOLEAN NOT NULL,
    token_used VARCHAR(10),
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT
);

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    urgency VARCHAR(20),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    completed_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meeting requests table
CREATE TABLE IF NOT EXISTS meeting_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preferred_date DATE,
    preferred_time TIME,
    purpose TEXT,
    meeting_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    meeting_link TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account verification requests table
CREATE TABLE IF NOT EXISTS account_verification_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255),
    business_type VARCHAR(100),
    additional_info TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Yield deposits table
CREATE TABLE IF NOT EXISTS yield_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    principal_amount DECIMAL(15,2) NOT NULL,
    annual_rate DECIMAL(5,4) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    total_paid DECIMAL(15,2) DEFAULT 0.00,
    last_payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Yield payouts table
CREATE TABLE IF NOT EXISTS yield_payouts (
    id SERIAL PRIMARY KEY,
    deposit_id INTEGER REFERENCES yield_deposits(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    payout_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly balances table for tracking balance history
CREATE TABLE IF NOT EXISTS monthly_balances (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    starting_balance DECIMAL(15,2) NOT NULL,
    ending_balance DECIMAL(15,2) NOT NULL,
    total_deposits DECIMAL(15,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(15,2) DEFAULT 0.00,
    monthly_rate DECIMAL(5,4),
    yield_earned DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(loan_account_id, year, month)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_user_id ON user_2fa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_ip ON user_2fa_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_user_id ON meeting_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON account_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON account_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_yield_deposits_user_id ON yield_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_yield_deposits_status ON yield_deposits(status);
CREATE INDEX IF NOT EXISTS idx_yield_payouts_deposit_id ON yield_payouts(deposit_id);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_account_id ON monthly_balances(loan_account_id);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_date ON monthly_balances(year, month);

COMMIT;