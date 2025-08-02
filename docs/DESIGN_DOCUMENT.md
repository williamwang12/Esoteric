# Esoteric Enterprises Financial Platform - Design Document

## 1. Executive Summary

### 1.1 Project Overview

Esoteric Enterprises needs an attractive, secure financial website that enables customers to:

- Create accounts and log in securely with two-factor authentication
- Access a dashboard to view their loan performance and earnings
- View their loan details (principal, monthly payments, bonuses, withdrawals)
- Track growth charts showing bonuses and withdrawals over time
- Access and download important documents
- Schedule meetings with the financial team

### 1.2 Key Objectives

- Secure financial data protection
- Modern, intuitive user interface
- Scalable architecture for future growth
- Maintainable, well-documented codebase

## 2. System Architecture

### 2.1 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React.js)    │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 Technology Stack

#### Frontend

- **Framework**: React.js
- **UI Library**: Material-UI with purple/black theme
- **Routing**: React Router
- **Charts**: Chart.js for financial visualizations
- **HTTP Client**: Axios
- **Deployment**: Netlify/Vercel

#### Backend

- **Runtime**: Node.js with Express.js
- **Authentication**: JWT tokens + Speakeasy for 2FA
- **Payment Processing**: Monthly interest and bonus calculations
- **Password Security**: Bcrypt hashing
- **File Processing**: Multer
- **Validation**: Input sanitization middleware
- **Deployment**: DigitalOcean

#### Database

- **Database**: PostgreSQL
- **Hosting**: DigitalOcean Managed Database
- **Features**: Automated backups, connection pooling

## 3. Core Features

### 3.1 User Authentication

- Account registration with email verification
- Two-factor authentication (SMS/authenticator apps)
- JWT token authentication
- Password reset functionality
- Session management

### 3.2 Customer Portal

#### Dashboard

- Loan balance overview in purple-themed cards
- Monthly payment tracker (1% base + bonuses)
- Recent withdrawals and bonus payments
- Interactive growth charts showing loan performance
- Upcoming payment schedule and amounts

#### Account Management

- Personal profile management
- Multi-account overview
- Contact information updates

#### Financial Data

- Loan transaction history with filtering
- Statement generation and PDF download
- Loan performance and growth tracking
- Bonus history and withdrawal records

#### Document Center

- Document library with categorization
- Secure document access
- Search functionality
- Download management

### 3.3 Admin Panel

- Customer management dashboard
- Account administration and editing
- Document management with batch upload
- System analytics and monitoring

## 4. Security Framework

### 4.1 Authentication Security

- **Two-Factor Authentication**: TOTP via authenticator apps or SMS
- **Password Protection**: Bcrypt hashing with salt rounds
- **Token Authentication**: JWT with configurable expiration
- **Rate Limiting**: Protection against brute force attacks
- **Password Policy**: Strength requirements and validation

### 4.2 Data Protection

- **Encryption**: TLS/SSL for all communications
- **Input Validation**: Sanitization of user inputs
- **SQL Injection Defense**: Parameterized queries
- **XSS Prevention**: Content security policies

### 4.3 Monitoring & Backup

- **Performance Monitoring**: Error tracking and analytics
- **Security Logging**: Audit trails for authentication
- **Automated Backups**: Daily encrypted database backups

## 5. Database Design

### 5.1 Core Tables

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan accounts table
CREATE TABLE loan_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    account_number VARCHAR(50) UNIQUE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    monthly_rate DECIMAL(5,4) DEFAULT 0.01,
    total_bonuses DECIMAL(15,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan transactions table
CREATE TABLE loan_transactions (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'loan', 'monthly_payment', 'bonus', 'withdrawal'
    bonus_percentage DECIMAL(5,4),
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    category VARCHAR(100) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simple sessions tracking
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Two-factor authentication
CREATE TABLE user_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    secret VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly payments schedule
CREATE TABLE payment_schedule (
    id SERIAL PRIMARY KEY,
    loan_account_id INTEGER REFERENCES loan_accounts(id),
    payment_date DATE NOT NULL,
    base_amount DECIMAL(15,2) NOT NULL,
    bonus_amount DECIMAL(15,2) DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'processed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. API Endpoints

### 6.1 Authentication

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/setup-2fa
POST /api/auth/verify-2fa
POST /api/auth/disable-2fa
```

### 6.2 User & Loan Management

```
GET /api/user/profile
PUT /api/user/profile
GET /api/loans
GET /api/loans/:id/transactions
GET /api/loans/:id/performance
GET /api/loans/:id/payments
```

### 6.3 Documents

```
GET /api/documents
GET /api/documents/:id/download
```

### 6.4 Loan Analytics

```
GET /api/analytics/loan-performance
GET /api/analytics/bonus-history
GET /api/payments/upcoming
GET /api/payments/history
```

## 7. User Interface Design

### 7.1 Design Approach

- Modern purple and black color scheme
- Professional design for financial confidence
- Fast loading with sub-second performance

### 7.2 Key Pages

1. **Login/Register**
2. **Dashboard**
3. **Transactions**
4. **Documents**
5. **Profile**

### 7.3 Dashboard Design

**Color Palette:** Deep purple (#6B46C1) with matte black (#1F2937).

```
┌─────────────────────────────────────────────────────────┐
│  [Purple Header] ESOTERIC ENTERPRISES    [Profile][⚫]  │
├─────────────────────────────────────────────────────────┤
│ [Black Background with subtle texture]                  │
│  Welcome back, John Smith                               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │[Purple Card] │  │[Purple Card] │  │[Purple Card] │  │
│  │Loan Balance  │  │ This Month   │  │ Total Earned │  │
│  │$125,450.00   │  │ +$1,254.50   │  │ $15,320.75   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │[Dark Card with Purple Gradient Border]             ││
│  │         Loan Growth & Bonus Performance             ││
│  │  [Purple gradient line chart showing growth]       ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  Next Payment: $1,254.50 (Base) + $320.25 (Bonus)     │
│  Recent Activity:                                       │
│  🔹 Monthly Payment - $1,254.50 - Oct 15               │
│  🔹 Bonus Payment - $320.25 - Oct 15                   │
│  🔹 Withdrawal - $500.00 - Oct 10                      │
│  [Purple Gradient Button: View All Transactions]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Design Features:**

- Purple gradient headers with shadows
- Matte black backgrounds
- Purple accents with hover animations
- White typography for contrast
- Card-based layout with rounded corners
- Modern icons and micro-interactions

## 8. Development Timeline

### Phase 1: Foundation (Weeks 1-2)

- Set up development environment
- Create basic React app with routing
- Set up Node.js backend with database connection
- Implement user registration and login

### Phase 2: Core Features (Weeks 3-4)

- Build user dashboard
- Create transaction display and filtering
- Implement basic account management
- Add simple charts for financial data

### Phase 3: Document Management (Weeks 5-6)

- File upload system for admins
- Document categorization and storage
- Download functionality for users
- Admin panel for customer management

### Phase 4: Polish & Deploy (Weeks 7-8)

- Security hardening and testing
- UI/UX improvements
- Performance optimization
- Production deployment and testing

## 9. Budget Breakdown

### Development Costs

- **Frontend Development**: $2,500
- **Backend Development**: $3,000
- **Security Implementation (inc. 2FA)**: $2,000
- **Loan Management System**: $1,000
- **Payment Processing**: $500
- **Database Setup & Design**: $600
- **Testing & Deployment**: $400

**Total Development**: $10,000

### Monthly Operational Costs

- **Backend Hosting** (DigitalOcean): $20/month
- **Database Hosting**: $15/month
- **Frontend Hosting** (Netlify/Vercel): Free
- **SSL Certificate**: Free (Let's Encrypt)
- **Domain**: $15/year

**Total Monthly**: ~$35-40

## 10. Future Features

These are some other features that you could consider implementing in the future, but wouldn't be in scope for the current website.

### Advanced Features (Future Phases)

- Advanced analytics and reporting
- Mobile applications
- Automated compliance reporting
- Advanced monitoring and alerting
- Load balancing and auto-scaling
- Microservices architecture

### Enterprise Security Features

- Penetration testing
- Advanced intrusion detection
- Compliance certifications
- Advanced audit logging
- Encryption at rest

## 11. Success Metrics

### Technical Goals

- Page load times under 3 seconds
- 99% uptime
- Zero security incidents
- All core features working properly

### Business Goals

- Easy customer onboarding
- Customers can access their data quickly
- Documents are easily accessible
- Admins can manage customer data efficiently

## 12. Risk Mitigation

### Technical Risks

- **Data Loss**: Regular automated backups
- **Security Breach**: Basic security measures, regular updates
- **Server Downtime**: Choose reliable hosting provider
- **Developer Availability**: Keep code well-documented

### Business Risks

- **Scope Creep**: Stick to defined features for v1
- **Budget Overrun**: 10% buffer included in budget
- **Timeline Delays**: Conservative 8-week estimate

## 13. Conclusion

This design delivers Esoteric Enterprises a secure loan management platform with modern UI, two-factor authentication, and comprehensive loan tracking. The solution provides customers with an excellent experience to track their loans and earnings while giving administrators powerful loan management tools.

**Key Benefits:**

- Secure financial data protection with 2FA
- Modern purple/black interface design
- Loan performance tracking with bonus calculations
- Growth charts showing earnings over time
- Monthly payment schedule and tracking
- Professional platform within $10k budget
