// Two-Factor Authentication Middleware
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

// Rate limiting for 2FA attempts
const rateLimiter = new Map();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a new 2FA secret for a user
 */
const generate2FASecret = (userEmail, serviceName = 'Esoteric Enterprises') => {
    const secret = speakeasy.generateSecret({
        name: userEmail,
        issuer: serviceName,
        length: 32
    });
    
    return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        qr_code_url: secret.otpauth_url
    };
};

/**
 * Generate QR code data URL for 2FA setup
 */
const generateQRCode = async (otpauth_url) => {
    try {
        const qrCodeDataURL = await qrcode.toDataURL(otpauth_url);
        return qrCodeDataURL;
    } catch (error) {
        throw new Error('Failed to generate QR code');
    }
};

/**
 * Verify TOTP token
 */
const verifyTOTP = (token, secret, window = 2) => {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window // Allow some time drift
    });
};

/**
 * Generate backup codes
 */
const generateBackupCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }
    return codes;
};

/**
 * Rate limiting middleware for 2FA attempts
 */
const rateLimitTOTP = (req, res, next) => {
    const key = `${req.ip}-${req.user?.userId || 'unknown'}`;
    const now = Date.now();
    
    if (!rateLimiter.has(key)) {
        rateLimiter.set(key, { attempts: 0, resetTime: now + RATE_LIMIT_WINDOW });
    }
    
    const limit = rateLimiter.get(key);
    
    // Reset if window has passed
    if (now > limit.resetTime) {
        limit.attempts = 0;
        limit.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    if (limit.attempts >= MAX_ATTEMPTS) {
        return res.status(429).json({ 
            error: 'Too many 2FA attempts. Please try again later.',
            retryAfter: Math.ceil((limit.resetTime - now) / 1000)
        });
    }
    
    limit.attempts++;
    next();
};

/**
 * Middleware to check if 2FA is completed for the session
 */
const require2FAComplete = async (req, res, next) => {
    try {
        const { pool } = req.app.locals;
        
        // Get session info
        const sessionResult = await pool.query(
            'SELECT is_2fa_complete FROM user_sessions WHERE token_hash = $1 AND expires_at > NOW()',
            [req.sessionTokenHash] // This would need to be set by auth middleware
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Session not found or expired' });
        }
        
        const session = sessionResult.rows[0];
        
        // Check if user requires 2FA
        const userResult = await pool.query(
            'SELECT requires_2fa FROM users WHERE id = $1',
            [req.user.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        if (user.requires_2fa && !session.is_2fa_complete) {
            return res.status(403).json({ 
                error: '2FA verification required',
                requires2FA: true
            });
        }
        
        next();
    } catch (error) {
        console.error('2FA check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Hash a token for storage (to prevent rainbow table attacks)
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Log 2FA attempt
 */
const log2FAAttempt = async (pool, userId, ipAddress, success, tokenUsed) => {
    try {
        await pool.query(
            'INSERT INTO user_2fa_attempts (user_id, ip_address, success, token_used) VALUES ($1, $2, $3, $4)',
            [userId, ipAddress, success, tokenUsed ? tokenUsed.substring(0, 3) + '*' : null]
        );
    } catch (error) {
        console.error('Failed to log 2FA attempt:', error);
    }
};

module.exports = {
    generate2FASecret,
    generateQRCode,
    verifyTOTP,
    generateBackupCodes,
    rateLimitTOTP,
    require2FAComplete,
    hashToken,
    log2FAAttempt
};