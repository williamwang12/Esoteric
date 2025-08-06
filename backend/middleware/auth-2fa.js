// Enhanced Authentication Middleware with 2FA Support
const jwt = require('jsonwebtoken');
const { hashToken } = require('./2fa');

/**
 * Enhanced authentication middleware that checks both JWT and session with 2FA status
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Check if it's a temporary 2FA session
        if (decoded.type === 'temp_2fa_session') {
            return res.status(403).json({ 
                error: '2FA verification required',
                requires_2fa: true
            });
        }

        // Check session in database
        const { pool } = req.app.locals;
        const sessionHash = hashToken(token);
        
        const sessionResult = await pool.query(`
            SELECT us.user_id, us.is_2fa_complete, u.requires_2fa, u.email, u.first_name, u.last_name
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.token_hash = $1 AND us.expires_at > NOW()
        `, [sessionHash]);

        if (sessionResult.rows.length === 0) {
            return res.status(403).json({ error: 'Session expired or invalid' });
        }

        const session = sessionResult.rows[0];

        // If user requires 2FA but session is not 2FA complete
        if (session.requires_2fa && !session.is_2fa_complete) {
            return res.status(403).json({ 
                error: '2FA verification required',
                requires_2fa: true
            });
        }

        // Set user information for subsequent middleware
        req.user = {
            userId: session.user_id,
            email: session.email,
            firstName: session.first_name,
            lastName: session.last_name
        };

        req.sessionTokenHash = sessionHash;
        next();

    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Middleware specifically for 2FA endpoints that only require basic JWT validation
 */
const authenticateBasicToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
        next();
    });
};

/**
 * Session cleanup middleware - removes expired sessions
 */
const cleanupExpiredSessions = async (req, res, next) => {
    try {
        const { pool } = req.app.locals;
        
        // Run cleanup periodically (every 100th request)
        if (Math.random() < 0.01) {
            await pool.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
            await pool.query(
                'DELETE FROM user_2fa_attempts WHERE attempted_at < NOW() - INTERVAL \'24 hours\''
            );
        }
        
        next();
    } catch (error) {
        console.error('Session cleanup error:', error);
        next(); // Don't fail the request if cleanup fails
    }
};

module.exports = {
    authenticateToken,
    authenticateBasicToken,
    cleanupExpiredSessions
};