# 🔐 Two-Factor Authentication (2FA) User Guide - Esoteric Enterprises

## Table of Contents

1. [Overview](#overview)
2. [Getting Your 2FA Code](#getting-your-2fa-code)
3. [Login Process](#login-process)
4. [Backup Codes](#backup-codes)
5. [Troubleshooting](#troubleshooting)
6. [Admin Commands](#admin-commands)

---

## Overview

Esoteric Enterprises uses Time-based One-Time Passwords (TOTP) for enhanced security. This guide explains how to get your 2FA codes and complete the login process.

**Current Users with 2FA:**

- `demo@esoteric.com` - ✅ 2FA Enabled (10 backup codes available)
- `newuser@example.com` - ❌ 2FA Disabled

---

## Getting Your 2FA Code

### Method 1: Using the Code Generator Script (Recommended)

```bash
# Navigate to the backend directory
cd /Users/williamwang/Esoteric/backend

# Generate a current 2FA code for your user
node generate-2fa-code.js demo@esoteric.com
```

**Example Output:**

```
🔐 2FA Code for Demo User (demo@esoteric.com)
📱 Current TOTP Code: 434815
⏰ Valid for: 10 seconds
🔑 Backup Codes Available: 10
📋 First 3 backup codes: 99EE3096, 9D062644, A33E4F69
```

### Method 2: Using an Authenticator App (Standard Method)

1. **Secret Key:** `KJMDW5CNKNFXUS2JFZUWS2Z6KMYCIZJXOZEWO4JEMZNXGZSDJZNA`
2. **Add to your authenticator app:**
   - Google Authenticator
   - Authy
   - Microsoft Authenticator
   - 1Password
3. **Service Name:** Esoteric Enterprises
4. **Account:** demo@esoteric.com

### Method 3: Using Backup Codes

If you can't access your authenticator app, use one of these backup codes:

```
99EE3096, 9D062644, A33E4F69, 9BAE0D51, A6D68575
749B8AE5, D1E750E1, 109A5E3C, 5885387C, A9FE53EC
```

⚠️ **Important:** Each backup code can only be used once!

---

## Login Process

### Step 1: Initial Login

```bash
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@esoteric.com", "password": "demo123456"}'
```

**Response:**

```json
{
  "message": "Password verified. 2FA required.",
  "requires_2fa": true,
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "demo@esoteric.com",
    "firstName": "Demo",
    "lastName": "User"
  }
}
```

### Step 2: Complete 2FA Login

```bash
# Get your current 2FA code first
node generate-2fa-code.js demo@esoteric.com

# Then complete the login (replace TOKEN with the 6-digit code)
curl -X POST http://localhost:5002/api/auth/complete-2fa-login \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "YOUR_SESSION_TOKEN_FROM_STEP_1",
    "totp_token": "434815"
  }'
```

**Success Response:**

```json
{
  "message": "Login completed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "demo@esoteric.com"
  }
}
```

### Step 3: Use the Full Token

Save the token from Step 2 and use it for all subsequent API calls:

```bash
curl -H "Authorization: Bearer YOUR_FULL_TOKEN" \
  http://localhost:5002/api/user/profile
```

---

## Backup Codes

### Viewing Available Backup Codes

```bash
# List all users and their backup code count
node generate-2fa-code.js --list

# Get backup codes for a specific user
psql -h localhost -p 5432 -U postgres -d esoteric_loans -c \
  "SELECT backup_codes FROM user_2fa WHERE user_id = (SELECT id FROM users WHERE email = 'demo@esoteric.com');"
```

### Using a Backup Code

Use a backup code exactly like a TOTP code in Step 2:

```bash
curl -X POST http://localhost:5002/api/auth/complete-2fa-login \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "YOUR_SESSION_TOKEN",
    "totp_token": "99EE3096"
  }'
```

### Regenerating Backup Codes

```bash
curl -X POST http://localhost:5002/api/2fa/generate-backup-codes \
  -H "Authorization: Bearer YOUR_FULL_TOKEN"
```

---

## Troubleshooting

### Problem: "Invalid credentials" on first login

**Solution:** Check your password. The demo user password is `demo123456`

### Problem: "Invalid or expired token" on 2FA step

**Solutions:**

1. **Token Expired:** TOTP codes are only valid for 30 seconds. Generate a new one.
2. **Wrong Code:** Double-check the 6-digit code from the generator script.
3. **Clock Skew:** Ensure your system clock is accurate.

### Problem: "Too many 2FA attempts"

**Solution:** Wait 15 minutes before trying again, or use a backup code.

### Problem: Server won't start

**Solutions:**

1. **Wrong Directory:** Make sure you're in `/Users/williamwang/Esoteric/backend`
2. **Port Conflict:** Try a different port: `PORT=5003 node server-2fa.js`
3. **Database Issues:** Check PostgreSQL is running: `pg_isready -h localhost -p 5432`

### Problem: No backup codes left

**Generate new ones:**

```bash
# Login with your last backup code, then:
curl -X POST http://localhost:5002/api/2fa/generate-backup-codes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Admin Commands

### Start the Server

```bash
# From project root
npm start

# Or manually from backend directory
cd backend && node server-2fa.js

# Or with custom port
cd backend && PORT=5002 node server-2fa.js
```

### Check Database Connection

```bash
psql -h localhost -p 5432 -U postgres -d esoteric_loans -c "SELECT NOW();"
```

### View 2FA Status for All Users

```bash
cd backend && node generate-2fa-code.js --list
```

### Disable 2FA for a User (Emergency)

```sql
-- Connect to database
psql -h localhost -p 5432 -U postgres -d esoteric_loans

-- Disable 2FA
UPDATE user_2fa SET is_enabled = false WHERE user_id = (
  SELECT id FROM users WHERE email = 'demo@esoteric.com'
);
```

### Enable 2FA for a User

```bash
# User must login first, then:
curl -X POST http://localhost:5002/api/2fa/setup \
  -H "Authorization: Bearer USER_TOKEN"
```

---

## Quick Reference

| Action       | Command                                       |
| ------------ | --------------------------------------------- |
| Get 2FA Code | `node generate-2fa-code.js demo@esoteric.com` |
| Start Server | `cd backend && PORT=5002 node server-2fa.js`  |
| List Users   | `node generate-2fa-code.js --list`            |
| Health Check | `curl http://localhost:5002/api/health`       |
| Frontend URL | `http://localhost:3000`                       |
| Backend URL  | `http://localhost:5002/api`                   |

---

## Security Notes

- 🔐 TOTP codes change every 30 seconds
- 🔑 Backup codes are single-use only
- ⏰ Session tokens expire after 10 minutes
- 🛡️ Full tokens expire after 24 hours
- 🚫 Rate limiting: 5 attempts per 15 minutes
- 💾 All 2FA attempts are logged for security

---

_Last updated: $(date)_
_For technical support, contact the development team._
