# Admin Account Verification System - Standard Operating Procedure (SOP)

## Overview
This SOP outlines the process for testing and using the Admin Account Verification System in the Esoteric Enterprises platform. The system allows admin users to verify/unverify client accounts through the admin dashboard.

## Test Admin Account

### Credentials
- **Email:** `testadmin@esoteric.com`
- **Password:** `TestAdmin123!`
- **Name:** Test Administrator
- **Role:** admin

## System Requirements
- Backend server running on `http://localhost:5002`
- Frontend running on `http://localhost:3000`
- PostgreSQL database with `esoteric_loans` database

## Testing Procedure

### 1. Login to Admin Dashboard
1. Navigate to `http://localhost:3000/login`
2. Enter credentials:
   - Email: `testadmin@esoteric.com`
   - Password: `TestAdmin123!`
3. Click "Sign In"
4. Verify successful login and redirect to dashboard

### 2. Access Admin Panel
1. From the dashboard, click on the "Admin" tab in the top navigation
2. You should see the admin dashboard with a list of all users
3. Verify the "Verification" column is visible in the user table

### 3. Test Account Verification

#### Available Test Users for Verification:
- `newuser@example.com` - New User (unverified)
- `2fa-test-*@test.com` - Various test users (unverified)

#### Verification Process:
1. **Verify an Account:**
   - Locate an unverified user (shows "Unverified" chip)
   - Click the toggle button (ToggleOn icon) next to their verification status
   - Observe the loading state during the API call
   - Verify the status changes to "Verified" with a green checkmark
   - Note the timestamp of verification

2. **Unverify an Account:**
   - Locate a verified user (shows "Verified" chip)
   - Click the toggle button (ToggleOff icon) next to their verification status
   - Observe the loading state during the API call
   - Verify the status changes to "Unverified"

### 4. Verification Data Tracking

The system tracks the following verification data:
- **account_verified**: Boolean status (true/false)
- **verified_by_admin**: ID of admin who performed verification
- **verified_at**: Timestamp of verification action

#### Database Query to Verify Tracking:
```sql
SELECT 
    u.id, 
    u.email, 
    u.first_name, 
    u.last_name, 
    u.account_verified, 
    u.verified_at,
    admin_user.first_name as verified_by_first_name,
    admin_user.last_name as verified_by_last_name
FROM users u
LEFT JOIN users admin_user ON u.verified_by_admin = admin_user.id
WHERE u.account_verified = true;
```

## API Endpoints

### Admin Users List
- **Endpoint:** `GET /api/admin/users`
- **Auth:** Bearer token required
- **Returns:** List of all users with verification status

### Toggle User Verification
- **Endpoint:** `PUT /api/admin/users/:userId/verify`
- **Auth:** Bearer token required (admin role)
- **Body:** `{ "verified": boolean }`
- **Returns:** Updated user verification status

## Expected Behavior

### Success Cases
1. **Successful Verification:**
   - API returns 200 status
   - Database updates verification fields
   - UI shows updated status immediately
   - Loading state clears

2. **Successful Unverification:**
   - API returns 200 status
   - Database clears verification fields
   - UI shows unverified status
   - Loading state clears

### Error Cases
1. **Authentication Failure:**
   - Non-admin users cannot access verification endpoints
   - Invalid tokens are rejected
   - Appropriate error messages displayed

2. **Network Errors:**
   - API failures show error in console
   - Loading state clears
   - Status remains unchanged

## Troubleshooting

### Common Issues

1. **Cannot Access Admin Panel:**
   - Verify user has `role = 'admin'` in database
   - Check authentication token is valid
   - Ensure admin routes are properly configured

2. **Verification Toggle Not Working:**
   - Check network connectivity to backend
   - Verify API endpoint is responding
   - Check browser console for JavaScript errors

3. **Database Connection Issues:**
   - Verify PostgreSQL is running
   - Check database credentials
   - Ensure `esoteric_loans` database exists

### Verification Commands

**Check Admin User Role:**
```sql
SELECT id, email, first_name, last_name, role 
FROM users 
WHERE email = 'testadmin@esoteric.com';
```

**Check Verification Status:**
```sql
SELECT id, email, account_verified, verified_at, verified_by_admin 
FROM users 
ORDER BY verified_at DESC NULLS LAST;
```

**Reset User Verification (if needed):**
```sql
UPDATE users 
SET account_verified = false, verified_by_admin = NULL, verified_at = NULL 
WHERE id = [USER_ID];
```

## Security Notes

1. **Admin Authentication:** Only users with `role = 'admin'` can access verification endpoints
2. **Audit Trail:** All verification actions are logged with admin ID and timestamp
3. **Token Validation:** All requests require valid JWT tokens
4. **Input Validation:** User IDs and verification status are validated server-side

## Test Checklist

- [ ] Admin login successful
- [ ] Admin panel accessible
- [ ] User list displays correctly
- [ ] Verification column visible
- [ ] Can verify unverified account
- [ ] Can unverify verified account
- [ ] Loading states work correctly
- [ ] Database updates properly
- [ ] Audit trail maintained
- [ ] Error handling works for invalid requests
- [ ] Non-admin users cannot access verification features

## Additional Test Users

If you need more test users, create them using:

**Regular User Creation:**
```sql
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at) 
VALUES ('testuser@example.com', '$2b$10$[HASH]', 'Test', 'User', 'user', true, NOW(), NOW());
```

**Admin User Creation:**
```sql
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at) 
VALUES ('admin2@example.com', '$2b$10$[HASH]', 'Admin', 'Two', 'admin', true, NOW(), NOW());
```

---

**Document Version:** 1.0  
**Last Updated:** August 14, 2025  
**Author:** Claude Code  
**System:** Esoteric Enterprises Admin Verification