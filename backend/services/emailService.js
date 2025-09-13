const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        try {
            // Check if email configuration exists
            const emailConfig = {
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT || 587,
                secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            };

            // If no email config is provided, create test account for development
            if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
                console.log('📧 No email configuration found, creating test account...');
                
                // Create a test account using Ethereal Email
                const testAccount = await nodemailer.createTestAccount();
                
                emailConfig.host = 'smtp.ethereal.email';
                emailConfig.port = 587;
                emailConfig.secure = false;
                emailConfig.auth = {
                    user: testAccount.user,
                    pass: testAccount.pass
                };
                
                console.log('📧 Test email account created:');
                console.log(`   User: ${testAccount.user}`);
                console.log('   Preview emails at: https://ethereal.email');
            }

            // Create transporter
            this.transporter = nodemailer.createTransport(emailConfig);

            // Verify connection configuration
            await this.transporter.verify();
            this.initialized = true;
            
            console.log('✅ Email service initialized successfully');
            
        } catch (error) {
            console.error('❌ Email service initialization failed:', error.message);
            this.initialized = false;
        }
    }

    async sendVerificationEmail(email, verificationToken) {
        // Wait for initialization if it's still in progress
        if (!this.initialized && this.transporter === null) {
            console.log('📧 Email service initializing, waiting...');
            // Wait for initialization to complete
            let retries = 0;
            while (!this.initialized && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
            if (!this.initialized) {
                throw new Error('Email service initialization timeout');
            }
        }
        
        if (!this.initialized) {
            throw new Error('Email service not initialized');
        }

        try {
            const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}`;
            
            const mailOptions = {
                from: `"Esoteric Loans" <${process.env.EMAIL_USER || 'noreply@esoteric.com'}>`,
                to: email,
                subject: 'Verify Your Email Address - Esoteric Loans',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Email Verification</title>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #6B46C1 0%, #9333EA 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                            .button { display: inline-block; background: linear-gradient(135deg, #6B46C1 0%, #9333EA 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                            .token { background: #f3f4f6; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0; letter-spacing: 2px; }
                            .footer { text-align: center; color: #666; margin-top: 20px; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 style="margin: 0; font-size: 28px;">ESOTERIC</h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px;">Verify Your Email Address</p>
                            </div>
                            <div class="content">
                                <h2 style="color: #6B46C1;">Welcome to Esoteric Loans!</h2>
                                <p>Thank you for creating your account. To complete your registration and start using our platform, please verify your email address.</p>
                                
                                <p><strong>Your verification token is:</strong></p>
                                <div class="token">${verificationToken}</div>
                                
                                <p>Simply copy this token and paste it in the email verification dialog on our platform.</p>
                                
                                <p>This verification token will expire in <strong>24 hours</strong> for security reasons.</p>
                                
                                <div style="margin: 30px 0;">
                                    <p><strong>Alternatively, you can click the button below to verify automatically:</strong></p>
                                    <a href="${verificationUrl}" class="button">Verify Email Address</a>
                                </div>
                                
                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                                
                                <p><strong>Important Security Information:</strong></p>
                                <ul>
                                    <li>If you didn't create an account with us, please ignore this email</li>
                                    <li>Never share your verification token with anyone</li>
                                    <li>This token will expire in 24 hours</li>
                                </ul>
                                
                                <p>If you have any questions or need assistance, please contact our support team.</p>
                                
                                <p>Best regards,<br>The Esoteric Loans Team</p>
                            </div>
                            <div class="footer">
                                <p>This email was sent from Esoteric Loans. Please do not reply to this email.</p>
                                <p>If you're having trouble with the verification, please contact our support team.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `
                    Welcome to Esoteric Loans!
                    
                    Thank you for creating your account. To complete your registration, please verify your email address.
                    
                    Your verification token is: ${verificationToken}
                    
                    Copy this token and paste it in the email verification dialog on our platform.
                    
                    Alternatively, you can use this link: ${verificationUrl}
                    
                    This verification token will expire in 24 hours for security reasons.
                    
                    If you didn't create an account with us, please ignore this email.
                    
                    Best regards,
                    The Esoteric Loans Team
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            console.log('📧 Email sent successfully:', info.messageId);
            
            // If using test account, log the preview URL
            if (process.env.NODE_ENV === 'development' && info.testMessageUrl) {
                console.log('📧 Preview URL: %s', nodemailer.getTestMessageUrl(info));
            }
            
            return {
                success: true,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info)
            };
            
        } catch (error) {
            console.error('❌ Failed to send verification email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    async sendPasswordResetEmail(email, resetToken) {
        if (!this.initialized) {
            throw new Error('Email service not initialized');
        }

        try {
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;
            
            const mailOptions = {
                from: `"Esoteric Loans" <${process.env.EMAIL_USER || 'noreply@esoteric.com'}>`,
                to: email,
                subject: 'Password Reset Request - Esoteric Loans',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Password Reset</title>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                            .button { display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                            .token { background: #f3f4f6; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0; letter-spacing: 2px; }
                            .footer { text-align: center; color: #666; margin-top: 20px; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 style="margin: 0; font-size: 28px;">ESOTERIC</h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
                            </div>
                            <div class="content">
                                <h2 style="color: #DC2626;">Reset Your Password</h2>
                                <p>We received a request to reset your password for your Esoteric Loans account.</p>
                                
                                <p><strong>Your password reset token is:</strong></p>
                                <div class="token">${resetToken}</div>
                                
                                <div style="margin: 30px 0;">
                                    <p><strong>Or click the button below to reset your password:</strong></p>
                                    <a href="${resetUrl}" class="button">Reset Password</a>
                                </div>
                                
                                <p>This reset token will expire in <strong>1 hour</strong> for security reasons.</p>
                                
                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                                
                                <p><strong>Security Notice:</strong></p>
                                <ul>
                                    <li>If you didn't request a password reset, please ignore this email</li>
                                    <li>Never share your reset token with anyone</li>
                                    <li>This token will expire in 1 hour</li>
                                    <li>Consider changing your password if you suspect unauthorized access</li>
                                </ul>
                                
                                <p>Best regards,<br>The Esoteric Loans Security Team</p>
                            </div>
                            <div class="footer">
                                <p>This email was sent from Esoteric Loans. Please do not reply to this email.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `
                    Password Reset Request - Esoteric Loans
                    
                    We received a request to reset your password for your Esoteric Loans account.
                    
                    Your password reset token is: ${resetToken}
                    
                    You can also use this link: ${resetUrl}
                    
                    This reset token will expire in 1 hour for security reasons.
                    
                    If you didn't request a password reset, please ignore this email.
                    
                    Best regards,
                    The Esoteric Loans Security Team
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            console.log('📧 Password reset email sent successfully:', info.messageId);
            
            if (process.env.NODE_ENV === 'development' && info.testMessageUrl) {
                console.log('📧 Preview URL: %s', nodemailer.getTestMessageUrl(info));
            }
            
            return {
                success: true,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info)
            };
            
        } catch (error) {
            console.error('❌ Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }
}

// Export a single instance
module.exports = new EmailService();