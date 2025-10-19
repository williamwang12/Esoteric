#!/usr/bin/env node
/**
 * Yield Deposits Payout Processor
 * 
 * This script automatically processes due yield payouts for all active deposits.
 * It can be run manually or scheduled via cron for automated processing.
 * 
 * Usage:
 *   node scripts/process-yield-payouts.js [--dry-run] [--date=YYYY-MM-DD]
 * 
 * Options:
 *   --dry-run    Show what would be processed without making changes
 *   --date       Process payouts for specific date (default: today)
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dateArg = args.find(arg => arg.startsWith('--date='));
const targetDate = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];

console.log('🏦 Yield Deposits Payout Processor');
console.log('==================================');
console.log(`📅 Target Date: ${targetDate}`);
console.log(`🔍 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE PROCESSING'}`);
console.log('');

// Helper function to calculate next payout date
function calculateNextPayoutDate(startDate, lastPayoutDate) {
    const start = new Date(startDate);
    const today = new Date(targetDate);
    const lastPayout = lastPayoutDate ? new Date(lastPayoutDate) : null;
    
    // Calculate how many years since start
    let yearsSinceStart = 0;
    let nextPayout = new Date(start);
    
    while (nextPayout <= today) {
        yearsSinceStart++;
        nextPayout = new Date(start);
        nextPayout.setFullYear(start.getFullYear() + yearsSinceStart);
    }
    
    // Check if this payout is due today or overdue
    const thisYearPayout = new Date(start);
    thisYearPayout.setFullYear(start.getFullYear() + (yearsSinceStart - 1));
    
    // If we already paid out for this year, not due
    if (lastPayout && lastPayout >= thisYearPayout) {
        return null;
    }
    
    // If this year's payout date is today or past, it's due
    if (thisYearPayout <= today) {
        return thisYearPayout.toISOString().split('T')[0];
    }
    
    return null;
}

// Helper function to process yield payout
async function processYieldPayout(depositId, payoutDate) {
    try {
        if (!isDryRun) {
            await pool.query('BEGIN');
        }
        
        // Get deposit details
        const depositResult = await pool.query(`
            SELECT yd.*, u.email, la.id as loan_account_id
            FROM yield_deposits yd
            JOIN users u ON yd.user_id = u.id
            JOIN loan_accounts la ON la.user_id = u.id
            WHERE yd.id = $1 AND yd.status = 'active'
        `, [depositId]);
        
        if (depositResult.rows.length === 0) {
            if (!isDryRun) await pool.query('ROLLBACK');
            return { success: false, error: 'Deposit not found or not active' };
        }
        
        const deposit = depositResult.rows[0];
        const payoutAmount = parseFloat(deposit.principal_amount) * parseFloat(deposit.annual_yield_rate);
        
        // Check if payout already exists for this date
        const existingPayout = await pool.query(`
            SELECT id FROM yield_payouts 
            WHERE deposit_id = $1 AND payout_date = $2
        `, [depositId, payoutDate]);
        
        if (existingPayout.rows.length > 0) {
            if (!isDryRun) await pool.query('ROLLBACK');
            return { success: false, error: 'Payout already exists for this date' };
        }
        
        if (!isDryRun) {
            // Create transaction
            const transactionResult = await pool.query(`
                INSERT INTO loan_transactions (
                    loan_account_id, amount, transaction_type, description, 
                    transaction_date, created_at
                ) VALUES ($1, $2, 'yield_payment', $3, $4, NOW())
                RETURNING id
            `, [
                deposit.loan_account_id,
                payoutAmount,
                `12% yield payment for deposit #${depositId}`,
                payoutDate
            ]);
            
            const transactionId = transactionResult.rows[0].id;
            
            // Update loan account balance
            await pool.query(`
                UPDATE loan_accounts 
                SET current_balance = current_balance + $1
                WHERE id = $2
            `, [payoutAmount, deposit.loan_account_id]);
            
            // Create payout record (using user ID 1 as system user)
            await pool.query(`
                INSERT INTO yield_payouts (
                    deposit_id, amount, payout_date, transaction_id, processed_by
                ) VALUES ($1, $2, $3, $4, $5)
            `, [depositId, payoutAmount, payoutDate, transactionId, 1]);
            
            // Update deposit last payout date and total paid out
            await pool.query(`
                UPDATE yield_deposits 
                SET last_payout_date = $1, total_paid_out = total_paid_out + $2
                WHERE id = $3
            `, [payoutDate, payoutAmount, depositId]);
            
            await pool.query('COMMIT');
        }
        
        return {
            success: true,
            deposit: {
                id: deposit.id,
                email: deposit.email,
                principal_amount: deposit.principal_amount,
                payout_amount: payoutAmount
            }
        };
        
    } catch (error) {
        if (!isDryRun) await pool.query('ROLLBACK');
        console.error('Error processing yield payout:', error);
        throw error;
    }
}

async function main() {
    try {
        // Get all active deposits
        const depositsResult = await pool.query(`
            SELECT yd.*, u.email
            FROM yield_deposits yd
            JOIN users u ON yd.user_id = u.id
            WHERE yd.status = 'active'
            ORDER BY yd.start_date ASC
        `);
        
        const deposits = depositsResult.rows;
        console.log(`📊 Found ${deposits.length} active yield deposits`);
        
        if (deposits.length === 0) {
            console.log('✅ No active deposits to process');
            return;
        }
        
        console.log('');
        
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (const deposit of deposits) {
            const duePayoutDate = calculateNextPayoutDate(deposit.start_date, deposit.last_payout_date);
            
            if (!duePayoutDate) {
                console.log(`⏭️  Deposit #${deposit.id} (${deposit.email}): Not due yet`);
                skippedCount++;
                continue;
            }
            
            const payoutAmount = parseFloat(deposit.principal_amount) * parseFloat(deposit.annual_yield_rate);
            
            try {
                console.log(`${isDryRun ? '🔍' : '💰'} Processing deposit #${deposit.id} (${deposit.email}):`);
                console.log(`   Principal: $${parseFloat(deposit.principal_amount).toFixed(2)}`);
                console.log(`   Payout: $${payoutAmount.toFixed(2)}`);
                console.log(`   Due Date: ${duePayoutDate}`);
                
                if (!isDryRun) {
                    const result = await processYieldPayout(deposit.id, duePayoutDate);
                    
                    if (result.success) {
                        console.log(`   ✅ Success: Payout processed`);
                        processedCount++;
                    } else {
                        console.log(`   ❌ Failed: ${result.error}`);
                        errorCount++;
                    }
                } else {
                    console.log(`   ✅ Would process payout`);
                    processedCount++;
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errorCount++;
            }
            
            console.log('');
        }
        
        console.log('📊 Processing Summary:');
        console.log(`   Total Deposits: ${deposits.length}`);
        console.log(`   Processed: ${processedCount}`);
        console.log(`   Skipped (not due): ${skippedCount}`);
        console.log(`   Errors: ${errorCount}`);
        
        if (isDryRun) {
            console.log('');
            console.log('🔍 This was a dry run. No changes were made.');
            console.log('   Run without --dry-run to process payouts.');
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});