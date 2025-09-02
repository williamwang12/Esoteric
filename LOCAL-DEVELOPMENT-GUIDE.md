# Local Development Setup Guide

## Prerequisites

1. **Node.js 18+** installed
2. **PostgreSQL** installed and running locally
3. **Git** installed

## Quick Start

### 1. Database Setup

**Option A: Use PostgreSQL (Recommended)**
```bash
# Install PostgreSQL (macOS with Homebrew)
brew install postgresql
brew services start postgresql

# Create database
createdb esoteric_loans

# Run schema
psql esoteric_loans < database/schema.sql
psql esoteric_loans < database/migrations/001_add_2fa_tables.sql
psql esoteric_loans < database/migrations/002_add_account_verification.sql
psql esoteric_loans < database/migrations/003_add_request_tables.sql
psql esoteric_loans < database/migrations/004_add_meeting_fields.sql
```

**Option B: Use SQLite (Development Only)**
The backend will automatically create a SQLite database if PostgreSQL is not available.

### 2. Environment Configuration

```bash
# Copy environment templates
cp backend/env.example backend/.env
cp frontend-env.example frontend/.env.local

# Edit backend/.env with your database credentials
# For PostgreSQL:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=esoteric_loans
DB_USER=postgres
DB_PASSWORD=your_password

# For SQLite (if no PostgreSQL):
# Leave DB_* variables empty and it will use SQLite
```

### 3. Start the Application

```bash
# Option A: Use the automated script (recommended)
./start-website.sh

# Option B: Start manually
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm install
npm start
```

## Application URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5002/api
- **Health Check**: http://localhost:5002/api/health

## Default Test Accounts

### Regular User
- Email: `test@example.com`
- Password: `testpass123`

### Admin User
- Email: `demo@esoteric.com`
- Password: `admin123`

## Development Commands

### Backend
```bash
cd backend

# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run specific test suites
npm run test:2fa
npm run test:comprehensive
```

### Frontend
```bash
cd frontend

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Database Management

### Create Admin User
```sql
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES ('admin@esoteric.com', '$2b$10$hash', 'Admin', 'User', 'admin');
```

### Create Test Loan Account
```sql
INSERT INTO loan_accounts (user_id, account_number, principal_amount, current_balance) 
VALUES (1, 'LOAN-TEST-001', 10000.00, 10000.00);
```

### View Database Tables
```bash
# Connect to PostgreSQL
psql esoteric_loans

# List tables
\dt

# View users
SELECT * FROM users;

# View loan accounts
SELECT * FROM loan_accounts;
```

## Common Issues & Solutions

### Frontend Won't Start
- **Issue**: `serve` command error
- **Solution**: Make sure you're using `npm start` (development) not `npm run start:prod` (production)

### Database Connection Error
- **Issue**: Backend can't connect to PostgreSQL
- **Solution**: 
  1. Check PostgreSQL is running: `brew services list`
  2. Verify credentials in `backend/.env`
  3. Create database if it doesn't exist

### Port Already in Use
- **Issue**: Port 3000 or 5002 already in use
- **Solution**: The start script automatically kills existing processes, or manually:
```bash
# Kill processes on port
lsof -ti:3000 | xargs kill -9
lsof -ti:5002 | xargs kill -9
```

### CORS Errors
- **Issue**: Frontend can't connect to backend
- **Solution**: Check `FRONTEND_URL` in `backend/.env` matches frontend URL

## File Structure

```
Esoteric/
├── backend/                 # Node.js/Express API
│   ├── routes/             # API routes
│   ├── middleware/         # Auth middleware
│   ├── services/           # Business logic
│   └── server-2fa.js       # Main server file
├── frontend/               # React TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   └── services/       # API services
│   └── public/
├── database/               # Database schema & migrations
└── logs/                   # Development logs
```

## Deployment

See `DEPLOYMENT-GUIDE.md` for production deployment instructions.
