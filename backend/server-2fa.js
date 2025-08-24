// Enhanced server with 2FA support
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'esoteric_loans',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Make pool available to routes
app.locals.pool = pool;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Import middlewares
const { authenticateToken, authenticateBasicToken, cleanupExpiredSessions } = require('./middleware/auth-2fa');

// Import services
const meetingService = require('./services/meetingService');

// Apply session cleanup
app.use(cleanupExpiredSessions);

// Import routes
const auth2faRoutes = require('./routes/auth-2fa');
const twoFARoutes = require('./routes/2fa');

// Basic health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
            features: ['2FA', 'JWT Sessions', 'TOTP', 'Backup Codes']
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Authentication routes (with 2FA support)
app.use('/api/auth', auth2faRoutes);

// 2FA management routes
app.use('/api/2fa', authenticateBasicToken, twoFARoutes);

// Example protected route
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, phone, role, requires_2fa, last_login, created_at, email_verified FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Get 2FA status
        const twoFAResult = await pool.query(
            'SELECT is_enabled, last_used FROM user_2fa WHERE user_id = $1',
            [req.user.userId]
        );

        res.json({
            ...user,
            twoFA: {
                enabled: twoFAResult.rows.length > 0 ? twoFAResult.rows[0].is_enabled : false,
                lastUsed: twoFAResult.rows.length > 0 ? twoFAResult.rows[0].last_used : null
            }
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, [
    body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('phone').optional().trim().matches(/^\+?[\d\s\-\(\)]+$/).withMessage('Invalid phone number format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, phone } = req.body;
        const userId = req.user.userId;

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (firstName !== undefined) {
            paramCount++;
            updates.push(`first_name = $${paramCount}`);
            values.push(firstName);
        }

        if (lastName !== undefined) {
            paramCount++;
            updates.push(`last_name = $${paramCount}`);
            values.push(lastName);
        }

        if (phone !== undefined) {
            paramCount++;
            updates.push(`phone = $${paramCount}`);
            values.push(phone || null); // Allow clearing phone by sending empty string
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add user ID as the last parameter
        values.push(userId);
        paramCount++;

        const query = `
            UPDATE users 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING id, email, first_name, last_name, phone, requires_2fa, last_login, created_at
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Get updated 2FA status
        const twoFAResult = await pool.query(
            'SELECT is_enabled, last_used FROM user_2fa WHERE user_id = $1',
            [userId]
        );

        res.json({
            message: 'Profile updated successfully',
            user: {
                ...user,
                twoFA: {
                    enabled: twoFAResult.rows.length > 0 ? twoFAResult.rows[0].is_enabled : false,
                    lastUsed: twoFAResult.rows.length > 0 ? twoFAResult.rows[0].last_used : null
                }
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send email verification
app.post('/api/user/send-email-verification', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Check if user email is already verified
        const userResult = await pool.query(
            'SELECT email, email_verified FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { email, email_verified } = userResult.rows[0];

        if (email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        // Generate verification token
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store verification token
        await pool.query(
            'UPDATE users SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3',
            [verificationToken, expiresAt, userId]
        );

        // In a real application, you would send an email here
        // For this demo, we'll just return the token
        console.log(`Email verification token for ${email}: ${verificationToken}`);
        
        res.json({ 
            message: 'Verification email sent successfully',
            // In production, don't include the token in the response
            // This is only for testing purposes
            token: verificationToken
        });

    } catch (error) {
        console.error('Send email verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify email
app.post('/api/user/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        // Find user with the verification token
        const userResult = await pool.query(
            'SELECT id, email, email_verified, email_verification_expires_at FROM users WHERE email_verification_token = $1',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        const { id: userId, email, email_verified, email_verification_expires_at } = userResult.rows[0];

        if (email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        // Check if token has expired
        if (new Date() > new Date(email_verification_expires_at)) {
            return res.status(400).json({ error: 'Verification token has expired' });
        }

        // Mark email as verified and clear verification token
        await pool.query(
            'UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = $1',
            [userId]
        );

        res.json({ 
            message: 'Email verified successfully',
            email: email
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Request account verification
app.post('/api/user/request-account-verification', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Check if user already has a pending request
        const existingRequestResult = await pool.query(
            'SELECT id, created_at FROM account_verification_requests WHERE user_id = $1 AND status = $2',
            [userId, 'pending']
        );

        if (existingRequestResult.rows.length > 0) {
            return res.status(400).json({ 
                error: 'You already have a pending verification request' 
            });
        }

        // Create new verification request
        await pool.query(
            'INSERT INTO account_verification_requests (user_id, status, created_at) VALUES ($1, $2, NOW())',
            [userId, 'pending']
        );

        res.json({ 
            message: 'Account verification request submitted successfully',
            status: 'pending'
        });

    } catch (error) {
        console.error('Account verification request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's loan accounts
app.get('/api/loans', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM loan_accounts WHERE user_id = $1',
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Loans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get loan transactions with filtering
app.get('/api/loans/:loanId/transactions', authenticateToken, async (req, res) => {
    try {
        const { loanId } = req.params;
        const { page = 1, limit = 10, type, start_date, end_date } = req.query;

        // Verify the loan belongs to the user
        const loanCheck = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1 AND user_id = $2',
            [loanId, req.user.userId]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        // Build filter conditions
        let whereConditions = ['loan_account_id = $1'];
        let queryParams = [loanId];
        let paramCount = 1;

        if (type) {
            paramCount++;
            whereConditions.push(`transaction_type = $${paramCount}`);
            queryParams.push(type);
        }

        if (start_date) {
            paramCount++;
            whereConditions.push(`transaction_date >= $${paramCount}`);
            queryParams.push(start_date);
        }

        if (end_date) {
            paramCount++;
            whereConditions.push(`transaction_date <= $${paramCount}`);
            queryParams.push(end_date);
        }

        const whereClause = whereConditions.join(' AND ');
        const offset = (page - 1) * limit;

        // Get transactions with pagination
        const transactionsQuery = `
            SELECT id, transaction_type, amount, transaction_date, description, reference_id
            FROM loan_transactions 
            WHERE ${whereClause}
            ORDER BY transaction_date DESC 
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        queryParams.push(limit, offset);
        const transactionsResult = await pool.query(transactionsQuery, queryParams);

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM loan_transactions 
            WHERE ${whereClause}
        `;

        const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        res.json({
            transactions: transactionsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Loan transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get loan performance analytics
app.get('/api/loans/:loanId/analytics', authenticateToken, async (req, res) => {
    try {
        const { loanId } = req.params;
        const { period = '12' } = req.query; // months

        // Verify the loan belongs to the user
        const loanCheck = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1 AND user_id = $2',
            [loanId, req.user.userId]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        const loanAccount = loanCheck.rows[0];

        // Get monthly aggregated data for the specified period
        const analyticsQuery = `
            SELECT 
                DATE_TRUNC('month', transaction_date) as month,
                SUM(CASE WHEN transaction_type = 'monthly_payment' THEN amount ELSE 0 END) as monthly_payments,
                SUM(CASE WHEN transaction_type = 'bonus' THEN amount ELSE 0 END) as bonus_payments,
                SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END) as withdrawals,
                COUNT(*) as transaction_count
            FROM loan_transactions 
            WHERE loan_account_id = $1 
                AND transaction_date >= NOW() - INTERVAL '${parseInt(period)} months'
                AND transaction_type IN ('monthly_payment', 'bonus', 'withdrawal')
            GROUP BY DATE_TRUNC('month', transaction_date)
            ORDER BY month ASC
        `;

        const analyticsResult = await pool.query(analyticsQuery, [loanId]);

        // Calculate running balance over time
        let runningBalance = parseFloat(loanAccount.principal_amount);
        const balanceHistory = analyticsResult.rows.map(row => {
            const monthlyPayment = parseFloat(row.monthly_payments || 0);
            const bonusPayment = parseFloat(row.bonus_payments || 0);
            const withdrawal = parseFloat(row.withdrawals || 0);
            
            runningBalance += monthlyPayment + bonusPayment + withdrawal;
            
            return {
                month: row.month,
                balance: runningBalance,
                monthlyPayment,
                bonusPayment,
                withdrawal: Math.abs(withdrawal),
                netGrowth: monthlyPayment + bonusPayment + withdrawal
            };
        });

        res.json({
            loanAccount,
            analytics: {
                balanceHistory,
                currentBalance: parseFloat(loanAccount.current_balance),
                totalPrincipal: parseFloat(loanAccount.principal_amount),
                totalBonuses: parseFloat(loanAccount.total_bonuses),
                totalWithdrawals: parseFloat(loanAccount.total_withdrawals),
                monthlyRate: parseFloat(loanAccount.monthly_rate)
            }
        });

    } catch (error) {
        console.error('Loan analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin middleware for checking admin privileges
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user has admin privileges
        const userResult = await pool.query(
            'SELECT id, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        
        // For now, make demo user an admin, and check for admin role
        if (user.role !== 'admin' && user.email !== 'demo@esoteric.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.user = decoded;
        req.adminUser = user;
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Admin route - Get all users
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.requires_2fa, u.last_login, u.created_at,
                   u.account_verified, u.verified_at, u.verified_by_admin,
                   u2fa.is_enabled as has_2fa_enabled, u2fa.last_used as last_2fa_use,
                   COUNT(la.id) as loan_accounts_count,
                   admin_user.first_name as verified_by_first_name, admin_user.last_name as verified_by_last_name
            FROM users u
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            LEFT JOIN loan_accounts la ON u.id = la.user_id
            LEFT JOIN users admin_user ON u.verified_by_admin = admin_user.id
            GROUP BY u.id, u2fa.is_enabled, u2fa.last_used, u.created_at, admin_user.first_name, admin_user.last_name
            ORDER BY u.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Admin users fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Create loan account for user
app.post('/api/admin/create-loan', authenticateAdmin, [
    body('userId').isInt().withMessage('Valid user ID required'),
    body('principalAmount').isFloat({ min: 0 }).withMessage('Valid principal amount required'),
    body('monthlyRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Monthly rate must be between 0 and 1')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { userId, principalAmount, monthlyRate = 0.01 } = req.body;

        // Verify user exists
        const userResult = await pool.query(
            'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Check if user already has a loan account
        const existingLoan = await pool.query(
            'SELECT id FROM loan_accounts WHERE user_id = $1',
            [userId]
        );

        if (existingLoan.rows.length > 0) {
            return res.status(400).json({ error: 'User already has a loan account' });
        }

        // Generate unique account number
        const accountNumber = `LOAN-${Date.now()}-${userId}`;

        // Create loan account
        const loanResult = await pool.query(
            `INSERT INTO loan_accounts (user_id, account_number, principal_amount, current_balance, monthly_rate)
             VALUES ($1, $2, $3, $3, $4) RETURNING *`,
            [userId, accountNumber, principalAmount, monthlyRate]
        );

        const loanAccount = loanResult.rows[0];

        // Create initial loan transaction
        await pool.query(
            `INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, description, transaction_date)
             VALUES ($1, $2, 'loan', 'Initial loan amount', CURRENT_DATE)`,
            [loanAccount.id, principalAmount]
        );

        res.status(201).json({
            message: 'Loan account created successfully',
            loanAccount: {
                id: loanAccount.id,
                accountNumber: loanAccount.account_number,
                principalAmount: parseFloat(loanAccount.principal_amount),
                currentBalance: parseFloat(loanAccount.current_balance),
                monthlyRate: parseFloat(loanAccount.monthly_rate),
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email
                }
            }
        });

    } catch (error) {
        console.error('Loan creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Update loan account
app.put('/api/admin/loans/:loanId', authenticateAdmin, [
    body('principalAmount').optional().isFloat({ min: 0 }).withMessage('Valid principal amount required'),
    body('currentBalance').optional().isFloat({ min: 0 }).withMessage('Valid current balance required'),
    body('monthlyRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Monthly rate must be between 0 and 1'),
    body('totalBonuses').optional().isFloat({ min: 0 }).withMessage('Valid total bonuses required'),
    body('totalWithdrawals').optional().isFloat({ min: 0 }).withMessage('Valid total withdrawals required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { loanId } = req.params;
        const { principalAmount, currentBalance, monthlyRate, totalBonuses, totalWithdrawals } = req.body;

        // Verify loan exists
        const loanResult = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1',
            [loanId]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        const currentLoan = loanResult.rows[0];

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (principalAmount !== undefined) {
            paramCount++;
            updates.push(`principal_amount = $${paramCount}`);
            values.push(principalAmount);
        }

        if (currentBalance !== undefined) {
            paramCount++;
            updates.push(`current_balance = $${paramCount}`);
            values.push(currentBalance);
        }

        if (monthlyRate !== undefined) {
            paramCount++;
            updates.push(`monthly_rate = $${paramCount}`);
            values.push(monthlyRate);
        }

        if (totalBonuses !== undefined) {
            paramCount++;
            updates.push(`total_bonuses = $${paramCount}`);
            values.push(totalBonuses);
        }

        if (totalWithdrawals !== undefined) {
            paramCount++;
            updates.push(`total_withdrawals = $${paramCount}`);
            values.push(totalWithdrawals);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        paramCount++;
        values.push(loanId);

        const updateQuery = `
            UPDATE loan_accounts 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $${paramCount} 
            RETURNING *
        `;

        const updatedLoan = await pool.query(updateQuery, values);

        res.json({
            message: 'Loan account updated successfully',
            loanAccount: updatedLoan.rows[0],
            changes: {
                principalAmount: principalAmount !== undefined ? { from: parseFloat(currentLoan.principal_amount), to: principalAmount } : undefined,
                currentBalance: currentBalance !== undefined ? { from: parseFloat(currentLoan.current_balance), to: currentBalance } : undefined,
                monthlyRate: monthlyRate !== undefined ? { from: parseFloat(currentLoan.monthly_rate), to: monthlyRate } : undefined,
                totalBonuses: totalBonuses !== undefined ? { from: parseFloat(currentLoan.total_bonuses), to: totalBonuses } : undefined,
                totalWithdrawals: totalWithdrawals !== undefined ? { from: parseFloat(currentLoan.total_withdrawals), to: totalWithdrawals } : undefined
            }
        });

    } catch (error) {
        console.error('Loan update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Add transaction to loan account
app.post('/api/admin/loans/:loanId/transactions', authenticateAdmin, [
    body('amount').isFloat().withMessage('Valid amount required'),
    body('transactionType').isIn(['loan', 'monthly_payment', 'bonus', 'withdrawal']).withMessage('Valid transaction type required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('transactionDate').optional().isISO8601().withMessage('Valid transaction date required'),
    body('bonusPercentage').optional().isFloat({ min: 0, max: 1 }).withMessage('Bonus percentage must be between 0 and 1')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { loanId } = req.params;
        const { amount, transactionType, description, transactionDate, bonusPercentage } = req.body;

        // Verify loan exists
        const loanResult = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1',
            [loanId]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        const loan = loanResult.rows[0];

        // Create transaction
        const transactionResult = await pool.query(
            `INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, description, transaction_date, bonus_percentage)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                loanId,
                amount,
                transactionType,
                description || `${transactionType} transaction`,
                transactionDate || new Date().toISOString().split('T')[0],
                bonusPercentage
            ]
        );

        // Update loan account totals based on transaction type
        let balanceUpdate = 0;
        let bonusUpdate = 0;
        let withdrawalUpdate = 0;

        switch (transactionType) {
            case 'loan':
            case 'monthly_payment':
            case 'bonus':
                balanceUpdate = amount;
                if (transactionType === 'bonus') {
                    bonusUpdate = amount;
                }
                break;
            case 'withdrawal':
                balanceUpdate = -Math.abs(amount);
                withdrawalUpdate = Math.abs(amount);
                break;
        }

        // Update loan account
        await pool.query(
            `UPDATE loan_accounts 
             SET current_balance = current_balance + $1,
                 total_bonuses = total_bonuses + $2,
                 total_withdrawals = total_withdrawals + $3
             WHERE id = $4`,
            [balanceUpdate, bonusUpdate, withdrawalUpdate, loanId]
        );

        // Get updated loan data
        const updatedLoanResult = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1',
            [loanId]
        );

        res.status(201).json({
            message: 'Transaction added successfully',
            transaction: transactionResult.rows[0],
            updatedLoan: updatedLoanResult.rows[0]
        });

    } catch (error) {
        console.error('Transaction creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get loan transactions
app.get('/api/admin/loans/:loanId/transactions', authenticateAdmin, async (req, res) => {
    try {
        const { loanId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Verify loan exists
        const loanResult = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1',
            [loanId]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        // Get transactions
        const transactionsResult = await pool.query(
            `SELECT * FROM loan_transactions 
             WHERE loan_account_id = $1 
             ORDER BY transaction_date DESC, created_at DESC 
             LIMIT $2 OFFSET $3`,
            [loanId, limit, offset]
        );

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM loan_transactions WHERE loan_account_id = $1',
            [loanId]
        );

        res.json({
            transactions: transactionsResult.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].total)
            }
        });

    } catch (error) {
        console.error('Transactions fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Delete loan account
app.delete('/api/admin/loans/:loanId', authenticateAdmin, async (req, res) => {
    try {
        const { loanId } = req.params;

        // Verify loan exists
        const loanResult = await pool.query(
            'SELECT * FROM loan_accounts WHERE id = $1',
            [loanId]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        // Delete associated transactions first
        await pool.query(
            'DELETE FROM loan_transactions WHERE loan_account_id = $1',
            [loanId]
        );

        // Delete loan account
        await pool.query(
            'DELETE FROM loan_accounts WHERE id = $1',
            [loanId]
        );

        res.json({
            message: 'Loan account and associated transactions deleted successfully'
        });

    } catch (error) {
        console.error('Loan deletion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get user's loan accounts
app.get('/api/admin/users/:userId/loans', authenticateAdmin, async (req, res) => {
  try {
      const { userId } = req.params;

      // Verify user exists
      const userCheck = await pool.query(
          'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
          [userId]
      );

      if (userCheck.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      const user = userCheck.rows[0];

      // Get loan accounts
      const loansResult = await pool.query(
          'SELECT * FROM loan_accounts WHERE user_id = $1',
          [userId]
      );

      res.json({
          user: {
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              email: user.email
          },
          loans: loansResult.rows
      });

  } catch (error) {
      console.error('Admin user loans error:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's documents
app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM documents WHERE user_id = $1';
        let params = [req.user.userId];

        if (category) {
            query += ' AND category = $2';
            params.push(category);
        }

        query += ' ORDER BY upload_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Documents fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get user's documents  
app.get('/api/admin/users/:userId/documents', authenticateAdmin, async (req, res) => {
  try {
      const { userId } = req.params;

      // Verify user exists
      const userCheck = await pool.query(
          'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
          [userId]
      );

      if (userCheck.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      const user = userCheck.rows[0];

      // Get documents
      const documentsResult = await pool.query(
          'SELECT * FROM documents WHERE user_id = $1 ORDER BY upload_date DESC',
          [userId]
      );

      res.json({
          user: {
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              email: user.email
          },
          documents: documentsResult.rows
      });

  } catch (error) {
      console.error('Admin user documents error:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Download document (for regular users - must own the document)
app.get('/api/documents/:documentId/download', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Get document and verify ownership
        const result = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = result.rows[0];

        // Check if file exists
        if (!fs.existsSync(document.file_path)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${document.title}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Stream the file
        const fileStream = fs.createReadStream(document.file_path);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Document download error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin document download (can download any document)
app.get('/api/admin/documents/:documentId/download', authenticateAdmin, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Get document (admin can access any document)
        const result = await pool.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = result.rows[0];

        // Check if file exists
        if (!fs.existsSync(document.file_path)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${document.title}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Stream the file
        const fileStream = fs.createReadStream(document.file_path);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Admin document download error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get all transactions for a specific user
app.get('/api/admin/users/:userId/transactions', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Verify user exists
        const userCheck = await pool.query(
            'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userCheck.rows[0];

        // Get all transactions for user's loan accounts
        const transactionsResult = await pool.query(`
            SELECT 
                lt.*,
                la.account_number,
                la.principal_amount,
                la.current_balance
            FROM loan_transactions lt
            JOIN loan_accounts la ON lt.loan_account_id = la.id
            WHERE la.user_id = $1
            ORDER BY lt.transaction_date DESC, lt.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        // Get total count
        const countResult = await pool.query(`
            SELECT COUNT(*)
            FROM loan_transactions lt
            JOIN loan_accounts la ON lt.loan_account_id = la.id
            WHERE la.user_id = $1
        `, [userId]);

        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email
            },
            transactions: transactionsResult.rows,
            totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Admin user transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get all loans across all users
app.get('/api/admin/loans', authenticateAdmin, async (req, res) => {
    try {
        // Get all loan accounts with user information
        const loansResult = await pool.query(`
            SELECT 
                la.id,
                la.user_id,
                la.account_number,
                la.principal_amount,
                la.current_balance,
                la.monthly_rate,
                la.total_bonuses,
                la.total_withdrawals,
                la.created_at,
                la.updated_at,
                u.first_name,
                u.last_name,
                u.email
            FROM loan_accounts la
            JOIN users u ON la.user_id = u.id
            ORDER BY la.created_at DESC
        `);

        // Get transaction counts for each loan
        const loanIds = loansResult.rows.map(loan => loan.id);
        let transactionCounts = {};
        
        if (loanIds.length > 0) {
            const transactionCountsResult = await pool.query(`
                SELECT 
                    loan_account_id,
                    COUNT(*) as transaction_count,
                    MAX(transaction_date) as last_transaction_date
                FROM loan_transactions 
                WHERE loan_account_id = ANY($1)
                GROUP BY loan_account_id
            `, [loanIds]);

            transactionCounts = transactionCountsResult.rows.reduce((acc, row) => {
                acc[row.loan_account_id] = {
                    count: parseInt(row.transaction_count),
                    lastTransactionDate: row.last_transaction_date
                };
                return acc;
            }, {});
        }

        // Enhance loan data with transaction info and user details
        const enhancedLoans = loansResult.rows.map(loan => ({
            ...loan,
            user: {
                id: loan.user_id,
                firstName: loan.first_name,
                lastName: loan.last_name,
                email: loan.email
            },
            transactionCount: transactionCounts[loan.id]?.count || 0,
            lastTransactionDate: transactionCounts[loan.id]?.lastTransactionDate || null
        }));

        res.json({
            loans: enhancedLoans,
            totalCount: enhancedLoans.length
        });

    } catch (error) {
        console.error('Admin all loans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Toggle user account verification
app.put('/api/admin/users/:userId/verify', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { verified } = req.body;
        const adminUserId = req.user.userId;

        // Verify target user exists
        const userCheck = await pool.query(
            'SELECT id, first_name, last_name, email, account_verified FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = userCheck.rows[0];

        // Prevent admin from verifying themselves (optional business rule)
        if (parseInt(userId) === parseInt(adminUserId)) {
            return res.status(400).json({ error: 'Cannot modify your own verification status' });
        }

        // Update verification status
        if (verified) {
            // Verify the account
            await pool.query(
                'UPDATE users SET account_verified = true, verified_by_admin = $1, verified_at = NOW() WHERE id = $2',
                [adminUserId, userId]
            );
        } else {
            // Unverify the account
            await pool.query(
                'UPDATE users SET account_verified = false, verified_by_admin = NULL, verified_at = NULL WHERE id = $1',
                [userId]
            );
        }

        // Get updated user data
        const updatedUser = await pool.query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.account_verified, u.verified_at,
                   admin_user.first_name as verified_by_first_name, admin_user.last_name as verified_by_last_name
            FROM users u
            LEFT JOIN users admin_user ON u.verified_by_admin = admin_user.id
            WHERE u.id = $1
        `, [userId]);

        res.json({
            message: verified ? 'Account verified successfully' : 'Account verification removed',
            user: updatedUser.rows[0]
        });

    } catch (error) {
        console.error('Admin verify user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create withdrawal request
app.post('/api/withdrawal-requests', authenticateToken, [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('reason').isString().isLength({ min: 1 }).withMessage('Reason is required'),
    body('urgency').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid urgency level'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, reason, urgency = 'normal', notes } = req.body;
        const userId = req.user.userId;

        // Get user's loan account to verify they have sufficient balance
        const loanResult = await pool.query(
            'SELECT id, current_balance FROM loan_accounts WHERE user_id = $1',
            [userId]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'No loan account found' });
        }

        const loanAccount = loanResult.rows[0];
        const currentBalance = parseFloat(loanAccount.current_balance);

        if (amount > currentBalance) {
            return res.status(400).json({ error: 'Withdrawal amount exceeds current balance' });
        }

        // Create withdrawal request
        const requestResult = await pool.query(`
            INSERT INTO withdrawal_requests (user_id, loan_account_id, amount, reason, urgency, notes, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
            RETURNING *
        `, [userId, loanAccount.id, amount, reason, urgency, notes]);

        res.status(201).json({
            message: 'Withdrawal request submitted successfully',
            request: requestResult.rows[0]
        });

    } catch (error) {
        console.error('Withdrawal request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create meeting request
app.post('/api/meeting-requests', authenticateToken, [
    body('purpose').isString().isLength({ min: 1 }).withMessage('Purpose is required'),
    body('preferred_date').isISO8601().withMessage('Valid preferred date required'),
    body('preferred_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time format required (HH:MM)'),
    body('meeting_type').optional().isIn(['video']).withMessage('Only video meetings are supported'),
    body('urgency').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid urgency level'),
    body('topics').optional().isString().withMessage('Topics must be a string'),
    body('notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
    try {
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { 
            purpose, 
            preferred_date, 
            preferred_time, 
            meeting_type = 'video', 
            urgency = 'normal', 
            topics, 
            notes
        } = req.body;
        const userId = req.user.userId;

        // Only video meetings are supported now
        if (meeting_type !== 'video') {
            return res.status(400).json({ error: 'Only video meetings are supported' });
        }

        // Create meeting request
        const requestResult = await pool.query(`
            INSERT INTO meeting_requests (
                user_id, purpose, preferred_date, preferred_time, meeting_type, 
                urgency, topics, notes, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
            RETURNING *
        `, [userId, purpose, preferred_date, preferred_time, meeting_type, urgency, topics, notes]);

        res.status(201).json({
            message: 'Meeting request submitted successfully',
            request: requestResult.rows[0]
        });

    } catch (error) {
        console.error('Meeting request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's withdrawal requests
app.get('/api/withdrawal-requests', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT wr.*, la.account_number, la.current_balance
            FROM withdrawal_requests wr
            JOIN loan_accounts la ON wr.loan_account_id = la.id
            WHERE wr.user_id = $1
        `;
        const params = [userId];

        if (status) {
            query += ' AND wr.status = $2';
            params.push(status);
        }

        query += ' ORDER BY wr.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Get withdrawal requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's meeting requests
app.get('/api/meeting-requests', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM meeting_requests WHERE user_id = $1';
        const params = [userId];

        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Get meeting requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all account verification requests (Admin only)
app.get('/api/admin/verification-requests', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT 
                avr.id,
                avr.user_id,
                avr.status,
                avr.requested_at,
                avr.reviewed_at,
                avr.reviewed_by,
                avr.admin_notes,
                u.first_name,
                u.last_name,
                u.email,
                u.account_verified,
                reviewer.first_name as reviewer_first_name,
                reviewer.last_name as reviewer_last_name
            FROM account_verification_requests avr
            JOIN users u ON avr.user_id = u.id
            LEFT JOIN users reviewer ON avr.reviewed_by = reviewer.id
        `;
        
        const queryParams = [];
        if (status) {
            query += ' WHERE avr.status = $1';
            queryParams.push(status);
        }
        
        query += ' ORDER BY avr.requested_at DESC';
        
        const result = await pool.query(query, queryParams);
        res.json(result.rows);

    } catch (error) {
        console.error('Get verification requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve/reject account verification request (Admin only)
app.put('/api/admin/verification-requests/:requestId', authenticateAdmin, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, admin_notes } = req.body;
        const adminUserId = req.user.userId;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' });
        }

        // Get the verification request
        const requestResult = await pool.query(
            'SELECT user_id FROM account_verification_requests WHERE id = $1',
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Verification request not found' });
        }

        const { user_id } = requestResult.rows[0];

        // Start transaction
        await pool.query('BEGIN');

        try {
            // Update the verification request
            await pool.query(
                `UPDATE account_verification_requests 
                 SET status = $1, reviewed_at = NOW(), reviewed_by = $2, admin_notes = $3 
                 WHERE id = $4`,
                [status, adminUserId, admin_notes, requestId]
            );

            // If approved, update user's account_verified status
            if (status === 'approved') {
                await pool.query(
                    'UPDATE users SET account_verified = true WHERE id = $1',
                    [user_id]
                );
            }

            await pool.query('COMMIT');

            // Get updated request data
            const updatedRequest = await pool.query(
                `SELECT 
                    avr.id,
                    avr.user_id,
                    avr.status,
                    avr.requested_at,
                    avr.reviewed_at,
                    avr.reviewed_by,
                    avr.admin_notes,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.account_verified
                FROM account_verification_requests avr
                JOIN users u ON avr.user_id = u.id
                WHERE avr.id = $1`,
                [requestId]
            );

            res.json({
                message: `Verification request ${status} successfully`,
                request: updatedRequest.rows[0]
            });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Update verification request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get all withdrawal requests
app.get('/api/admin/withdrawal-requests', authenticateAdmin, async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                wr.*,
                u.first_name, u.last_name, u.email,
                la.account_number, la.current_balance
            FROM withdrawal_requests wr
            JOIN users u ON wr.user_id = u.id
            JOIN loan_accounts la ON wr.loan_account_id = la.id
        `;
        const params = [];

        if (status) {
            query += ' WHERE wr.status = $1';
            params.push(status);
        }

        query += ' ORDER BY wr.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Admin get withdrawal requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Update withdrawal request status
app.put('/api/admin/withdrawal-requests/:requestId', authenticateAdmin, [
    body('status').isIn(['pending', 'approved', 'rejected', 'processed']).withMessage('Invalid status'),
    body('admin_notes').optional().isString().withMessage('Admin notes must be a string')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { requestId } = req.params;
        const { status, admin_notes } = req.body;
        const adminUserId = req.user.userId;

        // Update withdrawal request
        const result = await pool.query(`
            UPDATE withdrawal_requests 
            SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [status, admin_notes, adminUserId, requestId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Withdrawal request not found' });
        }

        res.json({
            message: 'Withdrawal request updated successfully',
            request: result.rows[0]
        });

    } catch (error) {
        console.error('Admin update withdrawal request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Get all meeting requests
app.get('/api/admin/meeting-requests', authenticateAdmin, async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                mr.*,
                u.first_name, u.last_name, u.email
            FROM meeting_requests mr
            JOIN users u ON mr.user_id = u.id
        `;
        const params = [];

        if (status) {
            query += ' WHERE mr.status = $1';
            params.push(status);
        }

        query += ' ORDER BY mr.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Admin get meeting requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Update meeting request status
app.put('/api/admin/meeting-requests/:requestId', authenticateAdmin, [
    body('status').isIn(['pending', 'scheduled', 'completed', 'cancelled']).withMessage('Invalid status'),
    body('scheduled_date').optional().isISO8601().withMessage('Valid scheduled date required'),
    body('scheduled_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time format required'),
    body('meeting_link').optional().isString().withMessage('Meeting link must be a string'),
    body('admin_notes').optional().isString().withMessage('Admin notes must be a string')
], async (req, res) => {
    try {
        console.log('Admin meeting update request received:', req.params.requestId, req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { requestId } = req.params;
        const { status, scheduled_date, scheduled_time, meeting_link, admin_notes } = req.body;
        const adminUserId = req.user.userId;

        // Additional validation: if status is 'scheduled', require scheduled_date, scheduled_time, and meeting_link for video meetings
        if (status === 'scheduled') {
            if (!scheduled_date) {
                return res.status(400).json({ error: 'scheduled_date is required when status is scheduled' });
            }
            if (!scheduled_time) {
                return res.status(400).json({ error: 'scheduled_time is required when status is scheduled' });
            }
            
            // Get the meeting request to check type
            const meetingCheck = await pool.query('SELECT meeting_type FROM meeting_requests WHERE id = $1', [requestId]);
            if (meetingCheck.rows.length > 0 && meetingCheck.rows[0].meeting_type === 'video' && !meeting_link) {
                return res.status(400).json({ error: 'meeting_link is required for video meetings when status is scheduled' });
            }
        }

        // Get the original meeting request to check meeting type
        const requestQuery = await pool.query('SELECT * FROM meeting_requests WHERE id = $1', [requestId]);
        if (requestQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting request not found' });
        }
        
        const meetingRequest = requestQuery.rows[0];
        let finalMeetingLink = meeting_link;

        // If scheduling a video meeting, use provided link or create placeholder
        if (status === 'scheduled' && meetingRequest.meeting_type === 'video') {
            console.log('Processing video meeting:', meetingRequest.id);
            
            if (meeting_link && meeting_link.trim()) {
                // Admin provided a meeting link
                finalMeetingLink = meeting_link.trim();
                console.log('Using admin-provided meeting link:', finalMeetingLink);
            } else {
                // No link provided, create placeholder
                const meetingDateTime = `${scheduled_date}T${scheduled_time}:00`;
                
                const placeholderMeeting = await meetingService.createMeeting({
                    topic: meetingRequest.purpose || 'Esoteric Financial Consultation',
                    start_time: meetingDateTime,
                    duration: 60
                });

                console.log('Placeholder meeting result:', placeholderMeeting);

                if (placeholderMeeting.success) {
                    finalMeetingLink = placeholderMeeting.meeting.join_url;
                    console.log('Placeholder meeting created:', finalMeetingLink);
                } else {
                    console.warn('Failed to create placeholder meeting:', placeholderMeeting.error);
                }
            }
        } else {
            console.log('Not processing video meeting - status:', status, 'meeting_type:', meetingRequest.meeting_type);
        }

        // Update meeting request
        const result = await pool.query(`
            UPDATE meeting_requests 
            SET status = $1, scheduled_date = $2, scheduled_time = $3, meeting_link = $4, 
                admin_notes = $5, reviewed_by = $6, reviewed_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [status, scheduled_date, scheduled_time, finalMeetingLink, admin_notes, adminUserId, requestId]);

        res.json({
            message: 'Meeting request updated successfully',
            request: result.rows[0]
        });

    } catch (error) {
        console.error('Admin update meeting request error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});


// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});



// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Server with 2FA running on port ${PORT}`);
        console.log(`🔐 2FA endpoints available at /api/2fa/`);
        console.log(`🔑 Enhanced auth at /api/auth/`);
    });
}

module.exports = app;