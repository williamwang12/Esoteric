# Esoteric Enterprises - Website Setup SOP

## Standard Operating Procedure for Running the Loan Management Platform

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git
- Terminal/Command Line access

### Quick Start Guide

#### 1. Initial Setup (First Time Only)

```bash
# Clone the repository (if not already cloned)
git clone https://github.com/williamwang12/Esoteric.git
cd Esoteric

# Install dependencies for both frontend and backend
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

#### 2. Environment Configuration

Set up environment variables:
```bash
# Copy environment templates
cp env.example .env
cp backend/env.example backend/.env  
cp frontend-env.example frontend/.env
```

**Important**: Update the following in the `.env` files:
- Database password: Replace `your_db_password` with your actual PostgreSQL password
- JWT secret: Replace with a secure random string
- Email credentials (if using email features)

#### 3. Database Setup

```bash
# Set up the PostgreSQL database
npm run db:setup
```

#### 4. Starting the Application

**Option A: Start Both Servers Separately (Recommended)**

Terminal 1 - Backend:
```bash
cd backend
node server-2fa.js
```
*Server will start on http://localhost:5001*

Terminal 2 - Frontend:
```bash
cd frontend
npm start
```
*Frontend will start on http://localhost:3000*

**Option B: Using NPM Scripts from Root**

Backend only:
```bash
npm start
```

Frontend only:
```bash
cd frontend && npm start
```

### Access Points

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:5001/api
- **Health Check**: http://localhost:5001/api/health

### Test Accounts

The database includes these test users:
- `demo@esoteric.com`
- `test@test.com` 
- `newuser@example.com`
- `william.wang12@outlook.com`

*Note: Default password for test accounts is likely `password123`*

### Common Issues and Solutions

#### Issue 1: Port 5000 Conflict
**Symptom**: Login returns 403 Forbidden or connection refused
**Cause**: macOS Control Center uses port 5000 for AirPlay
**Solution**: The application is configured to use port 5001 instead

#### Issue 2: Database Connection Error
**Symptom**: Server fails to start with database connection error
**Solutions**:
- Ensure PostgreSQL is running: `brew services start postgresql`
- Check database credentials in `.env` files
- Verify database exists: `psql -l`

#### Issue 3: Login Failed
**Symptom**: Frontend shows "login failed" message
**Solutions**:
- Ensure backend is running on port 5001
- Verify test user exists in database
- Check browser console for network errors
- Ensure `.env` files are configured correctly

#### Issue 4: Dependencies Issues
**Solutions**:
```bash
# Clean install
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json  
rm -rf frontend/node_modules frontend/package-lock.json
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Development Workflow

1. **Start Backend**: Always start the backend first
2. **Start Frontend**: Start frontend after backend is running
3. **Check Logs**: Monitor terminal outputs for errors
4. **Test Login**: Use test accounts to verify functionality

### Stopping the Application

- **Frontend**: Press `Ctrl+C` in the frontend terminal
- **Backend**: Press `Ctrl+C` in the backend terminal

### File Structure Reference

```
/
├── frontend/          # React.js application (port 3000)
├── backend/           # Node.js API server (port 5001)  
├── database/          # SQL schemas and migrations
├── .env              # Root environment variables
├── backend/.env      # Backend environment variables
└── frontend/.env     # Frontend environment variables
```

### Security Notes

- Keep `.env` files secure and never commit to version control
- Use strong passwords for database and JWT secrets
- The application includes 2FA capabilities for enhanced security
- All API endpoints use proper authentication and validation

### Troubleshooting Commands

```bash
# Check if processes are running on ports
lsof -i :3000  # Frontend
lsof -i :5001  # Backend

# Check database connection
psql -h localhost -U postgres -d esoteric_loans

# View server logs
tail -f backend/server.log
```

---

**Last Updated**: August 2025  
**Version**: 1.0  
**Contact**: Development Team