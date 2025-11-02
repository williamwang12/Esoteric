# 📊 Excel Loan Update Feature

The Esoteric backend now supports bulk loan balance updates via Excel spreadsheet upload for administrators.

## 🚀 Features

- **Excel Template Download**: Get a pre-formatted template with instructions
- **Bulk Loan Updates**: Update multiple loan balances in one operation
- **Data Validation**: Comprehensive validation of account numbers and balances
- **Transaction Logging**: Automatic creation of adjustment transaction records
- **Error Reporting**: Detailed error reporting for invalid data
- **Security**: Admin authentication and rate limiting protection

## 📋 API Endpoints

### Download Excel Template
```
GET /api/admin/loans/excel-template
Authorization: Bearer {admin_token}
```

**Response**: Excel file download with template and instructions

### Upload Excel File
```
POST /api/admin/loans/excel-upload
Authorization: Bearer {admin_token}
Content-Type: multipart/form-data

Body: excel={file}
```

**Response**:
```json
{
  "message": "Excel upload processed successfully",
  "summary": {
    "totalRows": 10,
    "validUpdates": 8,
    "successfulUpdates": 8,
    "errors": 2
  },
  "updates": [
    {
      "accountNumber": "LOAN-1234567890-1",
      "oldBalance": 10000,
      "newBalance": 12000,
      "change": 2000,
      "userId": 123
    }
  ],
  "errors": [
    "Row 3: Loan account INVALID-123 not found"
  ]
}
```

## 📊 Excel File Format

### Required Columns
- **account_number**: The exact loan account number (e.g., "LOAN-1234567890-1")
- **new_balance**: The new balance amount (must be positive number)

### Optional Columns
- **current_balance**: For reference only (ignored)
- **notes**: For your notes (ignored)

### Example Excel Content
| account_number | current_balance | new_balance | notes |
|---|---|---|---|
| LOAN-1234567890-1 | 10000.00 | 12000.00 | Monthly interest added |
| LOAN-1234567890-2 | 15000.00 | 14500.00 | Partial payment received |

## 🔧 How It Works

1. **Template Download**: Admin downloads the Excel template
2. **Data Entry**: Admin fills in account numbers and new balances
3. **File Upload**: Admin uploads the completed Excel file
4. **Validation**: System validates all data before processing
5. **Processing**: Valid updates are applied in a database transaction
6. **Logging**: Adjustment transactions are automatically created
7. **Response**: Summary of successful updates and any errors

## ✅ Data Validation

The system validates:
- ✅ File format (.xlsx or .xls files only)
- ✅ Required columns present
- ✅ Account numbers exist in the system
- ✅ New balance is a positive number
- ✅ Account number format is valid

## 🔒 Security Features

- **Admin Authentication**: Only admin users can upload Excel files
- **Rate Limiting**: Upload and admin rate limits applied
- **File Validation**: Only Excel files accepted
- **Transaction Safety**: All updates in database transaction
- **File Cleanup**: Uploaded files automatically deleted
- **Error Handling**: Comprehensive error reporting

## 📝 Transaction Records

Each balance update creates a transaction record:
- **Type**: `adjustment_increase` or `adjustment_decrease`
- **Amount**: Absolute value of the balance change
- **Description**: Details of the old and new balance
- **Date**: Current timestamp

## 🚨 Important Notes

⚠️ **Backup Recommended**: Always backup your data before bulk updates

⚠️ **Cannot Be Undone**: Balance updates are permanent

⚠️ **Account Numbers Must Match**: Account numbers must match exactly

⚠️ **Admin Only**: This feature requires admin privileges

## 🧪 Testing

The feature includes comprehensive tests covering:
- Template download functionality
- Excel file upload and processing
- Data validation and error handling
- Balance updates and transaction creation
- Security and authentication
- File format validation
- Error reporting

Run tests with:
```bash
npm test tests/excel-upload.test.js
```

## 📦 Dependencies

- **xlsx**: Excel file parsing and generation
- **multer**: File upload handling
- **express-validator**: Input validation
- **helmet**: Security headers
- **express-rate-limit**: Rate limiting

## 💡 Usage Example

1. Download template: `GET /api/admin/loans/excel-template`
2. Fill in loan data in the Excel file
3. Upload file: `POST /api/admin/loans/excel-upload`
4. Review the response for successful updates and any errors
5. Check loan accounts to verify balance changes

This feature provides a powerful tool for administrators to efficiently manage loan balances in bulk while maintaining data integrity and security.