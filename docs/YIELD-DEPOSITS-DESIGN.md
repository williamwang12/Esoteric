# 🏦 12% Yield Deposits Feature - Design Document

## 📋 Overview
A new admin feature allowing creation of fixed-yield deposits that automatically pay 12% annual returns (non-compounding) to clients.

## 🎯 Core Requirements

### Admin Interface
- **New tab** in admin dashboard: "Yield Deposits"
- **Create deposit form** with fields:
  - Client email/selection
  - Principal amount
  - Start date (default: today)
  - Status (Active/Inactive)
- **Deposits table** showing all deposits with filters/search
- **Manual payout trigger** (for testing/adjustments)

### Deposit Logic
- **Fixed 12% annual yield** (non-compounding)
- **Annual payout schedule** on deposit anniversary
- **Automatic calculation**: `principal × 0.12`
- **Account integration**: Payouts added to client's loan account balance

### Data Structure
```sql
CREATE TABLE yield_deposits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  principal_amount DECIMAL(15,2) NOT NULL,
  annual_yield_rate DECIMAL(5,4) DEFAULT 0.12,
  start_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  last_payout_date DATE,
  total_paid_out DECIMAL(15,2) DEFAULT 0
);

CREATE TABLE yield_payouts (
  id SERIAL PRIMARY KEY,
  deposit_id INTEGER REFERENCES yield_deposits(id),
  amount DECIMAL(15,2) NOT NULL,
  payout_date DATE NOT NULL,
  transaction_id INTEGER REFERENCES loan_transactions(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Automated Payout System

### Background Job
- **Daily scheduler** checks for due payouts
- **Anniversary detection**: `start_date + (n × 365 days)`
- **Transaction creation** for each payout
- **Balance updates** to client accounts

### Transaction Integration
- Payouts recorded as `yield_payment` transaction type
- Description: "12% yield payment for deposit #123"
- Automatic balance reconciliation

## 🖥️ User Interface

### Admin Dashboard Tab
```
Yield Deposits
├── Create New Deposit [Button]
├── Deposits Overview
│   ├── Total Active Deposits: $X
│   ├── Annual Yield Liability: $Y
│   └── Next Payouts Due: N deposits
└── Deposits Table
    ├── Filters: Status, Date Range, Client
    ├── Columns: Client, Principal, Start Date, Next Payout, Total Paid
    └── Actions: View, Edit, Deactivate
```

### Create Deposit Form
```
┌─ Create Yield Deposit ─────────────────┐
│ Client Email: [dropdown/search]        │
│ Principal Amount: [$______]            │
│ Start Date: [date picker]              │
│ Yield Rate: [12%] (locked)             │
│                                        │
│ Summary:                               │
│ • Annual Payout: $XXX                 │
│ • First Payout: MM/DD/YYYY             │
│                                        │
│ [Cancel] [Create Deposit]              │
└────────────────────────────────────────┘
```

## 🚀 Implementation Plan

### Phase 1: Database & Backend
1. Create database tables
2. Add API endpoints:
   - `POST /api/admin/yield-deposits`
   - `GET /api/admin/yield-deposits`
   - `PUT /api/admin/yield-deposits/:id`
   - `POST /api/admin/yield-deposits/:id/payout`

### Phase 2: Frontend
1. New admin tab component
2. Create deposit form
3. Deposits table with filtering
4. Integration with existing transaction system

### Phase 3: Automation
1. Background job scheduler
2. Automatic payout processing
3. Email notifications (optional)

## 🔒 Security & Validation

### Access Control
- Admin-only feature (role-based permissions)
- Audit logging for all deposit operations

### Data Validation
- Principal amount > 0
- Valid user exists
- Start date not in future
- Prevent duplicate active deposits per user (optional)

## 📊 Reporting Integration

### Transaction History
- Yield payments appear in client transaction history
- Admin can view payout history per deposit

### Balance Tracking
- Payouts automatically update loan account balances
- Integration with existing balance management

## 🎯 Success Metrics
- Deposits created successfully
- Automated payouts execute on schedule
- Client balances update correctly
- Admin interface usability

---

**Estimated Development Time**: 2-3 days  
**Dependencies**: Existing user/loan account system  
**Risk Level**: Low (builds on existing transaction infrastructure)