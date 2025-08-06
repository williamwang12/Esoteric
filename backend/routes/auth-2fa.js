// Modified Authentication Routes with 2FA Support
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { hashToken } = require('../middleware/2fa');

const router = express.Router();

/**
 * Modified login endpoint with 2FA support
 * First step: username/password verification
 */
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pool } = req.app.locals;
        const { email, password } = req.body;

        // Get user with 2FA status
        const result = await pool.query(`
            SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.requires_2fa,
                   u2fa.is_enabled as has_2fa_enabled
            FROM users u
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            WHERE u.email = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Check if 2FA is required
        if (user.requires_2fa && user.has_2fa_enabled) {
            // Create a temporary session for 2FA completion
            const sessionToken = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    type: 'temp_2fa_session'
                },
                process.env.JWT_SECRET,
                { expiresIn: '10m' } // Short-lived session for 2FA
            );

            // Store session in database
            const sessionHash = hashToken(sessionToken);
            await pool.query(`
                INSERT INTO user_sessions (user_id, token_hash, is_2fa_complete, ip_address, user_agent, expires_at)
                VALUES ($1, $2, false, $3, $4, NOW() + INTERVAL '10 minutes')
            `, [user.id, sessionHash, req.ip, req.get('User-Agent')]);

            return res.json({
                message: 'Password verified. 2FA required.',
                requires_2fa: true,
                session_token: sessionToken,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name
                }
            });
        }

        // No 2FA required - issue full session token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Create full session
        const sessionHash = hashToken(token);
        await pool.query(`
            INSERT INTO user_sessions (user_id, token_hash, is_2fa_complete, ip_address, user_agent, expires_at)
            VALUES ($1, $2, true, $3, $4, NOW() + INTERVAL '24 hours')
        `, [user.id, sessionHash, req.ip, req.get('User-Agent')]);

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

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Complete 2FA login process
 */
router.post('/complete-2fa-login', [
    body('session_token').notEmpty().withMessage('Session token is required'),
    body('totp_token').isLength({ min: 6, max: 8 }).withMessage('TOTP token required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pool } = req.app.locals;
        const { session_token, totp_token } = req.body;

        // Verify the temporary session
        let decoded;
        try {
            decoded = jwt.verify(session_token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired session token' });
        }

        if (decoded.type !== 'temp_2fa_session') {
            return res.status(400).json({ error: 'Invalid session type' });
        }

        // Check session in database
        const sessionHash = hashToken(session_token);
        const sessionResult = await pool.query(`
            SELECT user_id, is_2fa_complete FROM user_sessions 
            WHERE token_hash = $1 AND expires_at > NOW()
        `, [sessionHash]);

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Session not found or expired' });
        }

        const session = sessionResult.rows[0];

        if (session.is_2fa_complete) {
            return res.status(400).json({ error: '2FA already completed' });
        }

        // Verify 2FA token (this should call the 2FA verification endpoint)
        const { verifyTOTP } = require('../middleware/2fa');
        
        const userResult = await pool.query(`
            SELECT secret, backup_codes FROM user_2fa 
            WHERE user_id = $1 AND is_enabled = true
        `, [decoded.userId]);

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: '2FA not properly configured' });
        }

        const { secret, backup_codes } = userResult.rows[0];
        let isValid = false;
        let usedBackupCode = false;

        // Check if it's a backup code or TOTP
        if (totp_token.length === 8) {
            if (backup_codes && backup_codes.includes(totp_token.toUpperCase())) {
                isValid = true;
                usedBackupCode = true;
                
                // Remove used backup code
                const updatedCodes = backup_codes.filter(code => code !== totp_token.toUpperCase());
                await pool.query(
                    'UPDATE user_2fa SET backup_codes = $1 WHERE user_id = $2',
                    [updatedCodes, decoded.userId]
                );
            }
        } else {
            isValid = verifyTOTP(totp_token, secret);
        }

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid 2FA token' });
        }

        // Issue full session token
        const fullToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update session to complete and extend expiry
        const fullSessionHash = hashToken(fullToken);
        await pool.query(`
            UPDATE user_sessions 
            SET token_hash = $1, is_2fa_complete = true, expires_at = NOW() + INTERVAL '24 hours'
            WHERE token_hash = $2
        `, [fullSessionHash, sessionHash]);

        // Update 2FA last used
        await pool.query(
            'UPDATE user_2fa SET last_used = NOW() WHERE user_id = $1',
            [decoded.userId]
        );

        const response = {
            message: 'Login completed successfully',
            token: fullToken,
            user: {
                id: decoded.userId,
                email: decoded.email
            }
        };

        if (usedBackupCode) {
            const remainingCodes = await pool.query(
                'SELECT array_length(backup_codes, 1) as remaining FROM user_2fa WHERE user_id = $1',
                [decoded.userId]
            );
            response.warning = `Backup code used. ${remainingCodes.rows[0]?.remaining || 0} backup codes remaining.`;
        }

        res.json(response);

    } catch (error) {
        console.error('2FA login completion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Logout endpoint with session cleanup
 */
router.post('/logout', async (req, res) => {
    try {
        const { pool } = req.app.locals;
        const token = req.headers.authorization?.split(' ')[1];

        if (token) {
            const sessionHash = hashToken(token);
            await pool.query(
                'DELETE FROM user_sessions WHERE token_hash = $1',
                [sessionHash]
            );
        }

        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;