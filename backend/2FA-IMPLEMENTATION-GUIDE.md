# 🔐 Two-Factor Authentication (2FA) Implementation Guide

## Overview

I've implemented a complete TOTP-based 2FA system for your Esoteric Enterprises backend. This provides enterprise-grade security with support for authenticator apps like Google Authenticator, Authy, and Microsoft Authenticator.

## 🚀 Features Implemented

### ✅ **Core 2FA Features**

- **TOTP Authentication** - Time-based One-Time Passwords
- **QR Code Generation** - Easy setup with authenticator apps
- **Backup Codes** - 10 single-use recovery codes
- **Rate Limiting** - Protection against brute force attacks
- **Session Management** - Enhanced JWT with 2FA completion tracking
- **Admin Controls** - Force 2FA for sensitive accounts

### ✅ **Security Features**

- **Multi-layer Authentication** - Password + TOTP + Session validation
- **Token Rotation** - Secure session management
- **Audit Logging** - Track all 2FA attempts
- **Time Window Tolerance** - Handles clock drift (±30 seconds)
- **Encrypted Storage** - Secure secret and backup code storage

## 📊 Database Schema

The following tables have been added to support 2FA:

```sql
-- 2FA secrets and settings
CREATE TABLE user_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    secret VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    qr_code_shown_at TIMESTAMP
);

-- 2FA verification attempts (security logging)
CREATE TABLE user_2fa_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    success BOOLEAN DEFAULT false,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced sessions with 2FA completion tracking
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    is_2fa_complete BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Added to users table
ALTER TABLE users ADD COLUMN requires_2fa BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
```

## 🛠️ API Endpoints

### Authentication Flow (Enhanced)

#### 1. **Login (First Step)**

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (No 2FA required):**

```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": { "id": 1, "email": "user@example.com" }
}
```

**Response (2FA required):**

```json
{
  "message": "Password verified. 2FA required.",
  "requires_2fa": true,
  "session_token": "temporary_session_token",
  "user": { "id": 1, "email": "user@example.com" }
}
```

#### 2. **Complete 2FA Login**

```bash
POST /api/auth/complete-2fa-login
Content-Type: application/json

{
  "session_token": "temporary_session_token",
  "totp_token": "123456"  // Or 8-character backup code
}
```

**Response:**

```json
{
  "message": "Login completed successfully",
  "token": "full_jwt_token",
  "user": { "id": 1, "email": "user@example.com" }
}
```

### 2FA Management

#### 3. **Setup 2FA**

```bash
POST /api/2fa/setup
Authorization: Bearer jwt_token
```

**Response:**

```json
{
  "message": "Scan the QR code with your authenticator app",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "manualEntryKey": "JBSWY3DPEHPK3PXP"
}
```

#### 4. **Verify Setup**

```bash
POST /api/2fa/verify-setup
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "token": "123456"
}
```

**Response:**

```json
{
  "message": "2FA has been successfully enabled",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", ...],
  "warning": "Store these backup codes safely."
}
```

#### 5. **Check 2FA Status**

```bash
GET /api/2fa/status
Authorization: Bearer jwt_token
```

**Response:**

```json
{
  "enabled": true,
  "setup_initiated": true,
  "last_used": "2025-08-04T10:30:00Z",
  "backup_codes_remaining": 8
}
```

#### 6. **Generate New Backup Codes**

```bash
POST /api/2fa/generate-backup-codes
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "token": "123456"
}
```

#### 7. **Disable 2FA**

```bash
POST /api/2fa/disable
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "token": "123456",
  "password": "user_password"
}
```

## 🔧 Integration Steps

### Step 1: Update Your Server

Replace your current server with the 2FA-enabled version:

```javascript
// Use server-2fa.js instead of server.js
const app = require("./server-2fa");
```

### Step 2: Update Frontend Login Flow

```typescript
// Enhanced login function
const login = async (email: string, password: string) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.requires_2fa) {
    // Show 2FA input form
    localStorage.setItem("temp_session", data.session_token);
    setShow2FAModal(true);
  } else {
    // Direct login successful
    localStorage.setItem("token", data.token);
    setUser(data.user);
  }
};

// Complete 2FA login
const complete2FA = async (totpToken: string) => {
  const sessionToken = localStorage.getItem("temp_session");

  const response = await fetch("/api/auth/complete-2fa-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_token: sessionToken,
      totp_token: totpToken,
    }),
  });

  const data = await response.json();

  if (response.ok) {
    localStorage.removeItem("temp_session");
    localStorage.setItem("token", data.token);
    setUser(data.user);
    setShow2FAModal(false);
  }
};
```

### Step 3: Add 2FA Setup Component

```tsx
const Setup2FA = () => {
  const [qrCode, setQrCode] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);

  const initiate2FASetup = async () => {
    const response = await fetch("/api/2fa/setup", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    setQrCode(data.qrCode);
    setManualKey(data.manualEntryKey);
  };

  const verify2FASetup = async () => {
    const response = await fetch("/api/2fa/verify-setup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: verificationCode }),
    });

    const data = await response.json();
    if (response.ok) {
      setBackupCodes(data.backupCodes);
      // Show backup codes to user
    }
  };

  return (
    <div>
      {qrCode && (
        <div>
          <h3>Scan QR Code with Authenticator App</h3>
          <img src={qrCode} alt="2FA QR Code" />
          <p>Manual entry key: {manualKey}</p>
        </div>
      )}

      <input
        type="text"
        placeholder="Enter 6-digit code"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
      />

      <button onClick={verify2FASetup}>Verify & Enable 2FA</button>

      {backupCodes.length > 0 && (
        <div>
          <h3>Backup Codes - Save These!</h3>
          {backupCodes.map((code) => (
            <p key={code}>{code}</p>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 🧪 Testing

### Manual Testing with Authenticator App

1. **Setup 2FA:**

   ```bash
   curl -X POST http://localhost:5001/api/2fa/setup \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Scan QR code** with Google Authenticator or Authy

3. **Verify setup:**

   ```bash
   curl -X POST http://localhost:5001/api/2fa/verify-setup \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"token": "123456"}'
   ```

4. **Test 2FA login:**

   ```bash
   # Step 1: Login
   curl -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "demo@esoteric.com", "password": "demo123456"}'

   # Step 2: Complete with 2FA
   curl -X POST http://localhost:5001/api/auth/complete-2fa-login \
     -H "Content-Type: application/json" \
     -d '{"session_token": "SESSION_TOKEN", "totp_token": "123456"}'
   ```

### Automated Testing

```bash
cd backend
node test-2fa.js
```

## 🔒 Security Features

### Rate Limiting

- **5 attempts per 15 minutes** per IP/user combination
- Automatic lockout after limit exceeded
- Attempt logging for security monitoring

### Session Security

- **JWT tokens** with enhanced claims
- **Session tracking** in database
- **2FA completion** verification on protected routes
- **Automatic cleanup** of expired sessions

### Backup Codes

- **10 single-use codes** generated on setup
- **Cryptographically secure** random generation
- **One-time use** - automatically removed after use
- **Regeneration** available with TOTP verification

## 🚀 Production Deployment

### Environment Variables

```bash
# Add to your .env file
JWT_SECRET=your-super-secret-jwt-key-here
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=esoteric_loans
```

### Security Recommendations

1. **Force 2FA for Admin Users:**

   ```sql
   UPDATE users SET requires_2fa = true WHERE role = 'admin';
   ```

2. **Monitor 2FA Attempts:**

   ```sql
   SELECT * FROM user_2fa_attempts
   WHERE success = false
   AND attempted_at > NOW() - INTERVAL '1 hour';
   ```

3. **Regular Cleanup:**

   ```sql
   -- Clean old attempts (run daily)
   DELETE FROM user_2fa_attempts
   WHERE attempted_at < NOW() - INTERVAL '30 days';

   -- Clean expired sessions
   DELETE FROM user_sessions
   WHERE expires_at < NOW();
   ```

## 📱 Supported Authenticator Apps

- ✅ **Google Authenticator**
- ✅ **Authy**
- ✅ **Microsoft Authenticator**
- ✅ **1Password**
- ✅ **Bitwarden**
- ✅ **Any TOTP-compatible app**

## 🎯 Next Steps

1. **✅ Database Migration Complete** - 2FA tables created
2. **⚡ Start 2FA Server** - Use `server-2fa.js`
3. **🔧 Frontend Integration** - Add 2FA components
4. **🧪 Test Implementation** - Verify with authenticator app
5. **🚀 Deploy to Production** - Enable for admin users first

## 🆘 Troubleshooting

### Common Issues

**"Invalid verification code":**

- Check system time synchronization
- Ensure 30-second time window
- Try backup codes if available

**"Session expired":**

- Temporary sessions expire in 10 minutes
- Re-initiate login process

**"2FA not enabled":**

- Complete setup verification process
- Check user requires_2fa flag

Your 2FA system is now ready! This provides bank-level security for your financial platform. 🏦🔐
