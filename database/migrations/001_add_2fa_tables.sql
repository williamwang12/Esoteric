-- Migration: Add 2FA support tables
-- Created: 2025-08-04
-- Description: Adds two-factor authentication support with TOTP

-- Two-factor authentication secrets and settings
CREATE TABLE IF NOT EXISTS user_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[], -- Array of backup codes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    qr_code_shown_at TIMESTAMP
);

-- 2FA verification attempts (for rate limiting and security)
CREATE TABLE IF NOT EXISTS user_2fa_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    success BOOLEAN DEFAULT false,
    token_used VARCHAR(10),
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table with 2FA completion tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    is_2fa_complete BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add 2FA required flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS requires_2fa BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_user_id ON user_2fa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_attempted_at ON user_2fa_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);