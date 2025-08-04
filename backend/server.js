require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
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
        // Generate unique filename with timestamp
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
        // Allow common document types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only documents and images are allowed.'));
        }
    }
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        // First authenticate the token
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

// Test database connection
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'healthy', 
            database: 'connected',
            timestamp: result.rows[0].now 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            database: 'disconnected',
            error: error.message 
        });
    }
});

// Authentication Routes

// Register
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().isLength({ min: 1 }),
    body('lastName').trim().isLength({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, firstName, lastName, phone } = req.body;

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name',
            [email, hashedPassword, firstName, lastName, phone]
        );

        const user = result.rows[0];

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const result = await pool.query(
            'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile (protected route)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, phone, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile (protected route)
app.put('/api/user/profile', [
    authenticateToken,
    body('firstName').trim().isLength({ min: 1 }),
    body('lastName').trim().isLength({ min: 1 }),
    body('phone').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, phone } = req.body;

        const result = await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, email, first_name, last_name, phone, updated_at',
            [firstName, lastName, phone, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                updatedAt: user.updated_at
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
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
        const { type, startDate, endDate, limit = 50, offset = 0 } = req.query;

        // Verify the loan belongs to the user
        const loanCheck = await pool.query(
            'SELECT id FROM loan_accounts WHERE id = $1 AND user_id = $2',
            [loanId, req.user.userId]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        // Build query with filters
        let query = `
            SELECT lt.*, la.account_number 
            FROM loan_transactions lt 
            JOIN loan_accounts la ON lt.loan_account_id = la.id 
            WHERE lt.loan_account_id = $1
        `;
        let queryParams = [loanId];
        let paramCount = 1;

        if (type) {
            paramCount++;
            query += ` AND lt.transaction_type = $${paramCount}`;
            queryParams.push(type);
        }

        if (startDate) {
            paramCount++;
            query += ` AND lt.transaction_date >= $${paramCount}`;
            queryParams.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND lt.transaction_date <= $${paramCount}`;
            queryParams.push(endDate);
        }

        query += ` ORDER BY lt.transaction_date DESC, lt.created_at DESC`;
        
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        queryParams.push(parseInt(limit));
        
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        queryParams.push(parseInt(offset));

        const result = await pool.query(query, queryParams);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) FROM loan_transactions lt 
            WHERE lt.loan_account_id = $1
        `;
        let countParams = [loanId];
        let countParamCount = 1;

        if (type) {
            countParamCount++;
            countQuery += ` AND lt.transaction_type = $${countParamCount}`;
            countParams.push(type);
        }

        if (startDate) {
            countParamCount++;
            countQuery += ` AND lt.transaction_date >= $${countParamCount}`;
            countParams.push(startDate);
        }

        if (endDate) {
            countParamCount++;
            countQuery += ` AND lt.transaction_date <= $${countParamCount}`;
            countParams.push(endDate);
        }

        const countResult = await pool.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            transactions: result.rows,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
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

// Get transaction summary
app.get('/api/loans/:loanId/summary', authenticateToken, async (req, res) => {
    try {
        const { loanId } = req.params;

        // Verify the loan belongs to the user
        const loanCheck = await pool.query(
            'SELECT id FROM loan_accounts WHERE id = $1 AND user_id = $2',
            [loanId, req.user.userId]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Loan account not found' });
        }

        // Get transaction summary
        const summaryQuery = `
            SELECT 
                transaction_type,
                COUNT(*) as count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount,
                MAX(transaction_date) as last_transaction
            FROM loan_transactions 
            WHERE loan_account_id = $1
            GROUP BY transaction_type
            ORDER BY transaction_type
        `;

        const summaryResult = await pool.query(summaryQuery, [loanId]);

        res.json({
            summary: summaryResult.rows
        });

    } catch (error) {
        console.error('Transaction summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Document Management Routes

// Get user's documents
app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const { category } = req.query;

        let query = 'SELECT * FROM documents WHERE user_id = $1';
        let queryParams = [req.user.userId];

        if (category) {
            query += ' AND category = $2';
            queryParams.push(category);
        }

        query += ' ORDER BY upload_date DESC';

        const result = await pool.query(query, queryParams);

        res.json(result.rows);

    } catch (error) {
        console.error('Documents error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload document (admin only)
app.post('/api/admin/documents/upload', authenticateAdmin, upload.single('document'), async (req, res) => {
    try {
        const { title, category, userId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate required fields
        if (!title || !category || !userId) {
            return res.status(400).json({ error: 'Title, category, and userId are required' });
        }

        // Verify user exists
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

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

// Download document
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

// Get all users (admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, phone, role, created_at FROM users ORDER BY created_at DESC'
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's loan accounts (admin only)
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

// Get user's documents (admin only)
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

// Delete document (admin only)
app.delete('/api/admin/documents/:documentId', authenticateAdmin, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Get document
        const documentResult = await pool.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (documentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = documentResult.rows[0];

        // Delete from database
        await pool.query(
            'DELETE FROM documents WHERE id = $1',
            [documentId]
        );

        // Delete file from filesystem
        if (fs.existsSync(document.file_path)) {
            fs.unlinkSync(document.file_path);
        }

        res.json({ message: 'Document deleted successfully' });

    } catch (error) {
        console.error('Document delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Esoteric Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📁 Document uploads: ${uploadsDir}`);
}); 