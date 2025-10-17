import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Description,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  ExpandLess,
  AttachMoney,
  TableChart,
  Receipt,
  Clear,
  SwapHoriz,
  AccountBalance,
} from '@mui/icons-material';
import { adminApi } from '../../services/api';

interface ExcelUploadResult {
  message: string;
  summary: {
    totalRows: number;
    validUpdates: number;
    successfulUpdates: number;
    errors: number;
  };
  updates: Array<{
    email: string;
    accountNumber: string;
    oldBalance: number;
    newBalance: number;
    change: number;
    userId: number;
  }>;
  errors: string[];
}

interface ExcelTransactionResult {
  message: string;
  summary: {
    totalRows: number;
    validTransactions: number;
    successfulTransactions: number;
    errors: number;
  };
  transactions: Array<{
    id: number;
    email: string;
    accountNumber: string;
    amount: number;
    transactionType: string;
    transactionDate: string;
    balanceChange: number;
    newBalance: number;
    userId: number;
  }>;
  errors: string[];
}

interface ExcelUploadProps {
  onUploadComplete?: () => void;
}

const ExcelUpload: React.FC<ExcelUploadProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ExcelUploadResult | null>(null);
  const [transactionResult, setTransactionResult] = useState<ExcelTransactionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [uploadMode, setUploadMode] = useState<'balance' | 'transaction'>(() => {
    // Try to load from localStorage, default to 'balance'
    try {
      const saved = localStorage.getItem('excelUploadMode');
      return (saved === 'transaction' || saved === 'balance') ? saved : 'balance';
    } catch (error) {
      console.log('Failed to load upload mode from localStorage:', error);
      return 'balance';
    }
  });
  const [recentUpdates, setRecentUpdates] = useState<Array<{
    email: string;
    accountNumber: string;
    oldBalance: number;
    newBalance: number;
    change: number;
    updatedAt: string;
  }>>(() => {
    console.log('ExcelUpload component initializing recentUpdates state');
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem('excelUploadRecentUpdates');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Loaded recent updates from localStorage:', parsed.length, 'items');
        return parsed;
      }
    } catch (error) {
      console.log('Failed to load from localStorage:', error);
    }
    return [];
  });
  const [loadingRecent, setLoadingRecent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);
    setTransactionResult(null);

    try {
      const formData = new FormData();
      formData.append('excel', file);

      let response;
      if (uploadMode === 'balance') {
        response = await adminApi.uploadExcel(formData);
        setUploadResult(response);
      } else {
        response = await adminApi.uploadExcelTransactions(formData);
        setTransactionResult(response);
      }
      
      setShowResults(true);
      
      // Debug logging
      console.log('Upload response:', response);
      console.log('Response updates:', response?.updates);
      console.log('Updates length:', response?.updates?.length);
      console.log('Show results state:', true);
      
      // Process successful updates/transactions
      const successCount = uploadMode === 'balance' 
        ? response?.summary?.successfulUpdates || 0
        : response?.summary?.successfulTransactions || 0;
        
      if (successCount > 0) {
        console.log(`Checking for ${uploadMode} results to add to recent list...`);
        
        let newUpdates: any[] = [];
        
        if (uploadMode === 'balance' && response.updates && response.updates.length > 0) {
          // Handle balance updates
          console.log('Adding balance updates to recent list:', response.updates);
          newUpdates = response.updates.map((update: any) => ({
            ...update,
            updatedAt: new Date().toISOString()
          }));
        } else if (uploadMode === 'transaction' && response.transactions && response.transactions.length > 0) {
          // Handle transaction imports - convert to recent updates format
          console.log('Adding transaction imports to recent list:', response.transactions);
          newUpdates = response.transactions.map((transaction: any) => ({
            email: transaction.email,
            accountNumber: transaction.accountNumber,
            oldBalance: transaction.newBalance - transaction.balanceChange,
            newBalance: transaction.newBalance,
            change: transaction.balanceChange,
            updatedAt: new Date().toISOString(),
            transactionType: transaction.transactionType, // Additional field for transactions
            transactionAmount: transaction.amount
          }));
        }
        
        if (newUpdates.length > 0) {
          // Replace previous updates with new ones (don't append)
          try {
            localStorage.setItem('excelUploadRecentUpdates', JSON.stringify(newUpdates));
            console.log('Replaced recent updates in localStorage with new upload:', newUpdates.length, 'items');
          } catch (error) {
            console.log('Failed to save to localStorage:', error);
          }
          
          // Also update state (replace, don't append)
          setRecentUpdates(() => {
            console.log('Replacing recent updates state with new upload');
            console.log('New recent updates state:', newUpdates);
            return newUpdates;
          });
        } else {
          console.log('No updates/transactions array found in response or array is empty');
          console.log('Response structure:', JSON.stringify(response, null, 2));
          
          // Fallback: Create placeholder entries if we know updates happened but don't have details
          if (successCount > 0) {
            console.log('Creating placeholder entries for recent updates table');
            const placeholderUpdates = Array(successCount).fill(null).map((_, index) => ({
              email: uploadMode === 'balance' ? 'Updated via Excel' : 'Transaction imported',
              accountNumber: `Account ${index + 1}`,
              oldBalance: 0,
              newBalance: 0,
              change: 0,
              updatedAt: new Date().toISOString()
            }));
            
            // Save placeholder updates to localStorage
            try {
              localStorage.setItem('excelUploadRecentUpdates', JSON.stringify(placeholderUpdates));
              console.log('Saved placeholder updates to localStorage:', placeholderUpdates.length, 'items');
            } catch (error) {
              console.log('Failed to save placeholder updates to localStorage:', error);
            }
            
            setRecentUpdates(() => placeholderUpdates);
          }
        }
      }
      
      if (onUploadComplete) {
        console.log('Calling onUploadComplete - this might refresh parent component');
        onUploadComplete();
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      let response;
      let filename;
      
      if (uploadMode === 'balance') {
        response = await adminApi.downloadExcelTemplate();
        filename = 'loan_update_template.xlsx';
      } else {
        response = await adminApi.downloadExcelTransactionsTemplate();
        filename = 'transaction_import_template.xlsx';
      }
      
      // Create blob and download
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Template download error:', err);
      setError('Failed to download template. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Excel Import
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Info />}
          onClick={() => setShowInstructions(true)}
        >
          Instructions
        </Button>
      </Box>

      {/* Mode Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <SwapHoriz />
            <Typography variant="h6">
              Import Mode
            </Typography>
          </Box>
          
          <ToggleButtonGroup
            value={uploadMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode !== null) {
                setUploadMode(newMode);
                // Save mode preference to localStorage
                try {
                  localStorage.setItem('excelUploadMode', newMode);
                } catch (error) {
                  console.log('Failed to save upload mode to localStorage:', error);
                }
                setUploadResult(null);
                setTransactionResult(null);
                setError(null);
                setShowResults(false);
              }
            }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="balance">
              <AccountBalance sx={{ mr: 1 }} />
              Balance Updates
            </ToggleButton>
            <ToggleButton value="transaction">
              <Receipt sx={{ mr: 1 }} />
              Transaction Import
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Typography variant="body2" color="text.secondary">
            {uploadMode === 'balance' 
              ? 'Update loan account balances directly with new amounts'
              : 'Import individual transactions that will update account balances automatically'
            }
          </Typography>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {uploadMode === 'balance' ? <TableChart /> : <Receipt />}
            {uploadMode === 'balance' ? 'Bulk Loan Balance Updates' : 'Transaction Import'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {uploadMode === 'balance' 
              ? 'Upload an Excel spreadsheet to update multiple loan balances at once. Download the template first to see the required format.'
              : 'Upload an Excel spreadsheet with transaction data. Each transaction will be imported and balances updated automatically.'
            }
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
            
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUpload />}
              disabled={uploading}
            >
              Upload Excel File
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
          </Box>

          {uploading && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Processing Excel file...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Updates Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt />
            {uploadMode === 'balance' ? 'Recent Loan Updates' : 'Recent Transaction Imports'}
            {recentUpdates.length > 0 && (
              <Chip 
                label={`${recentUpdates.length} ${uploadMode === 'balance' ? 'updates' : 'transactions'}`} 
                size="small" 
                color="primary" 
              />
            )}
          </Typography>
          
          {recentUpdates.length === 0 ? (
            <>
              {console.log('Recent updates array is empty:', recentUpdates)}
              <Alert severity="info">
                {uploadMode === 'balance' 
                  ? 'No recent updates. Upload an Excel file to see updated loan accounts here.'
                  : 'No recent transaction imports. Upload an Excel file to see imported transactions here.'
                }
              </Alert>
            </>
          ) : (
            <>
              {console.log('Rendering recent updates table with:', recentUpdates.length, 'items')}
              {console.log('Recent updates data:', recentUpdates)}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Updated</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Old Balance</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>New Balance</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentUpdates.map((update, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(update.updatedAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
                        {update.email}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {update.accountNumber}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(update.oldBalance)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>
                        {formatCurrency(update.newBalance)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={`${update.change >= 0 ? '+' : ''}${formatCurrency(update.change)}`}
                            color={update.change >= 0 ? 'success' : 'warning'}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            ({((update.change / update.oldBalance) * 100).toFixed(1)}%)
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}
          
          {recentUpdates.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Showing {recentUpdates.length} {uploadMode === 'balance' ? 'updates' : 'transactions'} from most recent upload
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Clear />}
                onClick={() => {
                  setRecentUpdates([]);
                  localStorage.removeItem('excelUploadRecentUpdates');
                  console.log('Cleared recent updates and localStorage');
                }}
              >
                Clear History
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {(uploadResult || transactionResult) && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle color="success" />
                {uploadMode === 'balance' ? 'Balance Update Results' : 'Transaction Import Results'}
              </Typography>
              <IconButton onClick={() => setShowResults(!showResults)}>
                {showResults ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            {/* Summary */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="primary">
                    {uploadResult?.summary.totalRows || transactionResult?.summary.totalRows}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Rows
                  </Typography>
                </CardContent>
              </Card>
              
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="success.main">
                    {uploadResult?.summary.successfulUpdates || transactionResult?.summary.successfulTransactions}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {uploadMode === 'balance' ? 'Successful Updates' : 'Successful Transactions'}
                  </Typography>
                </CardContent>
              </Card>
              
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="error.main">
                    {uploadResult?.summary.errors || transactionResult?.summary.errors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Errors
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Collapse in={showResults} timeout="auto" unmountOnExit>
              <Box sx={{ mb: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    {uploadMode === 'balance' 
                      ? `Balance Update Results: ${uploadResult?.summary?.successfulUpdates || 0} successful updates, ${uploadResult?.summary?.errors || 0} errors`
                      : `Transaction Import Results: ${transactionResult?.summary?.successfulTransactions || 0} successful transactions, ${transactionResult?.summary?.errors || 0} errors`
                    }
                  </Typography>
                </Alert>
              </Box>
              {/* Successful Updates */}
              {uploadResult?.updates && uploadResult.updates.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoney color="success" />
                    Successful Balance Updates ({uploadResult.updates.length})
                  </Typography>
                  
                  {uploadResult.updates.length > 0 && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Successfully updated {uploadResult.updates.length} loan account{uploadResult.updates.length !== 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Transaction records have been automatically created for all balance changes
                      </Typography>
                      <Typography variant="body2">
                        Total amount changed: {formatCurrency(
                          uploadResult.updates.reduce((sum, update) => sum + Math.abs(update.change), 0)
                        )}
                      </Typography>
                    </Alert>
                  )}
                  
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Account Number</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Old Balance</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>New Balance</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Change</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.updates.map((update, index) => (
                          <TableRow key={index} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                              {update.email}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {update.accountNumber}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(update.oldBalance)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>
                              {formatCurrency(update.newBalance)}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={`${update.change >= 0 ? '+' : ''}${formatCurrency(update.change)}`}
                                  color={update.change >= 0 ? 'success' : 'warning'}
                                  size="small"
                                />
                                <Typography variant="caption" color="text.secondary">
                                  ({((update.change / update.oldBalance) * 100).toFixed(1)}%)
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      All changes have been saved to the database and transaction records created
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Download />}
                      onClick={() => {
                        const csvContent = [
                          ['Email', 'Account Number', 'Old Balance', 'New Balance', 'Change', 'Change %'].join(','),
                          ...uploadResult.updates.map(update => [
                            update.email,
                            update.accountNumber,
                            update.oldBalance,
                            update.newBalance,
                            update.change,
                            `${((update.change / update.oldBalance) * 100).toFixed(1)}%`
                          ].join(','))
                        ].join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `loan_updates_${new Date().toISOString().split('T')[0]}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      }}
                    >
                      Export Summary
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Successful Transactions */}
              {transactionResult?.transactions && transactionResult.transactions.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Receipt color="success" />
                    Successful Transaction Imports ({transactionResult.transactions.length})
                  </Typography>
                  
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Successfully imported {transactionResult.transactions.length} transaction{transactionResult.transactions.length !== 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Account balances have been automatically updated based on transaction types
                    </Typography>
                    <Typography variant="body2">
                      Total transaction amount: {formatCurrency(
                        transactionResult.transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
                      )}
                    </Typography>
                  </Alert>
                  
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Account Number</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Transaction Type</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Balance Change</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactionResult.transactions.map((transaction, index) => (
                          <TableRow key={index} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                              {transaction.email}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {transaction.accountNumber}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={transaction.transactionType} 
                                size="small" 
                                color={transaction.transactionType.includes('withdrawal') || transaction.transactionType.includes('decrease') ? 'error' : 'success'}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              {new Date(transaction.transactionDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={`${transaction.balanceChange >= 0 ? '+' : ''}${formatCurrency(transaction.balanceChange)}`}
                                  color={transaction.balanceChange >= 0 ? 'success' : 'warning'}
                                  size="small"
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      All transactions have been imported and account balances updated
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Download />}
                      onClick={() => {
                        const csvContent = [
                          ['Email', 'Account Number', 'Transaction Type', 'Amount', 'Date', 'Balance Change'].join(','),
                          ...transactionResult.transactions.map(transaction => [
                            transaction.email,
                            transaction.accountNumber,
                            transaction.transactionType,
                            transaction.amount,
                            new Date(transaction.transactionDate).toLocaleDateString(),
                            transaction.balanceChange
                          ].join(','))
                        ].join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `transaction_imports_${new Date().toISOString().split('T')[0]}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      }}
                    >
                      Export Summary
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Errors */}
              {((uploadResult?.errors && uploadResult.errors.length > 0) || (transactionResult?.errors && transactionResult.errors.length > 0)) && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Error color="error" />
                    Errors ({(uploadResult?.errors || transactionResult?.errors)?.length})
                  </Typography>
                  
                  <List dense>
                    {(uploadResult?.errors || transactionResult?.errors || []).map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning color="error" />
                        </ListItemIcon>
                        <ListItemText primary={error} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Instructions Dialog */}
      <Dialog 
        open={showInstructions} 
        onClose={() => setShowInstructions(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'background.paper',
            opacity: 1,
            backdropFilter: 'none'
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description />
          Excel Upload Instructions
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            How to Use Excel Upload
          </Typography>
          
          <Typography variant="body2" paragraph>
            The Excel upload feature allows administrators to update multiple loan balances simultaneously using a spreadsheet.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Required Excel Format
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>account_number</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>current_balance</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>new_balance</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontFamily: 'monospace' }}>user1@example.com</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>LOAN-1234567890-1</TableCell>
                  <TableCell>10000.00</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>12000.00</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>Monthly interest added</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontFamily: 'monospace' }}>user2@example.com</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>LOAN-1234567890-2</TableCell>
                  <TableCell>15000.00</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'warning.main' }}>14500.00</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>Partial payment received</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" gutterBottom>
            Column Requirements
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText 
                primary="email (Required)" 
                secondary="User's email address (e.g., user@example.com)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText 
                primary="new_balance (Required)" 
                secondary="New balance amount (must be positive number)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Info color="info" /></ListItemIcon>
              <ListItemText 
                primary="account_number (Optional)" 
                secondary="For reference only - will be ignored"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Info color="info" /></ListItemIcon>
              <ListItemText 
                primary="current_balance (Optional)" 
                secondary="For reference only - will be ignored"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Info color="info" /></ListItemIcon>
              <ListItemText 
                primary="notes (Optional)" 
                secondary="Your notes - will be ignored"
              />
            </ListItem>
          </List>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Important Notes
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon><Warning color="warning" /></ListItemIcon>
              <ListItemText primary="Only .xlsx and .xls files are accepted" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Warning color="warning" /></ListItemIcon>
              <ListItemText primary="Email addresses must match existing users with loan accounts" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Warning color="warning" /></ListItemIcon>
              <ListItemText primary="New balance must be a positive number" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Warning color="warning" /></ListItemIcon>
              <ListItemText primary="Changes will create transaction records automatically" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Error color="error" /></ListItemIcon>
              <ListItemText primary="This operation cannot be undone - backup recommended" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInstructions(false)}>
            Close
          </Button>
          <Button variant="contained" onClick={handleDownloadTemplate}>
            Download Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExcelUpload;