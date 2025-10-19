// Enhanced server with 2FA support
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for load balancer
app.set('trust proxy', true);

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'esoteric_loans'}`,
    ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Make pool available to routes
app.locals.pool = pool;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false // Allow file uploads
}));

// CORS middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://esoteric-frontend-1760420958.s3-website-us-east-1.amazonaws.com',
        'http://esoteric-frontend-1760847352.s3-website-us-east-1.amazonaws.com'
    ],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import middlewares
const { authenticateToken, authenticateBasicToken, cleanupExpiredSessions } = require('./middleware/auth-2fa');
const { generalRateLimit, authRateLimit, sensitiveRateLimit, uploadRateLimit, adminRateLimit } = require('./middleware/rateLimiting');

// Import services
const meetingService = require('./services/meetingService');

// Apply rate limiting
app.use('/api/', generalRateLimit); // General rate limit for all API endpoints

// HTTPS enforcement middleware (production only)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// Apply session cleanup
app.use(cleanupExpiredSessions);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept all file types for now, you can add restrictions here
        cb(null, true);
    }
});

// Import routes
const auth2faRoutes = require('./routes/auth-2fa');
const twoFARoutes = require('./routes/2fa');

// Root health check for Elastic Beanstalk
app.get('/', (req, res) => {
    res.json({ status: 'healthy', service: 'esoteric-backend' });
});

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

// Authentication routes (with 2FA support) - with strict rate limiting
app.use('/api/auth', authRateLimit, auth2faRoutes);

// 2FA management routes - with sensitive rate limiting
app.use('/api/2fa', sensitiveRateLimit, authenticateBasicToken, twoFARoutes);

// Example protected route
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, phone, role, requires_2fa, last_login, created_at, account_verified FROM users WHERE id = $1',
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
            SELECT id, transaction_type, amount, transaction_date, description, bonus_percentage, created_at
            FROM loan_transactions 
            WHERE ${whereClause}
            ORDER BY created_at DESC, transaction_date DESC 
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        queryParams.push(limit, offset);
        const transactionsResult = await pool.query(transactionsQuery, queryParams);
        
        // Debug: Log the actual data being returned
        console.log('Transaction query result:', JSON.stringify(transactionsResult.rows[0], null, 2));

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
app.get('/api/admin/users', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.requires_2fa, u.last_login, u.created_at,
                   u.account_verified, u.verified_at, u.verified_by_admin,
                   u2fa.is_enabled as has_2fa_enabled, u2fa.last_used as last_2fa_use,
                   COUNT(la.id) as loan_accounts_count,
                   STRING_AGG(la.account_number, ', ' ORDER BY la.created_at) as account_numbers,
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

// Complete withdrawal request (subtract from balance and mark as completed)
app.post('/api/admin/withdrawal-requests/:requestId/complete', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const { requestId } = req.params;
        const adminUserId = req.user.userId;

        // Get withdrawal request details and verify it's approved
        const withdrawalResult = await pool.query(`
            SELECT wr.*, la.id as loan_account_id, la.current_balance
            FROM withdrawal_requests wr
            JOIN loan_accounts la ON wr.loan_account_id = la.id
            WHERE wr.id = $1 AND wr.status = 'approved'
        `, [requestId]);

        if (withdrawalResult.rows.length === 0) {
            return res.status(404).json({ error: 'Approved withdrawal request not found' });
        }

        const withdrawal = withdrawalResult.rows[0];
        const withdrawalAmount = parseFloat(withdrawal.amount);
        const currentBalance = parseFloat(withdrawal.current_balance);

        // Verify sufficient balance (double-check)
        if (withdrawalAmount > currentBalance) {
            return res.status(400).json({ error: 'Insufficient balance to complete withdrawal' });
        }

        // Begin transaction
        await pool.query('BEGIN');

        try {
            // Subtract amount from loan account
            const newBalance = currentBalance - withdrawalAmount;
            await pool.query(`
                UPDATE loan_accounts 
                SET current_balance = $1 
                WHERE id = $2
            `, [newBalance, withdrawal.loan_account_id]);

            // Update withdrawal request to processed
            await pool.query(`
                UPDATE withdrawal_requests 
                SET status = 'processed', reviewed_by = $1, reviewed_at = NOW()
                WHERE id = $2
            `, [adminUserId, requestId]);

            // Create transaction record
            await pool.query(`
                INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, description, transaction_date, created_at)
                VALUES ($1, $2, 'withdrawal', $3, NOW(), NOW())
            `, [withdrawal.loan_account_id, -withdrawalAmount, `Withdrawal: ${withdrawal.reason}`]);

            // Reduce yield deposits in LIFO order (newest first)
            const yieldDepositsResult = await pool.query(`
                SELECT yd.id, yd.principal_amount, yd.start_date, yd.user_id
                FROM yield_deposits yd
                JOIN loan_accounts la ON yd.user_id = la.user_id
                WHERE la.id = $1 AND yd.status = 'active' AND yd.principal_amount > 0
                ORDER BY yd.created_at DESC, yd.id DESC
            `, [withdrawal.loan_account_id]);

            let remainingWithdrawal = withdrawalAmount;
            const depositReductions = [];

            for (const deposit of yieldDepositsResult.rows) {
                if (remainingWithdrawal <= 0) break;

                const currentPrincipal = parseFloat(deposit.principal_amount);
                const reductionAmount = Math.min(remainingWithdrawal, currentPrincipal);
                const newPrincipal = currentPrincipal - reductionAmount;

                // Update deposit principal amount or mark as inactive if fully withdrawn
                if (newPrincipal > 0) {
                    await pool.query(`
                        UPDATE yield_deposits 
                        SET principal_amount = $1
                        WHERE id = $2
                    `, [newPrincipal, deposit.id]);
                } else {
                    // If fully withdrawn, set to $0 and mark as inactive
                    await pool.query(`
                        UPDATE yield_deposits 
                        SET principal_amount = 0, status = 'inactive'
                        WHERE id = $1
                    `, [deposit.id]);
                    console.log(`🔒 Yield deposit #${deposit.id} fully withdrawn - marked as inactive`);
                }

                depositReductions.push({
                    depositId: deposit.id,
                    originalAmount: currentPrincipal,
                    reducedBy: reductionAmount,
                    newAmount: newPrincipal
                });

                remainingWithdrawal -= reductionAmount;

                console.log(`📉 Reduced yield deposit #${deposit.id}: $${currentPrincipal.toFixed(2)} → $${newPrincipal.toFixed(2)} (-$${reductionAmount.toFixed(2)})`);
            }

            if (depositReductions.length > 0) {
                console.log(`💰 Withdrawal processing: Reduced ${depositReductions.length} yield deposits totaling $${withdrawalAmount - remainingWithdrawal}`);
            }

            // Commit transaction
            await pool.query('COMMIT');

            res.json({
                message: 'Withdrawal completed successfully',
                newBalance: newBalance,
                withdrawalAmount: withdrawalAmount
            });

        } catch (error) {
            // Rollback on error
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Complete withdrawal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Create loan account for user
app.post('/api/admin/create-loan', adminRateLimit, authenticateAdmin, [
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
            `INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, description, transaction_date, created_at)
             VALUES ($1, $2, 'loan', 'Initial loan amount', NOW(), NOW())`,
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

// Admin route - Upload document for user
app.post('/api/admin/documents/upload', uploadRateLimit, adminRateLimit, authenticateAdmin, upload.single('document'), async (req, res) => {
    try {
        const { title, category, userId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!title || !category || !userId) {
            return res.status(400).json({ error: 'Title, category, and userId are required' });
        }

        // Verify user exists
        const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            // Delete the uploaded file if user doesn't exist
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ error: 'User not found' });
        }

        // Insert document
        const result = await pool.query(
            'INSERT INTO documents (user_id, title, file_path, file_size, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, title, req.file.path, req.file.size, category]
        );

        res.status(201).json({
            message: 'Document uploaded successfully',
            document: result.rows[0]
        });

    } catch (error) {
        console.error('Document upload error:', error);
        // Delete the uploaded file if database insertion fails
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route - Update loan account
app.put('/api/admin/loans/:loanId', adminRateLimit, authenticateAdmin, [
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
app.post('/api/admin/loans/:loanId/transactions', adminRateLimit, authenticateAdmin, [
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
            `INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, description, transaction_date, created_at, bonus_percentage)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING *`,
            [
                loanId,
                amount,
                transactionType,
                description || `${transactionType} transaction`,
                transactionDate || new Date().toISOString(),
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
app.get('/api/admin/loans/:loanId/transactions', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.delete('/api/admin/loans/:loanId', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/users/:userId/loans', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/users/:userId/documents', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/documents/:documentId/download', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/users/:userId/transactions', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/loans', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.put('/api/admin/users/:userId/verify', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/verification-requests', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.put('/api/admin/verification-requests/:requestId', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.get('/api/admin/withdrawal-requests', adminRateLimit, authenticateAdmin, async (req, res) => {
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
app.put('/api/admin/withdrawal-requests/:requestId', adminRateLimit, authenticateAdmin, [
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
app.get('/api/admin/meeting-requests', adminRateLimit, authenticateAdmin, async (req, res) => {
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

// Admin route - Excel loan amount upload
app.post('/api/admin/loans/excel-upload', uploadRateLimit, adminRateLimit, authenticateAdmin, upload.single('excel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No Excel file uploaded' });
        }

        // Validate file extension
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (!['.xlsx', '.xls'].includes(fileExtension)) {
            // Delete the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Only Excel files (.xlsx, .xls) are allowed' });
        }

        console.log('📊 Processing Excel file:', req.file.originalname);

        // Read the Excel file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('📋 Parsed Excel data:', data.length, 'rows');

        // Validate required columns
        const requiredColumns = ['email', 'new_balance'];
        const processedUpdates = [];
        const errors = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2; // Excel rows start at 1, header is row 1

            // Check required columns
            const missingColumns = requiredColumns.filter(col => !row.hasOwnProperty(col));
            if (missingColumns.length > 0) {
                errors.push(`Row ${rowNumber}: Missing required columns: ${missingColumns.join(', ')}`);
                continue;
            }

            // Validate email
            if (!row.email || typeof row.email !== 'string') {
                errors.push(`Row ${rowNumber}: Invalid email`);
                continue;
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email.trim())) {
                errors.push(`Row ${rowNumber}: Invalid email format`);
                continue;
            }

            // Validate new_balance
            const newBalance = parseFloat(row.new_balance);
            if (isNaN(newBalance) || newBalance < 0) {
                errors.push(`Row ${rowNumber}: Invalid new_balance (must be a positive number)`);
                continue;
            }

            processedUpdates.push({
                email: row.email.trim().toLowerCase(),
                newBalance: newBalance,
                rowNumber: rowNumber
            });
        }

        console.log('✅ Valid updates:', processedUpdates.length);
        console.log('❌ Errors:', errors.length);

        if (errors.length > 0 && processedUpdates.length === 0) {
            // Delete the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                error: 'No valid updates found', 
                errors: errors.slice(0, 10) // Limit to first 10 errors
            });
        }

        // Process updates in transaction
        await pool.query('BEGIN');
        
        const updateResults = [];
        const updateErrors = [];

        try {
            for (const update of processedUpdates) {
                try {
                    // Check if user exists and get their loan account
                    const loanResult = await pool.query(`
                        SELECT la.id, la.user_id, la.current_balance, la.account_number, u.email 
                        FROM loan_accounts la 
                        JOIN users u ON la.user_id = u.id 
                        WHERE LOWER(u.email) = $1
                    `, [update.email]);

                    if (loanResult.rows.length === 0) {
                        updateErrors.push(`Row ${update.rowNumber}: No loan account found for email ${update.email}`);
                        continue;
                    }

                    // If user has multiple loan accounts, update the first one (or we could update all)
                    const loan = loanResult.rows[0];
                    const oldBalance = parseFloat(loan.current_balance);

                    // Update the loan balance
                    await pool.query(
                        'UPDATE loan_accounts SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [update.newBalance, loan.id]
                    );

                    // Create transaction record for the balance change
                    const balanceChange = update.newBalance - oldBalance;
                    const transactionType = balanceChange >= 0 ? 'adjustment_increase' : 'adjustment_decrease';
                    
                    await pool.query(
                        `INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, description, transaction_date, created_at)
                         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
                        [
                            loan.id,
                            Math.abs(balanceChange),
                            transactionType,
                            `Excel bulk update: Balance adjusted from $${oldBalance} to $${update.newBalance}`
                        ]
                    );

                    updateResults.push({
                        email: update.email,
                        accountNumber: loan.account_number,
                        oldBalance: oldBalance,
                        newBalance: update.newBalance,
                        change: balanceChange,
                        userId: loan.user_id
                    });

                    console.log(`💰 Updated ${loan.account_number} (${update.email}): $${oldBalance} → $${update.newBalance} (${balanceChange >= 0 ? '+' : ''}$${balanceChange})`);

                } catch (error) {
                    console.error('Update error for', update.email, ':', error);
                    updateErrors.push(`Row ${update.rowNumber}: Database error for email ${update.email}`);
                }
            }

            await pool.query('COMMIT');
            console.log('✅ Transaction committed successfully');

        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('❌ Transaction rolled back:', error);
            throw error;
        }

        // Delete the uploaded file
        fs.unlinkSync(req.file.path);

        // Prepare response
        const response = {
            message: 'Excel upload processed successfully',
            summary: {
                totalRows: data.length,
                validUpdates: processedUpdates.length,
                successfulUpdates: updateResults.length,
                errors: errors.length + updateErrors.length
            },
            updates: updateResults,
            errors: [...errors, ...updateErrors].slice(0, 20) // Limit errors in response
        };

        if (updateResults.length === 0) {
            return res.status(400).json({
                error: 'No successful updates',
                ...response
            });
        }

        res.json(response);

    } catch (error) {
        // Delete the uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Excel upload error:', error);
        res.status(500).json({ 
            error: 'Internal server error while processing Excel file',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin route - Download Excel template for loan updates
app.get('/api/admin/loans/excel-template', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        // Get actual users with loan accounts from database to create realistic template
        const loanResult = await pool.query(`
            SELECT u.email, la.account_number, la.current_balance 
            FROM loan_accounts la 
            JOIN users u ON la.user_id = u.id 
            ORDER BY la.created_at DESC 
            LIMIT 10
        `);

        let templateData;
        
        if (loanResult.rows.length > 0) {
            // Use real loan data as examples
            templateData = loanResult.rows.map((loan, index) => ({
                email: loan.email,
                account_number: loan.account_number,
                current_balance: parseFloat(loan.current_balance),
                new_balance: parseFloat(loan.current_balance) + (index % 2 === 0 ? 500 : -200), // Example adjustments
                notes: index % 2 === 0 ? 'Monthly interest added' : 'Payment received'
            }));
        } else {
            // Fallback to sample data if no loans exist
            templateData = [
                {
                    email: 'user1@example.com',
                    account_number: 'LOAN-1234567890-1',
                    current_balance: 10000.00,
                    new_balance: 10500.00,
                    notes: 'Monthly interest added'
                },
                {
                    email: 'user2@example.com',
                    account_number: 'LOAN-1234567890-2', 
                    current_balance: 15000.00,
                    new_balance: 14800.00,
                    notes: 'Payment received'
                },
                {
                    email: 'user3@example.com',
                    account_number: 'LOAN-1234567890-3', 
                    current_balance: 8500.00,
                    new_balance: 9000.00,
                    notes: 'Interest adjustment'
                },
                {
                    email: 'user4@example.com',
                    account_number: 'LOAN-1234567890-4', 
                    current_balance: 22000.00,
                    new_balance: 21500.00,
                    notes: 'Partial payment processed'
                },
                {
                    email: 'user5@example.com',
                    account_number: 'LOAN-1234567890-5', 
                    current_balance: 5000.00,
                    new_balance: 5250.00,
                    notes: 'Monthly charge'
                }
            ];
        }

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);

        // Set column widths for better readability
        ws['!cols'] = [
            { width: 25 }, // email
            { width: 25 }, // account_number
            { width: 15 }, // current_balance  
            { width: 15 }, // new_balance
            { width: 30 }  // notes
        ];

        // Style the header row
        const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1'];
        headerCells.forEach(cell => {
            if (ws[cell]) {
                ws[cell].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "366092" } },
                    alignment: { horizontal: "center" }
                };
            }
        });

        // Add the worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Loan Updates');

        // Generate buffer
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        // Set headers
        res.setHeader('Content-Disposition', 'attachment; filename="loan_update_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        res.send(buffer);

    } catch (error) {
        console.error('Template generation error:', error);
        res.status(500).json({ error: 'Failed to generate Excel template' });
    }
});

// Admin route - Excel transaction import
app.post('/api/admin/loans/excel-transactions', uploadRateLimit, adminRateLimit, authenticateAdmin, upload.single('excel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No Excel file uploaded' });
        }

        // Validate file extension
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (!['.xlsx', '.xls'].includes(fileExtension)) {
            // Delete the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Only Excel files (.xlsx, .xls) are allowed' });
        }

        console.log('📊 Processing Excel transaction file:', req.file.originalname);

        // Read the Excel file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('📋 Parsed Excel transaction data:', data.length, 'rows');

        // Validate required columns for transaction import
        const requiredColumns = ['email', 'amount', 'transaction_type', 'transaction_date'];
        const processedTransactions = [];
        const errors = [];

        // Valid transaction types
        const validTransactionTypes = ['loan', 'monthly_payment', 'bonus', 'withdrawal', 'adjustment_increase', 'adjustment_decrease', 'yield_payment'];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2; // Excel rows start at 1, header is row 1

            // Check required columns
            const missingColumns = requiredColumns.filter(col => !row.hasOwnProperty(col));
            if (missingColumns.length > 0) {
                errors.push(`Row ${rowNumber}: Missing required columns: ${missingColumns.join(', ')}`);
                continue;
            }

            // Validate email
            if (!row.email || typeof row.email !== 'string') {
                errors.push(`Row ${rowNumber}: Invalid email`);
                continue;
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email.trim())) {
                errors.push(`Row ${rowNumber}: Invalid email format`);
                continue;
            }

            // Validate amount
            const amount = parseFloat(row.amount);
            if (isNaN(amount) || amount <= 0) {
                errors.push(`Row ${rowNumber}: Invalid amount (must be a positive number)`);
                continue;
            }

            // Validate transaction_type
            if (!row.transaction_type || !validTransactionTypes.includes(row.transaction_type.trim())) {
                errors.push(`Row ${rowNumber}: Invalid transaction_type. Must be one of: ${validTransactionTypes.join(', ')}`);
                continue;
            }

            // Validate transaction_date
            let transactionDate;
            try {
                // Handle Excel date formats (Excel dates are numbers)
                if (typeof row.transaction_date === 'number') {
                    // Excel date serial number to JavaScript date
                    const jsDate = new Date((row.transaction_date - 25569) * 86400 * 1000);
                    // Format as YYYY-MM-DD to avoid timezone issues
                    transactionDate = jsDate.getFullYear() + '-' + 
                                    String(jsDate.getMonth() + 1).padStart(2, '0') + '-' + 
                                    String(jsDate.getDate()).padStart(2, '0');
                } else if (typeof row.transaction_date === 'string') {
                    // If it's already a string, use it directly but validate format
                    const dateStr = row.transaction_date.trim();
                    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        transactionDate = dateStr;
                    } else {
                        // Try to parse and reformat
                        const jsDate = new Date(dateStr);
                        if (isNaN(jsDate.getTime())) {
                            throw new Error('Invalid date');
                        }
                        // Format as YYYY-MM-DD to avoid timezone issues
                        transactionDate = jsDate.getFullYear() + '-' + 
                                        String(jsDate.getMonth() + 1).padStart(2, '0') + '-' + 
                                        String(jsDate.getDate()).padStart(2, '0');
                    }
                } else {
                    throw new Error('Invalid date format');
                }
            } catch (error) {
                errors.push(`Row ${rowNumber}: Invalid transaction_date (use YYYY-MM-DD format)`);
                continue;
            }

            // Validate bonus_percentage if provided
            let bonusPercentage = null;
            if (row.bonus_percentage !== undefined && row.bonus_percentage !== '') {
                bonusPercentage = parseFloat(row.bonus_percentage);
                if (isNaN(bonusPercentage) || bonusPercentage < 0 || bonusPercentage > 1) {
                    errors.push(`Row ${rowNumber}: Invalid bonus_percentage (must be between 0 and 1)`);
                    continue;
                }
            }

            processedTransactions.push({
                email: row.email.trim().toLowerCase(),
                amount: amount,
                transactionType: row.transaction_type.trim(),
                transactionDate: transactionDate,
                bonusPercentage: bonusPercentage,
                description: row.description || '',
                referenceId: row.reference_id || '',
                rowNumber: rowNumber
            });
        }

        console.log('✅ Valid transactions:', processedTransactions.length);
        console.log('❌ Errors:', errors.length);

        if (errors.length > 0 && processedTransactions.length === 0) {
            // Delete the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                error: 'No valid transactions found', 
                errors: errors.slice(0, 10) // Limit to first 10 errors
            });
        }

        // Process transactions in database transaction
        await pool.query('BEGIN');
        
        const transactionResults = [];
        const transactionErrors = [];

        try {
            for (const transaction of processedTransactions) {
                try {
                    // Check if user exists and get their loan account
                    const loanResult = await pool.query(`
                        SELECT la.id, la.user_id, la.current_balance, la.account_number, u.email 
                        FROM loan_accounts la 
                        JOIN users u ON la.user_id = u.id 
                        WHERE LOWER(u.email) = $1
                    `, [transaction.email]);

                    if (loanResult.rows.length === 0) {
                        transactionErrors.push(`Row ${transaction.rowNumber}: No loan account found for email ${transaction.email}`);
                        continue;
                    }

                    const loan = loanResult.rows[0];

                    // Insert transaction record
                    const insertResult = await pool.query(
                        `INSERT INTO loan_transactions (loan_account_id, amount, transaction_type, bonus_percentage, description, reference_id, transaction_date, created_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
                        [
                            loan.id,
                            transaction.amount,
                            transaction.transactionType,
                            transaction.bonusPercentage,
                            transaction.description || `Imported transaction: ${transaction.transactionType}`,
                            transaction.referenceId,
                            transaction.transactionDate
                        ]
                    );

                    // Update loan balance based on transaction type
                    let balanceChange = 0;
                    const currentBalance = parseFloat(loan.current_balance);

                    switch (transaction.transactionType) {
                        case 'loan':
                        case 'monthly_payment':
                        case 'bonus':
                        case 'adjustment_increase':
                            balanceChange = transaction.amount;
                            break;
                        case 'withdrawal':
                        case 'adjustment_decrease':
                            balanceChange = -transaction.amount;
                            break;
                    }

                    const newBalance = currentBalance + balanceChange;

                    // Update loan account balance
                    await pool.query(
                        'UPDATE loan_accounts SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [newBalance, loan.id]
                    );

                    // Update totals if needed
                    if (transaction.transactionType === 'bonus') {
                        await pool.query(
                            'UPDATE loan_accounts SET total_bonuses = total_bonuses + $1 WHERE id = $2',
                            [transaction.amount, loan.id]
                        );
                    } else if (transaction.transactionType === 'withdrawal') {
                        await pool.query(
                            'UPDATE loan_accounts SET total_withdrawals = total_withdrawals + $1 WHERE id = $2',
                            [transaction.amount, loan.id]
                        );
                    }

                    transactionResults.push({
                        id: insertResult.rows[0].id,
                        email: transaction.email,
                        accountNumber: loan.account_number,
                        amount: transaction.amount,
                        transactionType: transaction.transactionType,
                        transactionDate: transaction.transactionDate,
                        balanceChange: balanceChange,
                        newBalance: newBalance,
                        userId: loan.user_id
                    });

                    console.log(`💰 Added transaction for ${loan.account_number} (${transaction.email}): ${transaction.transactionType} $${transaction.amount}`);

                } catch (error) {
                    console.error('Transaction error for', transaction.email, ':', error);
                    transactionErrors.push(`Row ${transaction.rowNumber}: Database error for email ${transaction.email}`);
                }
            }

            await pool.query('COMMIT');
            console.log('✅ Transaction import committed successfully');

        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('❌ Transaction import rolled back:', error);
            throw error;
        }

        // Delete the uploaded file
        fs.unlinkSync(req.file.path);

        // Prepare response
        const response = {
            message: 'Excel transaction import processed successfully',
            summary: {
                totalRows: data.length,
                validTransactions: processedTransactions.length,
                successfulTransactions: transactionResults.length,
                errors: errors.length + transactionErrors.length
            },
            transactions: transactionResults,
            errors: [...errors, ...transactionErrors].slice(0, 20) // Limit errors in response
        };

        if (transactionResults.length === 0) {
            return res.status(400).json({
                error: 'No successful transaction imports',
                ...response
            });
        }

        res.json(response);

    } catch (error) {
        // Delete the uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Excel transaction import error:', error);
        res.status(500).json({ 
            error: 'Internal server error while processing Excel transaction file',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Admin route - Download Excel template for transaction imports
app.get('/api/admin/loans/excel-transactions-template', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        // Get actual users with loan accounts from database to create realistic template
        const loanResult = await pool.query(`
            SELECT u.email, la.account_number 
            FROM loan_accounts la 
            JOIN users u ON la.user_id = u.id 
            ORDER BY la.created_at DESC 
            LIMIT 5
        `);

        let templateData;
        
        if (loanResult.rows.length > 0) {
            // Use real loan data as examples
            templateData = [
                {
                    email: loanResult.rows[0]?.email || 'user1@example.com',
                    amount: 1000.00,
                    transaction_type: 'monthly_payment',
                    transaction_date: '2024-01-15',
                    bonus_percentage: 0.01,
                    description: 'Monthly payment with 1% bonus',
                    reference_id: 'MP-2024-001'
                },
                {
                    email: loanResult.rows[1]?.email || 'user2@example.com',
                    amount: 500.00,
                    transaction_type: 'bonus',
                    transaction_date: '2024-01-20',
                    bonus_percentage: 0.005,
                    description: 'Performance bonus payment',
                    reference_id: 'BONUS-2024-001'
                },
                {
                    email: loanResult.rows[2]?.email || 'user3@example.com',
                    amount: 2000.00,
                    transaction_type: 'withdrawal',
                    transaction_date: '2024-01-25',
                    bonus_percentage: '',
                    description: 'Withdrawal request',
                    reference_id: 'WD-2024-001'
                }
            ];
        } else {
            // Fallback to sample data if no loans exist
            templateData = [
                {
                    email: 'user1@example.com',
                    amount: 1000.00,
                    transaction_type: 'monthly_payment',
                    transaction_date: '2024-01-15',
                    bonus_percentage: 0.01,
                    description: 'Monthly payment with 1% bonus',
                    reference_id: 'MP-2024-001'
                },
                {
                    email: 'user2@example.com',
                    amount: 500.00,
                    transaction_type: 'bonus',
                    transaction_date: '2024-01-20',
                    bonus_percentage: 0.005,
                    description: 'Performance bonus payment',
                    reference_id: 'BONUS-2024-001'
                },
                {
                    email: 'user3@example.com',
                    amount: 2000.00,
                    transaction_type: 'withdrawal',
                    transaction_date: '2024-01-25',
                    bonus_percentage: '',
                    description: 'Withdrawal request',
                    reference_id: 'WD-2024-001'
                }
            ];
        }

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);

        // Set column widths for better readability
        ws['!cols'] = [
            { width: 25 }, // email
            { width: 15 }, // amount
            { width: 20 }, // transaction_type
            { width: 15 }, // transaction_date
            { width: 18 }, // bonus_percentage
            { width: 30 }, // description
            { width: 20 }  // reference_id
        ];

        // Add the workbook to the response
        XLSX.utils.book_append_sheet(wb, ws, 'Transaction Template');

        // Generate buffer
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="transaction_import_template.xlsx"');

        res.send(excelBuffer);

    } catch (error) {
        console.error('Transaction template generation error:', error);
        res.status(500).json({ error: 'Failed to generate Excel transaction template' });
    }
});

// Admin route - Update meeting request status
app.put('/api/admin/meeting-requests/:requestId', adminRateLimit, authenticateAdmin, [
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

// =====================================================================
// YIELD DEPOSITS API ENDPOINTS
// =====================================================================

// Get all yield deposits with optional filtering
app.get('/api/admin/yield-deposits', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const { status, user_id, start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                yd.*,
                u.email,
                u.first_name,
                u.last_name,
                COALESCE(user_balances.total_balance, 0) as account_balance
            FROM yield_deposits yd
            JOIN users u ON yd.user_id = u.id
            LEFT JOIN (
                SELECT user_id, SUM(current_balance) as total_balance
                FROM loan_accounts 
                GROUP BY user_id
            ) user_balances ON user_balances.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;
        
        if (status) {
            paramCount++;
            query += ` AND yd.status = $${paramCount}`;
            params.push(status);
        }
        
        if (user_id) {
            paramCount++;
            query += ` AND yd.user_id = $${paramCount}`;
            params.push(user_id);
        }
        
        if (start_date) {
            paramCount++;
            query += ` AND yd.start_date >= $${paramCount}`;
            params.push(start_date);
        }
        
        if (end_date) {
            paramCount++;
            query += ` AND yd.start_date <= $${paramCount}`;
            params.push(end_date);
        }
        
        query += ` ORDER BY yd.created_at DESC`;
        
        const result = await pool.query(query, params);
        
        // Calculate next payout dates and amounts
        const deposits = result.rows.map(deposit => {
            const nextPayoutDate = calculateNextPayoutDate(deposit.start_date, deposit.last_payout_date);
            const annualPayout = parseFloat(deposit.principal_amount) * parseFloat(deposit.annual_yield_rate);
            
            return {
                ...deposit,
                next_payout_date: nextPayoutDate,
                annual_payout: annualPayout.toFixed(2)
            };
        });
        
        res.json(deposits);
    } catch (error) {
        console.error('Error fetching yield deposits:', error);
        res.status(500).json({ error: 'Failed to fetch yield deposits' });
    }
});

// Create new yield deposit
app.post('/api/admin/yield-deposits', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const { user_id, principal_amount, start_date, annual_yield_rate = 0.12, notes } = req.body;
        
        // Validation
        if (!user_id || !principal_amount || !start_date) {
            return res.status(400).json({ error: 'user_id, principal_amount, and start_date are required' });
        }
        
        if (parseFloat(principal_amount) <= 0) {
            return res.status(400).json({ error: 'Principal amount must be greater than 0' });
        }
        
        // Verify user exists and has a loan account
        const userResult = await pool.query(`
            SELECT u.id, u.email, la.id as loan_account_id
            FROM users u
            LEFT JOIN loan_accounts la ON la.user_id = u.id
            WHERE u.id = $1
        `, [user_id]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!userResult.rows[0].loan_account_id) {
            return res.status(400).json({ error: 'User does not have a loan account' });
        }
        
        // Start a database transaction
        const client = await pool.connect();
        let deposit;
        
        try {
            await client.query('BEGIN');
            
            // Create the deposit
            const insertResult = await client.query(`
                INSERT INTO yield_deposits (
                    user_id, principal_amount, annual_yield_rate, start_date, 
                    created_by, notes, status
                ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
                RETURNING *
            `, [user_id, principal_amount, annual_yield_rate, start_date, req.user.id, notes]);
            
            deposit = insertResult.rows[0];
            
            // Add principal amount to user's account balance
            await client.query(`
                UPDATE loan_accounts 
                SET current_balance = current_balance + $1
                WHERE user_id = $2
            `, [principal_amount, user_id]);
            
            // Create a transaction record for the deposit
            await client.query(`
                INSERT INTO loan_transactions (
                    loan_account_id, amount, transaction_type, description, transaction_date
                ) VALUES ($1, $2, 'yield_deposit', $3, $4)
            `, [userResult.rows[0].loan_account_id, principal_amount, `Yield deposit principal - ${annual_yield_rate * 100}% annual yield`, start_date]);
            
            await client.query('COMMIT');
            
            console.log(`💰 Created yield deposit: ${deposit.id} for user ${userResult.rows[0].email} - $${principal_amount} (added to balance)`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
        res.status(201).json({
            ...deposit,
            user_email: userResult.rows[0].email,
            annual_payout: (parseFloat(principal_amount) * parseFloat(annual_yield_rate)).toFixed(2)
        });
        
    } catch (error) {
        console.error('Error creating yield deposit:', error);
        res.status(500).json({ error: 'Failed to create yield deposit' });
    }
});

// Update yield deposit
app.put('/api/admin/yield-deposits/:id', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, principal_amount } = req.body;
        
        // Build dynamic update query
        const updateFields = [];
        const params = [];
        let paramCount = 0;
        
        if (status !== undefined) {
            paramCount++;
            updateFields.push(`status = $${paramCount}`);
            params.push(status);
        }
        
        if (notes !== undefined) {
            paramCount++;
            updateFields.push(`notes = $${paramCount}`);
            params.push(notes);
        }
        
        if (principal_amount !== undefined) {
            if (parseFloat(principal_amount) <= 0) {
                return res.status(400).json({ error: 'Principal amount must be greater than 0' });
            }
            paramCount++;
            updateFields.push(`principal_amount = $${paramCount}`);
            params.push(principal_amount);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        paramCount++;
        params.push(id);
        
        const query = `
            UPDATE yield_deposits 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;
        
        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Yield deposit not found' });
        }
        
        console.log(`📝 Updated yield deposit ${id}: ${updateFields.join(', ')}`);
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error updating yield deposit:', error);
        res.status(500).json({ error: 'Failed to update yield deposit' });
    }
});

// Manual payout trigger
app.post('/api/admin/yield-deposits/:id/payout', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { payout_date = new Date().toISOString().split('T')[0] } = req.body;
        
        const result = await processYieldPayout(id, payout_date, req.user.id);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json({ error: result.error });
        }
        
    } catch (error) {
        console.error('Error processing manual payout:', error);
        res.status(500).json({ error: 'Failed to process payout' });
    }
});

// Get yield deposit details with payout history
app.get('/api/admin/yield-deposits/:id', adminRateLimit, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get deposit details
        const depositResult = await pool.query(`
            SELECT 
                yd.*,
                u.email,
                u.first_name,
                u.last_name
            FROM yield_deposits yd
            JOIN users u ON yd.user_id = u.id
            WHERE yd.id = $1
        `, [id]);
        
        if (depositResult.rows.length === 0) {
            return res.status(404).json({ error: 'Yield deposit not found' });
        }
        
        // Get payout history
        const payoutsResult = await pool.query(`
            SELECT 
                yp.*,
                lt.description as transaction_description
            FROM yield_payouts yp
            LEFT JOIN loan_transactions lt ON yp.transaction_id = lt.id
            WHERE yp.deposit_id = $1
            ORDER BY yp.payout_date DESC
        `, [id]);
        
        const deposit = depositResult.rows[0];
        const nextPayoutDate = calculateNextPayoutDate(deposit.start_date, deposit.last_payout_date);
        const annualPayout = parseFloat(deposit.principal_amount) * parseFloat(deposit.annual_yield_rate);
        
        res.json({
            ...deposit,
            next_payout_date: nextPayoutDate,
            annual_payout: annualPayout.toFixed(2),
            payouts: payoutsResult.rows
        });
        
    } catch (error) {
        console.error('Error fetching yield deposit details:', error);
        res.status(500).json({ error: 'Failed to fetch yield deposit details' });
    }
});

// Helper function to calculate next payout date
function calculateNextPayoutDate(startDate, lastPayoutDate) {
    const start = new Date(startDate);
    const today = new Date();
    const lastPayout = lastPayoutDate ? new Date(lastPayoutDate) : null;
    
    // Calculate how many years since start
    let yearsSinceStart = 0;
    let nextPayout = new Date(start);
    
    while (nextPayout <= today) {
        yearsSinceStart++;
        nextPayout = new Date(start);
        nextPayout.setFullYear(start.getFullYear() + yearsSinceStart);
    }
    
    // If we already paid out for this year, move to next year
    if (lastPayout && lastPayout >= new Date(start.setFullYear(start.getFullYear() + yearsSinceStart - 1))) {
        nextPayout.setFullYear(nextPayout.getFullYear() + 1);
    }
    
    return nextPayout.toISOString().split('T')[0];
}

// Helper function to process yield payout
async function processYieldPayout(depositId, payoutDate, processedBy) {
    try {
        await pool.query('BEGIN');
        
        // Get deposit details
        const depositResult = await pool.query(`
            SELECT yd.*, u.email, la.id as loan_account_id
            FROM yield_deposits yd
            JOIN users u ON yd.user_id = u.id
            JOIN loan_accounts la ON la.user_id = u.id
            WHERE yd.id = $1 AND yd.status = 'active'
        `, [depositId]);
        
        if (depositResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return { success: false, error: 'Deposit not found or not active' };
        }
        
        const deposit = depositResult.rows[0];
        const payoutAmount = parseFloat(deposit.principal_amount) * parseFloat(deposit.annual_yield_rate);
        
        // Check if payout already exists for this date
        const existingPayout = await pool.query(`
            SELECT id FROM yield_payouts 
            WHERE deposit_id = $1 AND payout_date = $2
        `, [depositId, payoutDate]);
        
        if (existingPayout.rows.length > 0) {
            await pool.query('ROLLBACK');
            return { success: false, error: 'Payout already exists for this date' };
        }
        
        // Create transaction
        const transactionResult = await pool.query(`
            INSERT INTO loan_transactions (
                loan_account_id, amount, transaction_type, description, 
                transaction_date, created_at
            ) VALUES ($1, $2, 'yield_payment', $3, $4, NOW())
            RETURNING id
        `, [
            deposit.loan_account_id,
            payoutAmount,
            `12% yield payment for deposit #${depositId}`,
            payoutDate
        ]);
        
        const transactionId = transactionResult.rows[0].id;
        
        // Update loan account balance
        await pool.query(`
            UPDATE loan_accounts 
            SET current_balance = current_balance + $1
            WHERE id = $2
        `, [payoutAmount, deposit.loan_account_id]);
        
        // Create payout record
        const payoutResult = await pool.query(`
            INSERT INTO yield_payouts (
                deposit_id, amount, payout_date, transaction_id, processed_by
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [depositId, payoutAmount, payoutDate, transactionId, processedBy]);
        
        // Update deposit last payout date and total paid out
        await pool.query(`
            UPDATE yield_deposits 
            SET last_payout_date = $1, total_paid_out = total_paid_out + $2
            WHERE id = $3
        `, [payoutDate, payoutAmount, depositId]);
        
        await pool.query('COMMIT');
        
        console.log(`💰 Processed yield payout: $${payoutAmount} for deposit ${depositId} (${deposit.email})`);
        
        return {
            success: true,
            payout: payoutResult.rows[0],
            transaction_id: transactionId,
            amount: payoutAmount
        };
        
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error processing yield payout:', error);
        throw error;
    }
}


// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});



// Multer error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + error.message });
    }
    next(error);
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