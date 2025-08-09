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
                   u2fa.is_enabled as has_2fa_enabled, u2fa.last_used as last_2fa_use,
                   COUNT(la.id) as loan_accounts_count
            FROM users u
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            LEFT JOIN loan_accounts la ON u.id = la.user_id
            GROUP BY u.id, u2fa.is_enabled, u2fa.last_used, u.created_at
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