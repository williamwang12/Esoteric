-- 12% Yield Deposits Feature - Database Schema
-- This file contains the database tables for the yield deposits system

-- Main yield deposits table
CREATE TABLE yield_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    principal_amount DECIMAL(15,2) NOT NULL CHECK (principal_amount > 0),
    annual_yield_rate DECIMAL(5,4) NOT NULL DEFAULT 0.12,
    start_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_payout_date DATE,
    total_paid_out DECIMAL(15,2) DEFAULT 0.00,
    created_by INTEGER REFERENCES users(id),
    notes TEXT
);

-- Yield payouts tracking table
CREATE TABLE yield_payouts (
    id SERIAL PRIMARY KEY,
    deposit_id INTEGER NOT NULL REFERENCES yield_deposits(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payout_date DATE NOT NULL,
    transaction_id INTEGER REFERENCES loan_transactions(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_by INTEGER REFERENCES users(id),
    notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_yield_deposits_user_id ON yield_deposits(user_id);
CREATE INDEX idx_yield_deposits_status ON yield_deposits(status);
CREATE INDEX idx_yield_deposits_start_date ON yield_deposits(start_date);
CREATE INDEX idx_yield_deposits_last_payout ON yield_deposits(last_payout_date);
CREATE INDEX idx_yield_payouts_deposit_id ON yield_payouts(deposit_id);
CREATE INDEX idx_yield_payouts_payout_date ON yield_payouts(payout_date);
CREATE INDEX idx_yield_payouts_transaction_id ON yield_payouts(transaction_id);

-- Add yield_payment to valid transaction types (if not already exists)
-- This will be handled in the backend validation