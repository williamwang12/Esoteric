// Enhanced server with 2FA support
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

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
            'SELECT id, email, first_name, last_name, phone, requires_2fa, last_login FROM users WHERE id = $1',
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

// Example admin route with enhanced protection
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // Check admin privileges (this would be enhanced based on your role system)
        const userResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await pool.query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.requires_2fa, u.last_login,
                   u2fa.is_enabled as has_2fa_enabled, u2fa.last_used as last_2fa_use
            FROM users u
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            ORDER BY u.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Admin users fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
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