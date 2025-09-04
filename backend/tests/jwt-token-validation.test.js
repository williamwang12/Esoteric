const jwt = require('jsonwebtoken');

// Use test JWT secret
const JWT_SECRET = 'test-jwt-secret-for-auto-logout-tests';

describe('JWT Token Validation for Auto-Logout', () => {
  
  describe('Token Generation', () => {
    it('should generate tokens with exactly 1-hour expiration', () => {
      const payload = { userId: 1, email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verify the token has correct claims
      expect(decoded.userId).toBe(1);
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      
      // Verify expiration is exactly 1 hour (3600 seconds)
      const tokenLifetime = decoded.exp - decoded.iat;
      expect(tokenLifetime).toBe(3600); // 1 hour in seconds
    });
  });

  describe('Token Expiration Behavior', () => {
    it('should accept valid tokens within expiration window', () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com' }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
      );
      
      // Should not throw
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(1);
    });

    it('should reject expired tokens', () => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'test@example.com' }, 
        JWT_SECRET, 
        { expiresIn: '-1s' } // Already expired
      );
      
      expect(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }).toThrow('jwt expired');
    });

    it('should reject tokens with invalid signature', () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com' }, 
        'wrong-secret', 
        { expiresIn: '1h' }
      );
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow('invalid signature');
    });

    it('should reject malformed tokens', () => {
      const malformedToken = 'not.a.valid.jwt.token';
      
      expect(() => {
        jwt.verify(malformedToken, JWT_SECRET);
      }).toThrow('jwt malformed');
    });
  });

  describe('Token Lifecycle Simulation', () => {
    it('should demonstrate complete token lifecycle', () => {
      // 1. Generate token at login
      const loginTime = Math.floor(Date.now() / 1000);
      const token = jwt.sign(
        { 
          userId: 1, 
          email: 'test@example.com',
          iat: loginTime 
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
      );
      
      // 2. Token should be valid immediately
      let decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(1);
      expect(decoded.iat).toBe(loginTime);
      
      // 3. Calculate when token expires
      const expirationTime = decoded.exp;
      const expectedExpiration = loginTime + 3600; // 1 hour later
      expect(expirationTime).toBe(expectedExpiration);
      
      // 4. Simulate token expiring by creating an expired version
      const expiredToken = jwt.sign(
        { 
          userId: 1, 
          email: 'test@example.com',
          iat: loginTime - 3601, // Issued 1 hour and 1 second ago
        }, 
        JWT_SECRET, 
        { expiresIn: '-1s' }
      );
      
      // 5. Expired token should be rejected
      expect(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }).toThrow('jwt expired');
    });

    it('should verify token expiration timing precision', () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Create token that expires in exactly 1 hour
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        JWT_SECRET,
        { 
          expiresIn: '1h',
          issuer: 'esoteric-loans-app'
        }
      );
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verify precise timing
      expect(decoded.exp - decoded.iat).toBe(3600); // Exactly 1 hour
      expect(decoded.iss).toBe('esoteric-loans-app'); // Correct issuer
      
      // Verify token is valid right now
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('Security Properties', () => {
    it('should include expected security claims', () => {
      const payload = {
        userId: 123,
        email: 'user@example.com',
        role: 'user'
      };
      
      const token = jwt.sign(payload, JWT_SECRET, { 
        expiresIn: '1h',
        issuer: 'esoteric-loans',
        audience: 'esoteric-loans-users'
      });
      
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'esoteric-loans',
        audience: 'esoteric-loans-users'
      });
      
      expect(decoded.userId).toBe(123);
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.role).toBe('user');
      expect(decoded.iss).toBe('esoteric-loans');
      expect(decoded.aud).toBe('esoteric-loans-users');
    });

    it('should prevent token tampering', () => {
      const originalToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      // Attempt to tamper with token by changing payload
      const [header, payload, signature] = originalToken.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      // Try to change userId
      decodedPayload.userId = 999;
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
      const tamperedToken = [header, tamperedPayload, signature].join('.');
      
      // Tampered token should be rejected
      expect(() => {
        jwt.verify(tamperedToken, JWT_SECRET);
      }).toThrow('invalid signature');
    });
  });
});