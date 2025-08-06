// Test version of the server that uses SQLite instead of PostgreSQL
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.TEST_PORT || 5002;

// Use SQLite for testing
const dbPath = path.join(__dirname, 'test.db');
const db = new sqlite3.Database(dbPath);

// Initialize test database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Loan accounts table
  db.run(`CREATE TABLE IF NOT EXISTS loan_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    account_number TEXT UNIQUE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    monthly_rate DECIMAL(5,4) DEFAULT 0.01,
    total_bonuses DECIMAL(15,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(15,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Loan transactions table
  db.run(`CREATE TABLE IF NOT EXISTS loan_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_account_id INTEGER,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type TEXT NOT NULL,
    bonus_percentage DECIMAL(5,4),
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_account_id) REFERENCES loan_accounts(id)
  )`);

  // Documents table
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    category TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Insert some test data
  const testUsers = [
    ['demo@esoteric.com', '$2b$10$fdFZDsFAaJdiXMWT8v4OU.pw2v3da2acOuhtfQ6dZHavT7azm/6wK', 'Demo', 'User', '+1234567890', 0],
    ['admin@esoteric.com', '$2b$10$fdFZDsFAaJdiXMWT8v4OU.pw2v3da2acOuhtfQ6dZHavT7azm/6wK', 'Admin', 'User', '+1234567891', 1]
  ];

  const insertUser = db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, phone, is_admin) VALUES (?, ?, ?, ?, ?, ?)`);
  testUsers.forEach(user => insertUser.run(user));
  insertUser.finalize();

  // Insert test loan account
  db.run(`INSERT OR IGNORE INTO loan_accounts (id, user_id, account_number, principal_amount, current_balance, monthly_rate, total_bonuses) 
          VALUES (1, 1, 'LOAN-001', 100000.00, 125000.00, 0.01, 5000.00)`);

  // Insert test transactions
  const testTransactions = [
    [1, 100000.00, 'loan', null, 'Initial loan amount', '2024-01-01'],
    [1, 1000.00, 'monthly_payment', 0.01, 'Monthly payment + 1% base rate', '2024-02-01'],
    [1, 500.00, 'bonus', 0.005, 'Performance bonus payment', '2024-02-15'],
    [1, 1000.00, 'monthly_payment', 0.01, 'Monthly payment + 1% base rate', '2024-03-01']
  ];

  const insertTransaction = db.prepare(`INSERT OR IGNORE INTO loan_transactions (loan_account_id, amount, transaction_type, bonus_percentage, description, transaction_date) VALUES (?, ?, ?, ?, ?, ?)`);
  testTransactions.forEach(transaction => insertTransaction.run(transaction));
  insertTransaction.finalize();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'test-uploads');
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
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user has admin privileges using SQLite
        db.get('SELECT is_admin FROM users WHERE id = ?', [decoded.userId], (err, row) => {
            if (err || !row || !row.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }
            req.user = decoded;
            next();
        });
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Auth endpoints
app.post('/api/auth/register', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, firstName, lastName, phone } = req.body;

        // Check if user already exists
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(400).json({ error: 'User already exists with this email' });
            }

            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Insert new user
            db.run('INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
                [email, passwordHash, firstName, lastName, phone || null],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create user' });
                    }

                    // Generate JWT token
                    const token = jwt.sign(
                        { userId: this.lastID, email: email },
                        process.env.JWT_SECRET,
                        { expiresIn: '24h' }
                    );

                    res.status(201).json({
                        message: 'User registered successfully',
                        user: {
                            id: this.lastID,
                            email: email,
                            firstName: firstName,
                            lastName: lastName
                        },
                        token: token
                    });
                }
            );
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check password
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
                token: token
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

// User endpoints
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        db.get('SELECT id, email, first_name, last_name, phone FROM users WHERE id = ?', 
            [req.user.userId], (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.json({
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    phone: user.phone
                });
            });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/user/profile', [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number')
], authenticateToken, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, phone } = req.body;
        const updates = [];
        const values = [];

        if (firstName) {
            updates.push('first_name = ?');
            values.push(firstName);
        }
        if (lastName) {
            updates.push('last_name = ?');
            values.push(lastName);
        }
        if (phone) {
            updates.push('phone = ?');
            values.push(phone);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(req.user.userId);

        db.run(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values, function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                res.json({
                    message: 'Profile updated successfully',
                    user: {
                        firstName: firstName,
                        lastName: lastName,
                        phone: phone
                    }
                });
            });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Loan endpoints
app.get('/api/loans', authenticateToken, async (req, res) => {
    try {
        db.all('SELECT * FROM loan_accounts WHERE user_id = ?', [req.user.userId], (err, loans) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(loans);
        });
    } catch (error) {
        console.error('Loans fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/loans/:loanId/transactions', authenticateToken, async (req, res) => {
    try {
        const { loanId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        // Verify loan ownership
        db.get('SELECT id FROM loan_accounts WHERE id = ? AND user_id = ?', 
            [loanId, req.user.userId], (err, loan) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!loan) {
                    return res.status(404).json({ error: 'Loan not found' });
                }

                // Get transactions
                db.all(`SELECT * FROM loan_transactions 
                        WHERE loan_account_id = ? 
                        ORDER BY transaction_date DESC, created_at DESC 
                        LIMIT ? OFFSET ?`,
                    [loanId, limit, offset], (err, transactions) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }

                        // Get total count
                        db.get('SELECT COUNT(*) as total FROM loan_transactions WHERE loan_account_id = ?',
                            [loanId], (err, countResult) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Database error' });
                                }

                                res.json({
                                    transactions: transactions,
                                    pagination: {
                                        total: countResult.total,
                                        limit: limit,
                                        offset: offset,
                                        hasMore: offset + limit < countResult.total
                                    }
                                });
                            });
                    });
            });
    } catch (error) {
        console.error('Transactions fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/loans/:loanId/analytics', authenticateToken, async (req, res) => {
    try {
        const { loanId } = req.params;

        // Verify loan ownership
        db.get('SELECT * FROM loan_accounts WHERE id = ? AND user_id = ?', 
            [loanId, req.user.userId], (err, loan) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!loan) {
                    return res.status(404).json({ error: 'Loan not found' });
                }

                // Get monthly analytics
                db.all(`SELECT 
                            strftime('%Y-%m', transaction_date) as month,
                            SUM(CASE WHEN transaction_type = 'monthly_payment' THEN amount ELSE 0 END) as monthlyPayment,
                            SUM(CASE WHEN transaction_type = 'bonus' THEN amount ELSE 0 END) as bonusPayment,
                            SUM(CASE WHEN transaction_type = 'withdrawal' THEN -amount ELSE amount END) as netGrowth
                        FROM loan_transactions 
                        WHERE loan_account_id = ? 
                        GROUP BY strftime('%Y-%m', transaction_date)
                        ORDER BY month`,
                    [loanId], (err, monthlyData) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }

                        // Calculate running balance
                        let runningBalance = parseFloat(loan.principal_amount);
                        const balanceHistory = monthlyData.map(month => {
                            runningBalance += parseFloat(month.netGrowth);
                            return {
                                month: month.month + '-01',
                                balance: runningBalance,
                                monthlyPayment: parseFloat(month.monthlyPayment),
                                bonusPayment: parseFloat(month.bonusPayment),
                                withdrawal: 0, // Simplified for test
                                netGrowth: parseFloat(month.netGrowth)
                            };
                        });

                        res.json({
                            analytics: {
                                balanceHistory: balanceHistory,
                                currentBalance: parseFloat(loan.current_balance),
                                totalPrincipal: parseFloat(loan.principal_amount),
                                totalBonuses: parseFloat(loan.total_bonuses),
                                totalWithdrawals: parseFloat(loan.total_withdrawals),
                                monthlyRate: parseFloat(loan.monthly_rate)
                            }
                        });
                    });
            });
    } catch (error) {
        console.error('Analytics fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Document endpoints
app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM documents WHERE user_id = ?';
        let params = [req.user.userId];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY upload_date DESC';

        db.all(query, params, (err, documents) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(documents);
        });
    } catch (error) {
        console.error('Documents fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/documents/upload', authenticateAdmin, upload.single('document'), async (req, res) => {
    try {
        const { title, category, userId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!title || !category || !userId) {
            return res.status(400).json({ error: 'Title, category, and userId are required' });
        }

        // Verify user exists
        db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Insert document
            db.run('INSERT INTO documents (user_id, title, file_path, file_size, category) VALUES (?, ?, ?, ?, ?)',
                [userId, title, req.file.path, req.file.size, category],
                function(err) {
                    if (err) {
                        // Delete the uploaded file if database insertion fails
                        if (req.file) {
                            fs.unlinkSync(req.file.path);
                        }
                        return res.status(500).json({ error: 'Database error' });
                    }

                    res.status(201).json({
                        message: 'Document uploaded successfully',
                        document: {
                            id: this.lastID,
                            user_id: userId,
                            title: title,
                            file_path: req.file.path,
                            file_size: req.file.size,
                            category: category,
                            upload_date: new Date().toISOString()
                        }
                    });
                });
        });
    } catch (error) {
        console.error('Document upload error:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/documents/:documentId/download', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        db.get('SELECT * FROM documents WHERE id = ? AND user_id = ?',
            [documentId, req.user.userId], (err, document) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!document) {
                    return res.status(404).json({ error: 'Document not found' });
                }

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
            });
    } catch (error) {
        console.error('Document download error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin endpoints
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        db.all('SELECT id, email, first_name, last_name, phone, created_at FROM users ORDER BY created_at DESC',
            (err, users) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json(users);
            });
    } catch (error) {
        console.error('Admin users fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/users/:userId/documents', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        db.all('SELECT * FROM documents WHERE user_id = ? ORDER BY upload_date DESC',
            [userId], (err, documents) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json(documents);
            });
    } catch (error) {
        console.error('Admin user documents fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/documents/:documentId', authenticateAdmin, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Get document info first
        db.get('SELECT * FROM documents WHERE id = ?', [documentId], (err, document) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Delete from database
            db.run('DELETE FROM documents WHERE id = ?', [documentId], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                // Delete file from filesystem
                if (fs.existsSync(document.file_path)) {
                    fs.unlinkSync(document.file_path);
                }

                res.json({ message: 'Document deleted successfully' });
            });
        });
    } catch (error) {
        console.error('Document deletion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    if (error.message === 'Invalid file type. Only documents and images are allowed.') {
        return res.status(400).json({ error: error.message });
    }

    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Export the app for testing
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Test server running on port ${PORT}`);
    });
}

module.exports = app;