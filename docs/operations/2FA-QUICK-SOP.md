# 🔐 2FA Quick Start SOP - Esoteric Enterprises

## TL;DR - Get Your 2FA Code NOW

```bash
# 1. Navigate to backend directory
cd /Users/williamwang/Esoteric/backend

# 2. Generate your current 2FA code
node generate-2fa-code.js demo@esoteric.com

# Output will show:
# 📱 Current TOTP Code: 434815
# ⏰ Valid for: 10 seconds
```

## Complete Login Process

### Step 1: Login with Password

```bash
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@esoteric.com", "password": "demo123456"}'
```

### Step 2: Get Your 2FA Code

```bash
cd /Users/williamwang/Esoteric/backend
node generate-2fa-code.js demo@esoteric.com
```

### Step 3: Complete 2FA Login (use code from Step 2)

```bash
curl -X POST http://localhost:5002/api/auth/complete-2fa-login \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "YOUR_SESSION_TOKEN_FROM_STEP_1",
    "totp_token": "434815"
  }'
```

## Emergency Backup Codes (One-Time Use)

```
99EE3096, 9D062644, A33E4F69, 9BAE0D51, A6D68575
749B8AE5, D1E750E1, 109A5E3C, 5885387C, A9FE53EC
```

## Start Your Servers

### Backend (Fixed!)

```bash
# From project root (now works!)
npm start

# Or manually
cd backend && PORT=5002 node server-2fa.js
```

### Frontend

```bash
cd frontend && npm start
# Opens http://localhost:3000
```

## Authenticator App Setup

- **Secret:** `KJMDW5CNKNFXUS2JFZUWS2Z6KMYCIZJXOZEWO4JEMZNXGZSDJZNA`
- **Service:** Esoteric Enterprises
- **Account:** demo@esoteric.com

## Troubleshooting

### "Invalid credentials" → Wrong password: `demo123456`

### "Invalid token" → Code expired (30s limit), get new one

### "Too many attempts" → Wait 15min OR use backup code

### Server won't start → `cd backend && PORT=5002 node server-2fa.js`

## Quick Commands

| Task              | Command                                       |
| ----------------- | --------------------------------------------- |
| **Get 2FA Code**  | `node generate-2fa-code.js demo@esoteric.com` |
| **List Users**    | `node generate-2fa-code.js --list`            |
| **Start Backend** | `npm start` (from root)                       |
| **Check Health**  | `curl http://localhost:5002/api/health`       |

---

✅ **Server Fixed:** `npm start` now works from project root!  
🔐 **2FA Tool:** Created `generate-2fa-code.js` for easy code generation  
📚 **Full Guide:** See `/docs/2FA-USER-GUIDE.md` for complete documentation
