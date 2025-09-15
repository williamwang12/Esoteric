# 📊 Excel Spreadsheet Format for Loan Updates

## Required Excel File Format

The Excel file for bulk loan updates must have the following structure:

### Required Columns:
- **email**: The user's email address (Required)
- **new_balance**: The new balance amount (Required)

### Optional Columns:
- **account_number**: For reference only (ignored by system)
- **current_balance**: For reference only (ignored by system)
- **notes**: Your notes (ignored by system)

## Example Excel Content:

| email               | account_number      | current_balance | new_balance | notes                    |
|---------------------|---------------------|-----------------|-------------|--------------------------|
| user1@example.com   | LOAN-1234567890-1   | 10000.00        | 10500.00    | Monthly interest added   |
| user2@example.com   | LOAN-1234567890-2   | 15000.00        | 14800.00    | Payment received         |
| user3@example.com   | LOAN-1234567890-3   | 8500.00         | 9000.00     | Interest adjustment      |
| user4@example.com   | LOAN-1234567890-4   | 22000.00        | 21500.00    | Partial payment processed|
| user5@example.com   | LOAN-1234567890-5   | 5000.00         | 5250.00     | Monthly charge           |

## File Requirements:

✅ **File Format**: .xlsx or .xls files only
✅ **Headers**: Must be in the first row exactly as shown
✅ **Email Addresses**: Must match existing user email addresses exactly
✅ **New Balance**: Must be positive numbers
✅ **Decimal Places**: Use standard decimal notation (e.g., 12000.00)

## Example Values:

### Valid Email Addresses:
- user1@example.com
- user2@example.com
- demo@esoteric.com

### Valid Balance Values:
- 10000.00
- 12500.50
- 5000
- 15000.25

### Invalid Balance Values:
- -1000 (negative)
- "not a number" (text)
- blank cells
- #REF! (Excel errors)

## What Happens When You Upload:

1. **Validation**: System checks all data before making changes
2. **Account Verification**: Confirms all account numbers exist
3. **Balance Update**: Updates loan balances in database
4. **Transaction Creation**: Creates adjustment transaction records
5. **Results Report**: Shows successful updates and any errors

## Important Notes:

⚠️ **Backup Recommended**: Always backup data before bulk updates
⚠️ **Cannot Be Undone**: Balance changes are permanent
⚠️ **Admin Only**: Requires admin privileges
⚠️ **Exact Match**: Account numbers must match exactly

## Download Template:

You can download a pre-formatted Excel template from the Admin Dashboard:
1. Go to Admin Dashboard > Excel Upload tab
2. Click "Download Template" button
3. Fill in your data using the template format
4. Upload the completed file

## Error Handling:

The system will report errors for:
- Missing required columns
- Invalid account numbers
- Invalid balance values
- File format issues
- Database connection problems

All errors are reported with specific row numbers to help you fix issues quickly.