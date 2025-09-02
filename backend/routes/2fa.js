// Two-Factor Authentication Routes
const express = require('express');
const { body, validationResult } = require('express-validator');
const { 
    generate2FASecret, 
    generateQRCode, 
    verifyTOTP, 
    generateBackupCodes,
    rateLimitTOTP,
    hashToken,
    log2FAAttempt
} = require('../middleware/2fa');

const router = express.Router();

/**
 * POST /api/2fa/setup
 * Initialize 2FA setup for a user
 */
router.post('/setup', async (req, res) => {
    try {
        const { pool } = req.app.locals;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        // Check if user already has 2FA setup
        const existing2FA = await pool.query(
            'SELECT id, is_enabled FROM user_2fa WHERE user_id = $1',
            [userId]
        );

        if (existing2FA.rows.length > 0 && existing2FA.rows[0].is_enabled) {
            return res.status(400).json({ 
                error: '2FA is already enabled for this account' 
            });
        }

        // Generate new secret
        const { secret, otpauth_url } = generate2FASecret(userEmail);
        const qrCodeDataURL = await generateQRCode(otpauth_url);

        // Store secret (not enabled yet)
        if (existing2FA.rows.length > 0) {
            // Update existing record
            await pool.query(
                'UPDATE user_2fa SET secret = $1 WHERE user_id = $2',
                [secret, userId]
            );
        } else {
            // Create new record
            await pool.query(
                'INSERT INTO user_2fa (user_id, secret) VALUES ($1, $2)',
                [userId, secret]
            );
        }

        res.json({
            message: 'Scan the QR code with your authenticator app',
            qrCode: qrCodeDataURL,
            manualEntryKey: secret,
            backupCodes: null // Will be provided after verification
        });

    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({ error: 'Failed to setup 2FA' });
    }
});

/**
 * POST /api/2fa/verify-setup
 * Complete 2FA setup by verifying the first token
 */
router.post('/verify-setup', [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Token must be 6 digits')
], rateLimitTOTP, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pool } = req.app.locals;
        const { token } = req.body;
        const userId = req.user.userId;

        // Get the secret
        const result = await pool.query(
            'SELECT secret, is_enabled FROM user_2fa WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: '2FA setup not initiated' });
        }

        const { secret, is_enabled } = result.rows[0];

        if (is_enabled) {
            return res.status(400).json({ error: '2FA is already enabled' });
        }

        // Verify the token
        const isValid = verifyTOTP(token, secret);
        
        // Log attempt
        await log2FAAttempt(pool, userId, req.ip, isValid, token);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Generate backup codes
        const backupCodes = generateBackupCodes();

        // Enable 2FA and store backup codes
        await pool.query(
            'UPDATE user_2fa SET is_enabled = true, backup_codes = $1, last_used = NOW() WHERE user_id = $2',
            [backupCodes, userId]
        );

        // Mark user as requiring 2FA
        await pool.query(
            'UPDATE users SET requires_2fa = true WHERE id = $1',
            [userId]
        );

        res.json({
            message: '2FA has been successfully enabled',
            backupCodes: backupCodes,
            warning: 'Store these backup codes safely. They can only be used once and will not be shown again.'
        });

    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA setup' });
    }
});

/**
 * POST /api/2fa/verify
 * Verify 2FA token during login
 */
router.post('/verify', [
    body('token').isLength({ min: 6, max: 8 }).withMessage('Token must be 6-8 characters'),
    body('sessionToken').notEmpty().withMessage('Session token is required')
], rateLimitTOTP, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pool } = req.app.locals;
        const { token, sessionToken } = req.body;

        // Verify session token
        const sessionResult = await pool.query(
            'SELECT user_id, is_2fa_complete FROM user_sessions WHERE token_hash = $1 AND expires_at > NOW()',
            [hashToken(sessionToken)]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        const { user_id: userId, is_2fa_complete } = sessionResult.rows[0];

        if (is_2fa_complete) {
            return res.status(400).json({ error: '2FA already completed for this session' });
        }

        // Get user's 2FA secret
        const result = await pool.query(
            'SELECT secret, backup_codes FROM user_2fa WHERE user_id = $1 AND is_enabled = true',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: '2FA not enabled for this user' });
        }

        const { secret, backup_codes } = result.rows[0];
        let isValid = false;
        let usedBackupCode = false;

        // Check if it's a backup code (8 characters) or TOTP (6 digits)
        if (token.length === 8) {
            // Backup code verification
            if (backup_codes && backup_codes.includes(token.toUpperCase())) {
                isValid = true;
                usedBackupCode = true;

                // Remove used backup code
                const updatedCodes = backup_codes.filter(code => code !== token.toUpperCase());
                await pool.query(
                    'UPDATE user_2fa SET backup_codes = $1 WHERE user_id = $2',
                    [updatedCodes, userId]
                );
            }
        } else {
            // TOTP verification
            isValid = verifyTOTP(token, secret);
        }

        // Log attempt
        await log2FAAttempt(pool, userId, req.ip, isValid, token);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Mark session as 2FA complete
        await pool.query(
            'UPDATE user_sessions SET is_2fa_complete = true WHERE token_hash = $1',
            [hashToken(sessionToken)]
        );

        // Update last used time
        await pool.query(
            'UPDATE user_2fa SET last_used = NOW() WHERE user_id = $1',
            [userId]
        );

        const response = {
            message: '2FA verification successful',
            session_complete: true
        };

        if (usedBackupCode) {
            const remainingCodes = await pool.query(
                'SELECT array_length(backup_codes, 1) as remaining FROM user_2fa WHERE user_id = $1',
                [userId]
            );
            response.warning = `Backup code used. ${remainingCodes.rows[0]?.remaining || 0} backup codes remaining.`;
        }

        res.json(response);

    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

/**
 * POST /api/2fa/disable
 * Disable 2FA for a user
 */
router.post('/disable', [
    body('token').isLength({ min: 6, max: 8 }).withMessage('Verification code required'),
    body('password').isLength({ min: 8 }).withMessage('Password is required')
], rateLimitTOTP, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pool } = req.app.locals;
        const { token, password } = req.body;
        const userId = req.user.userId;

        // Verify password first
        const userResult = await pool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);

        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Get 2FA secret
        const result = await pool.query(
            'SELECT secret, backup_codes FROM user_2fa WHERE user_id = $1 AND is_enabled = true',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: '2FA is not enabled' });
        }

        const { secret, backup_codes } = result.rows[0];
        let isValid = false;

        // Verify token (TOTP or backup code)
        if (token.length === 8) {
            isValid = backup_codes && backup_codes.includes(token.toUpperCase());
        } else {
            isValid = verifyTOTP(token, secret);
        }

        // Log attempt
        await log2FAAttempt(pool, userId, req.ip, isValid, token);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Disable 2FA
        await pool.query(
            'UPDATE user_2fa SET is_enabled = false, backup_codes = NULL WHERE user_id = $1',
            [userId]
        );

        await pool.query(
            'UPDATE users SET requires_2fa = false WHERE id = $1',
            [userId]
        );

        res.json({ message: '2FA has been successfully disabled' });

    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

/**
 * GET /api/2fa/status
 * Get 2FA status for current user
 */
router.get('/status', async (req, res) => {
    try {
        const { pool } = req.app.locals;
        const userId = req.user.userId;

        const result = await pool.query(
            'SELECT is_enabled, last_used, qr_code_shown_at, array_length(backup_codes, 1) as backup_count FROM user_2fa WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.json({
                enabled: false,
                setup_initiated: false
            });
        }

        const { is_enabled, last_used, qr_code_shown_at, backup_count } = result.rows[0];

        res.json({
            enabled: is_enabled,
            setup_initiated: qr_code_shown_at !== null,
            last_used: last_used,
            backup_codes_remaining: backup_count || 0
        });

    } catch (error) {
        console.error('2FA status error:', error);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

/**
 * POST /api/2fa/generate-backup-codes
 * Generate new backup codes (requires 2FA verification)
 */
router.post('/generate-backup-codes', [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('TOTP token required')
], rateLimitTOTP, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pool } = req.app.locals;
        const { token } = req.body;
        const userId = req.user.userId;

        // Get 2FA secret
        const result = await pool.query(
            'SELECT secret FROM user_2fa WHERE user_id = $1 AND is_enabled = true',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: '2FA is not enabled' });
        }

        const { secret } = result.rows[0];

        // Verify TOTP token
        const isValid = verifyTOTP(token, secret);
        
        // Log attempt
        await log2FAAttempt(pool, userId, req.ip, isValid, token);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Generate new backup codes
        const newBackupCodes = generateBackupCodes();

        // Update backup codes
        await pool.query(
            'UPDATE user_2fa SET backup_codes = $1 WHERE user_id = $2',
            [newBackupCodes, userId]
        );

        res.json({
            message: 'New backup codes generated',
            backupCodes: newBackupCodes,
            warning: 'These new codes replace all previous backup codes. Store them safely.'
        });

    } catch (error) {
        console.error('Backup codes generation error:', error);
        res.status(500).json({ error: 'Failed to generate backup codes' });
    }
});

module.exports = router;