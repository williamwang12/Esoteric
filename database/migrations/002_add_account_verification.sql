-- Migration: Add account verification system
-- Created: 2025-08-15
-- Description: Adds account verification status and request tracking

-- Add account verification status to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

-- Account verification requests table
CREATE TABLE IF NOT EXISTS account_verification_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_verification_requests_user_id ON account_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_verification_requests_status ON account_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_verification_requests_requested_at ON account_verification_requests(requested_at);