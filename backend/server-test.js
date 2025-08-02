require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;

// SQLite database connection
const db = new sqlite3.Database('./test.db');

// Create tables if they don't exist
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            phone VARCHAR(20),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Loan accounts table
    db.run(`
        CREATE TABLE IF NOT EXISTS loan_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            account_number VARCHAR(50) UNIQUE NOT NULL,
            principal_amount DECIMAL(15,2) NOT NULL,
            current_balance DECIMAL(15,2) NOT NULL,
            monthly_rate DECIMAL(5,4) DEFAULT 0.01,
            total_bonuses DECIMAL(15,2) DEFAULT 0.00,
            total_withdrawals DECIMAL(15,2) DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Insert demo user if not exists
    bcrypt.hash('demo123456', 12, (err, hash) => {
        if (err) {
            console.error('Error creating demo user hash:', err);
            return;
        }
        
        db.run(
            `INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, phone) 
             VALUES (?, ?, ?, ?, ?)`,
            ['demo@esoteric.com', hash, 'Demo', 'User', '+1234567890'],
            function(err) {
                if (err) {
                    console.error('Error inserting demo user:', err);
                } else if (this.changes > 0) {
                    console.log('✅ Demo user created: demo@esoteric.com / demo123456');
                    
                    // Create demo loan account
                    db.run(
                        `INSERT INTO loan_accounts (user_id, account_number, principal_amount, current_balance, total_bonuses) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [this.lastID, 'ESO-' + Date.now(), 125450.00, 140770.75, 15320.75],
                        (err) => {
                            if (err) {
                                console.error('Error creating demo loan account:', err);
                            } else {
                                console.log('✅ Demo loan account created');
                            }
                        }
                    );
                }
            }
        );
    });
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

    jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Test database connection
app.get('/api/health', async (req, res) => {
    try {
        res.json({ 
            status: 'healthy', 
            database: 'SQLite connected',
            timestamp: new Date().toISOString() 
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
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (row) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user
            db.run(
                'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
                [email, hashedPassword, firstName, lastName, phone],
                function(err) {
                    if (err) {
                        console.error('Registration error:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    const user = {
                        id: this.lastID,
                        email,
                        firstName,
                        lastName
                    };

                    // Generate JWT token
                    const token = jwt.sign(
                        { userId: user.id, email: user.email },
                        process.env.JWT_SECRET || 'test-secret-key',
                        { expiresIn: '24h' }
                    );

                    res.status(201).json({
                        message: 'User created successfully',
                        user,
                        token
                    });
                }
            );
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
        db.get(
            'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?',
            [email],
            async (err, user) => {
                if (err) {
                    console.error('Login database error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                if (!user) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Verify password
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                if (!isValidPassword) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Generate JWT token
                const token = jwt.sign(
                    { userId: user.id, email: user.email },
                    process.env.JWT_SECRET || 'test-secret-key',
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
            }
        );

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile (protected route)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        db.get(
            'SELECT id, email, first_name, last_name, phone, created_at FROM users WHERE id = ?',
            [req.user.userId],
            (err, user) => {
                if (err) {
                    console.error('Profile error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.json({
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    phone: user.phone,
                    createdAt: user.created_at
                });
            }
        );

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's loan accounts
app.get('/api/loans', authenticateToken, async (req, res) => {
    try {
        db.all(
            'SELECT * FROM loan_accounts WHERE user_id = ?',
            [req.user.userId],
            (err, loans) => {
                if (err) {
                    console.error('Loans error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                res.json(loans || []);
            }
        );

    } catch (error) {
        console.error('Loans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout (optional)
app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Esoteric Backend Server (SQLite Test) running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`👤 Demo user: demo@esoteric.com / demo123456`);
}); 