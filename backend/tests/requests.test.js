const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-requests-suite';

// Import test server
const app = require('../server-2fa.js');

describe('Withdrawal and Meeting Requests API Tests', () => {
  let regularUserToken = '';
  let adminUserToken = '';
  let testUserId = '';
  let testLoanId = '';
  let testWithdrawalRequestId = '';
  let testMeetingRequestId = '';

  beforeAll(async () => {
    // Login with demo user
    const demoLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@esoteric.com',
        password: 'demo123456'
      });

    if (demoLoginResponse.status === 200) {
      regularUserToken = demoLoginResponse.body.token;
      testUserId = demoLoginResponse.body.user.id;
    }

    // Login with admin user (assuming admin exists or use demo user with admin role)
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@esoteric.com',
        password: 'admin123456'
      });

    if (adminLoginResponse.status === 200) {
      adminUserToken = adminLoginResponse.body.token;
    } else {
      // If admin doesn't exist, use demo user token (since demo user is set as admin in the code)
      adminUserToken = regularUserToken;
    }

    // Get user's loan account ID for testing
    const loansResponse = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${regularUserToken}`);
    
    if (loansResponse.status === 200 && loansResponse.body.length > 0) {
      testLoanId = loansResponse.body[0].id;
    }
  });

  describe('Withdrawal Requests', () => {
    describe('POST /api/withdrawal-requests', () => {
      test('should create a withdrawal request with valid data', async () => {
        const withdrawalData = {
          amount: 1000.00,
          reason: 'Emergency medical expenses',
          urgency: 'high',
          notes: 'Need funds for urgent medical treatment'
        };

        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(withdrawalData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Withdrawal request submitted successfully',
          request: expect.objectContaining({
            id: expect.any(Number),
            user_id: testUserId,
            amount: '1000.00',
            reason: withdrawalData.reason,
            urgency: withdrawalData.urgency,
            notes: withdrawalData.notes,
            status: 'pending'
          })
        });

        testWithdrawalRequestId = response.body.request.id;
      });

      test('should fail with invalid amount', async () => {
        const withdrawalData = {
          amount: 0,
          reason: 'Test reason',
          urgency: 'normal'
        };

        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(withdrawalData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Amount must be greater than 0'
            })
          ])
        );
      });

      test('should fail with missing reason', async () => {
        const withdrawalData = {
          amount: 500,
          urgency: 'normal'
        };

        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(withdrawalData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Reason is required'
            })
          ])
        );
      });

      test('should fail with invalid urgency level', async () => {
        const withdrawalData = {
          amount: 500,
          reason: 'Test reason',
          urgency: 'invalid_urgency'
        };

        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(withdrawalData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Invalid urgency level'
            })
          ])
        );
      });

      test('should fail without authentication', async () => {
        const withdrawalData = {
          amount: 500,
          reason: 'Test reason',
          urgency: 'normal'
        };

        await request(app)
          .post('/api/withdrawal-requests')
          .send(withdrawalData)
          .expect(401);
      });

      test('should fail when withdrawal amount exceeds current balance', async () => {
        // Get current balance first
        const loansResponse = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${regularUserToken}`);
        
        if (loansResponse.status === 200 && loansResponse.body.length > 0) {
          const currentBalance = parseFloat(loansResponse.body[0].current_balance);
          const excessiveAmount = currentBalance + 1000;

          const withdrawalData = {
            amount: excessiveAmount,
            reason: 'Test excessive amount',
            urgency: 'normal'
          };

          const response = await request(app)
            .post('/api/withdrawal-requests')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send(withdrawalData)
            .expect(400);

          expect(response.body).toMatchObject({
            error: 'Withdrawal amount exceeds current balance'
          });
        }
      });
    });

    describe('GET /api/withdrawal-requests', () => {
      test('should get user withdrawal requests', async () => {
        const response = await request(app)
          .get('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            user_id: expect.any(Number),
            amount: expect.any(String),
            reason: expect.any(String),
            status: expect.any(String)
          });
        }
      });

      test('should filter withdrawal requests by status', async () => {
        const response = await request(app)
          .get('/api/withdrawal-requests?status=pending')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(request => {
          expect(request.status).toBe('pending');
        });
      });

      test('should fail without authentication', async () => {
        await request(app)
          .get('/api/withdrawal-requests')
          .expect(401);
      });
    });
  });

  describe('Meeting Requests', () => {
    describe('POST /api/meeting-requests', () => {
      test('should create a meeting request with valid data', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const meetingData = {
          purpose: 'Discuss investment strategy',
          preferred_date: tomorrow.toISOString().split('T')[0],
          preferred_time: '14:30',
          meeting_type: 'video',
          urgency: 'normal',
          topics: 'Portfolio review, investment options',
          notes: 'Please prepare quarterly report'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Meeting request submitted successfully',
          request: expect.objectContaining({
            id: expect.any(Number),
            user_id: testUserId,
            purpose: meetingData.purpose,
            preferred_date: meetingData.preferred_date,
            preferred_time: meetingData.preferred_time,
            meeting_type: meetingData.meeting_type,
            urgency: meetingData.urgency,
            topics: meetingData.topics,
            notes: meetingData.notes,
            status: 'pending'
          })
        });

        testMeetingRequestId = response.body.request.id;
      });

      test('should fail with missing purpose', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const meetingData = {
          preferred_date: tomorrow.toISOString().split('T')[0],
          preferred_time: '14:30',
          meeting_type: 'video'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Purpose is required'
            })
          ])
        );
      });

      test('should fail with invalid date format', async () => {
        const meetingData = {
          purpose: 'Test meeting',
          preferred_date: 'invalid-date',
          preferred_time: '14:30',
          meeting_type: 'video'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Valid preferred date required'
            })
          ])
        );
      });

      test('should fail with invalid time format', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const meetingData = {
          purpose: 'Test meeting',
          preferred_date: tomorrow.toISOString().split('T')[0],
          preferred_time: '25:00', // Invalid time
          meeting_type: 'video'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Valid time format required (HH:MM)'
            })
          ])
        );
      });

      test('should fail with invalid meeting type', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const meetingData = {
          purpose: 'Test meeting',
          preferred_date: tomorrow.toISOString().split('T')[0],
          preferred_time: '14:30',
          meeting_type: 'invalid_type'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Invalid meeting type'
            })
          ])
        );
      });

      test('should fail without authentication', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const meetingData = {
          purpose: 'Test meeting',
          preferred_date: tomorrow.toISOString().split('T')[0],
          preferred_time: '14:30',
          meeting_type: 'video'
        };

        await request(app)
          .post('/api/meeting-requests')
          .send(meetingData)
          .expect(401);
      });
    });

    describe('GET /api/meeting-requests', () => {
      test('should get user meeting requests', async () => {
        const response = await request(app)
          .get('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            user_id: expect.any(Number),
            purpose: expect.any(String),
            preferred_date: expect.any(String),
            preferred_time: expect.any(String),
            status: expect.any(String)
          });
        }
      });

      test('should filter meeting requests by status', async () => {
        const response = await request(app)
          .get('/api/meeting-requests?status=pending')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(request => {
          expect(request.status).toBe('pending');
        });
      });

      test('should fail without authentication', async () => {
        await request(app)
          .get('/api/meeting-requests')
          .expect(401);
      });
    });
  });

  describe('Admin - Withdrawal Requests Management', () => {
    describe('GET /api/admin/withdrawal-requests', () => {
      test('should get all withdrawal requests for admin', async () => {
        const response = await request(app)
          .get('/api/admin/withdrawal-requests')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            user_id: expect.any(Number),
            amount: expect.any(String),
            reason: expect.any(String),
            status: expect.any(String),
            first_name: expect.any(String),
            last_name: expect.any(String),
            email: expect.any(String),
            account_number: expect.any(String)
          });
        }
      });

      test('should filter admin withdrawal requests by status', async () => {
        const response = await request(app)
          .get('/api/admin/withdrawal-requests?status=pending')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(request => {
          expect(request.status).toBe('pending');
        });
      });

      test('should fail without admin authentication', async () => {
        await request(app)
          .get('/api/admin/withdrawal-requests')
          .expect(401);
      });
    });

    describe('PUT /api/admin/withdrawal-requests/:requestId', () => {
      test('should update withdrawal request status', async () => {
        if (!testWithdrawalRequestId) {
          // Create a test withdrawal request first
          const withdrawalData = {
            amount: 500.00,
            reason: 'Test admin update',
            urgency: 'normal'
          };

          const createResponse = await request(app)
            .post('/api/withdrawal-requests')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send(withdrawalData);

          testWithdrawalRequestId = createResponse.body.request.id;
        }

        const updateData = {
          status: 'approved',
          admin_notes: 'Approved after review'
        };

        const response = await request(app)
          .put(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Withdrawal request updated successfully',
          request: expect.objectContaining({
            id: testWithdrawalRequestId,
            status: 'approved',
            admin_notes: 'Approved after review'
          })
        });
      });

      test('should fail with invalid status', async () => {
        const updateData = {
          status: 'invalid_status'
        };

        const response = await request(app)
          .put(`/api/admin/withdrawal-requests/999999`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Invalid status'
            })
          ])
        );
      });

      test('should fail for non-existent request', async () => {
        const updateData = {
          status: 'approved'
        };

        const response = await request(app)
          .put('/api/admin/withdrawal-requests/999999')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body).toMatchObject({
          error: 'Withdrawal request not found'
        });
      });

      test('should fail without admin authentication', async () => {
        const updateData = {
          status: 'approved'
        };

        await request(app)
          .put(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}`)
          .send(updateData)
          .expect(401);
      });
    });
  });

  describe('Admin - Meeting Requests Management', () => {
    describe('GET /api/admin/meeting-requests', () => {
      test('should get all meeting requests for admin', async () => {
        const response = await request(app)
          .get('/api/admin/meeting-requests')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            user_id: expect.any(Number),
            purpose: expect.any(String),
            preferred_date: expect.any(String),
            status: expect.any(String),
            first_name: expect.any(String),
            last_name: expect.any(String),
            email: expect.any(String)
          });
        }
      });

      test('should filter admin meeting requests by status', async () => {
        const response = await request(app)
          .get('/api/admin/meeting-requests?status=pending')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(request => {
          expect(request.status).toBe('pending');
        });
      });

      test('should fail without admin authentication', async () => {
        await request(app)
          .get('/api/admin/meeting-requests')
          .expect(401);
      });
    });

    describe('PUT /api/admin/meeting-requests/:requestId', () => {
      test('should update meeting request status', async () => {
        if (!testMeetingRequestId) {
          // Create a test meeting request first
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const meetingData = {
            purpose: 'Test admin update',
            preferred_date: tomorrow.toISOString().split('T')[0],
            preferred_time: '10:00',
            meeting_type: 'video'
          };

          const createResponse = await request(app)
            .post('/api/meeting-requests')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send(meetingData);

          testMeetingRequestId = createResponse.body.request.id;
        }

        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 2);

        const updateData = {
          status: 'scheduled',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          scheduled_time: '15:00',
          meeting_link: 'https://zoom.us/j/123456789',
          admin_notes: 'Scheduled for next week'
        };

        const response = await request(app)
          .put(`/api/admin/meeting-requests/${testMeetingRequestId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Meeting request updated successfully',
          request: expect.objectContaining({
            id: testMeetingRequestId,
            status: 'scheduled',
            scheduled_date: updateData.scheduled_date,
            scheduled_time: updateData.scheduled_time,
            meeting_link: updateData.meeting_link,
            admin_notes: updateData.admin_notes
          })
        });
      });

      test('should fail with invalid status', async () => {
        const updateData = {
          status: 'invalid_status'
        };

        const response = await request(app)
          .put(`/api/admin/meeting-requests/999999`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Invalid status'
            })
          ])
        );
      });

      test('should fail with invalid scheduled time format', async () => {
        const updateData = {
          status: 'scheduled',
          scheduled_time: '25:00' // Invalid time
        };

        const response = await request(app)
          .put(`/api/admin/meeting-requests/999999`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              msg: 'Valid time format required'
            })
          ])
        );
      });

      test('should fail for non-existent request', async () => {
        const updateData = {
          status: 'scheduled'
        };

        const response = await request(app)
          .put('/api/admin/meeting-requests/999999')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body).toMatchObject({
          error: 'Meeting request not found'
        });
      });

      test('should fail without admin authentication', async () => {
        const updateData = {
          status: 'scheduled'
        };

        await request(app)
          .put(`/api/admin/meeting-requests/${testMeetingRequestId}`)
          .send(updateData)
          .expect(401);
      });
    });
  });

  describe('Edge Cases and Security', () => {
    test('should not allow users to access other users\' withdrawal requests', async () => {
      // This would require setting up a second user, but the concept is important
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      // Verify that all returned requests belong to the authenticated user
      response.body.forEach(request => {
        expect(request.user_id).toBe(testUserId);
      });
    });

    test('should not allow users to access other users\' meeting requests', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      // Verify that all returned requests belong to the authenticated user
      response.body.forEach(request => {
        expect(request.user_id).toBe(testUserId);
      });
    });

    test('should validate withdrawal amount is numeric', async () => {
      const withdrawalData = {
        amount: 'not-a-number',
        reason: 'Test reason',
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(withdrawalData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should handle database constraints properly', async () => {
      // Test with very long strings to ensure proper validation
      const withdrawalData = {
        amount: 100,
        reason: 'A'.repeat(10000), // Very long reason
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(withdrawalData);

      // Should either accept it or return a proper validation error
      expect([201, 400]).toContain(response.status);
    });
  });
});