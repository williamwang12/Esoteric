// Comprehensive Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

/**
 * General API rate limiting
 * Applies to all API endpoints
 */
const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs per IP
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip successful requests to static files
    skip: (req, res) => res.statusCode < 400,
});

/**
 * Strict rate limiting for authentication endpoints
 * Login, registration, password reset, etc.
 */
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per windowMs per IP
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful authentication requests
    skipSuccessfulRequests: true,
});

/**
 * Very strict rate limiting for sensitive operations
 * 2FA setup, password changes, email verification, etc.
 */
const sensitiveRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per windowMs per IP
    message: {
        error: 'Too many sensitive operation attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

/**
 * File upload rate limiting
 * Document uploads, profile pictures, etc.
 */
const uploadRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour per IP
    message: {
        error: 'Too many file uploads, please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Admin operations rate limiting
 * More lenient for admin users but still protected
 */
const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per windowMs per IP
    message: {
        error: 'Too many admin requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Custom rate limiting for specific endpoints
 * Can be used for endpoints that need special handling
 */
const createCustomRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            error: message || 'Too many requests, please try again later.',
            retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

module.exports = {
    generalRateLimit,
    authRateLimit,
    sensitiveRateLimit,
    uploadRateLimit,
    adminRateLimit,
    createCustomRateLimit
};