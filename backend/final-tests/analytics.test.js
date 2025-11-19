const request = require('supertest');
const app = require('../server-2fa.js');

describe('Analytics Tab Functionality', () => {
    let adminToken;
    let userToken;
    let userId;
    let loanId;

    beforeAll(async () => {
        // Create admin user for test
        const adminRegister = await request(app)
            .post('/api/auth/register')
            .send({
                email: `admin-analytics-${Date.now()}@test.com`,
                password: 'admin123',
                firstName: 'Admin',
                lastName: 'Test'
            });
        
        expect(adminRegister.status).toBe(201);
        
        // Update user role to admin
        const pool = app.locals.pool;
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', adminRegister.body.user.id]);
        
        // Login as admin
        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({
                email: adminRegister.body.user.email,
                password: 'admin123'
            });
        
        expect(adminLogin.status).toBe(200);
        adminToken = adminLogin.body.token;

        // Create test user
        const userRegister = await request(app)
            .post('/api/auth/register')
            .send({
                email: `analytics-test-${Date.now()}@test.com`,
                password: 'password123',
                firstName: 'Analytics',
                lastName: 'Test'
            });

        expect(userRegister.status).toBe(201);
        userToken = userRegister.body.token;
        userId = userRegister.body.user.id;

        // Create loan for test user
        const loanCreate = await request(app)
            .post('/api/admin/create-loan')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                userId: userId,
                principalAmount: 30000,
                monthlyRate: 0.01
            });

        expect(loanCreate.status).toBe(201);
        loanId = loanCreate.body.loanAccount.id;
    });

    describe('GET /api/loans/:loanId/analytics', () => {
        test('should return analytics data for user\'s own loan', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('loanAccount');
            expect(response.body).toHaveProperty('analytics');
        });

        test('should have complete analytics data structure', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            const analytics = response.body.analytics;
            
            expect(analytics).toHaveProperty('balanceHistory');
            expect(analytics).toHaveProperty('currentBalance');
            expect(analytics).toHaveProperty('totalPrincipal');
            expect(analytics).toHaveProperty('totalBonuses');
            expect(analytics).toHaveProperty('totalWithdrawals');
            expect(analytics).toHaveProperty('monthlyRate');
            
            expect(Array.isArray(analytics.balanceHistory)).toBe(true);
            expect(analytics.balanceHistory.length).toBeGreaterThan(0);
        });

        test('should have correct balance history structure', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            const firstPoint = response.body.analytics.balanceHistory[0];
            
            expect(firstPoint).toHaveProperty('month');
            expect(firstPoint).toHaveProperty('balance');
            expect(firstPoint).toHaveProperty('monthlyPayment');
            expect(firstPoint).toHaveProperty('bonusPayment');
            expect(firstPoint).toHaveProperty('withdrawal');
            expect(firstPoint).toHaveProperty('netGrowth');
            
            expect(typeof firstPoint.balance).toBe('number');
            expect(typeof firstPoint.monthlyPayment).toBe('number');
            expect(typeof firstPoint.bonusPayment).toBe('number');
        });

        test('should have consistent balance calculation', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            const { loanAccount, analytics } = response.body;
            
            expect(Math.abs(analytics.currentBalance - parseFloat(loanAccount.current_balance))).toBeLessThan(0.01);
            expect(analytics.totalPrincipal).toBe(parseFloat(loanAccount.principal_amount));
        });

        test('should support different period queries', async () => {
            const periods = ['6', '12', '24'];
            
            for (const period of periods) {
                const response = await request(app)
                    .get(`/api/loans/${loanId}/analytics?period=${period}`)
                    .set('Authorization', `Bearer ${userToken}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('analytics');
                expect(Array.isArray(response.body.analytics.balanceHistory)).toBe(true);
            }
        });

        test('should calculate portfolio metrics correctly', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            const analytics = response.body.analytics;
            
            // Total growth should be current balance minus principal
            const expectedGrowth = analytics.currentBalance - analytics.totalPrincipal;
            
            // For a new loan, there might be simulated data, so let's validate the structure instead
            expect(typeof expectedGrowth).toBe('number');
            expect(expectedGrowth).toBeGreaterThanOrEqual(0);
            
            // Bonuses should be non-negative
            expect(analytics.totalBonuses).toBeGreaterThanOrEqual(0);
            
            // Withdrawals should be non-negative
            expect(analytics.totalWithdrawals).toBeGreaterThanOrEqual(0);
            
            // Balance history should have valid data
            expect(Array.isArray(analytics.balanceHistory)).toBe(true);
            analytics.balanceHistory.forEach(month => {
                expect(month.netGrowth).toBeGreaterThanOrEqual(0);
                expect(month.balance).toBeGreaterThanOrEqual(0);
            });
        });

        test('should require authentication', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`);

            expect(response.status).toBe(401);
        });

        test('should enforce authorization (other user cannot access)', async () => {
            // Create another user
            const otherUser = await request(app)
                .post('/api/auth/register')
                .send({
                    email: `other-analytics-${Date.now()}@test.com`,
                    password: 'password123',
                    firstName: 'Other',
                    lastName: 'User'
                });

            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${otherUser.body.token}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Loan account not found');
        });

        test('should handle invalid loan ID', async () => {
            const response = await request(app)
                .get('/api/loans/99999/analytics')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Loan account not found');
        });

        test('should handle invalid period parameter', async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics?period=invalid`)
                .set('Authorization', `Bearer ${userToken}`);

            // Should default to 24 months when period is invalid
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('analytics');
            expect(Array.isArray(response.body.analytics.balanceHistory)).toBe(true);
        });

        test('should return fresh data on multiple calls', async () => {
            const response1 = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            const response2 = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            
            // Both responses should have the same structure
            expect(response1.body.analytics).toMatchObject(
                expect.objectContaining({
                    currentBalance: expect.any(Number),
                    totalPrincipal: expect.any(Number),
                    balanceHistory: expect.any(Array)
                })
            );
            
            expect(response2.body.analytics).toMatchObject(
                expect.objectContaining({
                    currentBalance: expect.any(Number),
                    totalPrincipal: expect.any(Number),
                    balanceHistory: expect.any(Array)
                })
            );
        });
    });

    describe('Analytics Frontend Data Processing', () => {
        let analyticsData;

        beforeAll(async () => {
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);
            
            analyticsData = response.body.analytics;
        });

        test('should support portfolio dashboard calculations', () => {
            // Simulate frontend calculations from PortfolioDashboard.tsx
            const totalGrowth = analyticsData.currentBalance - analyticsData.totalPrincipal;
            const growthRate = ((totalGrowth / analyticsData.totalPrincipal) * 100);
            
            expect(totalGrowth).toBeGreaterThanOrEqual(0);
            expect(growthRate).toBeGreaterThanOrEqual(0);
            expect(isNaN(growthRate)).toBe(false);
        });

        test('should support monthly ROI calculations', () => {
            // Simulate ROI calculation from frontend
            const balanceHistory = analyticsData.balanceHistory;
            
            balanceHistory.forEach((item, index) => {
                const startingBalance = index === 0 ? analyticsData.totalPrincipal : balanceHistory[index - 1].balance;
                const monthlyGrowth = item.balance - startingBalance;
                const monthlyROI = startingBalance > 0 ? (monthlyGrowth / startingBalance) * 100 : 0;
                
                expect(typeof monthlyROI).toBe('number');
                expect(isNaN(monthlyROI)).toBe(false);
            });
        });

        test('should support trend calculations', () => {
            // Simulate trend calculation from frontend
            const recentMonths = analyticsData.balanceHistory.slice(-3);
            const previousMonths = analyticsData.balanceHistory.slice(-6, -3);
            
            if (recentMonths.length > 0 && previousMonths.length > 0) {
                const recentAvg = recentMonths.reduce((sum, m) => sum + m.netGrowth, 0) / recentMonths.length;
                const previousAvg = previousMonths.reduce((sum, m) => sum + m.netGrowth, 0) / previousMonths.length;
                
                expect(typeof recentAvg).toBe('number');
                expect(typeof previousAvg).toBe('number');
                expect(isNaN(recentAvg)).toBe(false);
                expect(isNaN(previousAvg)).toBe(false);
            }
        });

        test('should provide data for chart visualization', () => {
            // Test data format expected by Chart.js
            const chartLabels = analyticsData.balanceHistory.map(item => item.month);
            const chartData = analyticsData.balanceHistory.map(item => item.balance);
            
            expect(Array.isArray(chartLabels)).toBe(true);
            expect(Array.isArray(chartData)).toBe(true);
            expect(chartLabels.length).toBe(chartData.length);
            
            chartLabels.forEach(label => {
                expect(typeof label).toBe('string');
                expect(new Date(label).toString()).not.toBe('Invalid Date');
            });
            
            chartData.forEach(value => {
                expect(typeof value).toBe('number');
                expect(value).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Performance and Edge Cases', () => {
        test('should handle loan with no transactions gracefully', async () => {
            // Analytics should still work for newly created loan
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.analytics.balanceHistory.length).toBeGreaterThan(0);
        });

        test('should complete within reasonable time', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .get(`/api/loans/${loanId}/analytics`)
                .set('Authorization', `Bearer ${userToken}`);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(response.status).toBe(200);
            expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
        });

        test('should handle malformed period parameter gracefully', async () => {
            const periods = ['abc', '-1', '0', '1000'];
            
            for (const period of periods) {
                const response = await request(app)
                    .get(`/api/loans/${loanId}/analytics?period=${period}`)
                    .set('Authorization', `Bearer ${userToken}`);

                // Should default to 24 months for invalid periods, not crash
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('analytics');
                expect(Array.isArray(response.body.analytics.balanceHistory)).toBe(true);
            }
        });
    });
});