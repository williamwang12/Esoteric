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
  PersonAdd,
  AccountBalance,
  SwapHoriz,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import { adminApi } from '../../services/api';

interface TransactionImportResult {
  message: string;
  summary: {
    total_transactions_processed: number;
    deposits_processed: number;
    withdrawals_processed: number;
    users_created: number;
    users_updated: number;
    total_amount_deposited: number;
    total_amount_withdrawn: number;
    net_amount: number;
    errors: number;
  };
  results: {
    created_users: Array<{
      email: string;
      user_id: number;
      temp_password: string;
      total_deposits: number;
      total_withdrawals: number;
      net_balance: number;
    }>;
    updated_users: Array<{
      email: string;
      user_id: number;
      deposits_added: number;
      withdrawals_processed: number;
      balance_change: number;
      new_balance: number;
    }>;
    transaction_summary: Array<{
      email: string;
      deposit_count: number;
      withdrawal_count: number;
      total_deposited: number;
      total_withdrawn: number;
      net_amount: number;
      final_balance: number;
    }>;
    processing_log: Array<{
      transaction_date: string;
      email: string;
      type: 'deposit' | 'withdrawal';
      amount: number;
      status: 'success' | 'error';
      message: string;
      running_balance?: number;
    }>;
    errors: string[];
    warnings: string[];
  };
}

const TransactionImport: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<TransactionImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showProcessingLog, setShowProcessingLog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('excel', selectedFile);

      const result = await adminApi.uploadTransactionImport(formData);
      setUploadResult(result);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      if (err.response?.data?.errors) {
        setError(`Upload failed: ${err.response.data.errors.join(', ')}`);
      } else {
        setError(err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await adminApi.downloadTransactionImportTemplate();
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transaction_import_template_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download error:', err);
      setError('Failed to download template');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const copyPasswordsToClipboard = () => {
    if (!uploadResult?.results.created_users) return;
    
    const passwordText = uploadResult.results.created_users
      .map(user => `${user.email}: ${user.temp_password}`)
      .join('\n');
    
    navigator.clipboard.writeText(passwordText);
  };

  const getTransactionTypeIcon = (type: 'deposit' | 'withdrawal') => {
    return type === 'deposit' ? 
      <TrendingUp sx={{ color: 'success.main' }} /> : 
      <TrendingDown sx={{ color: 'error.main' }} />;
  };

  const getTransactionTypeColor = (type: 'deposit' | 'withdrawal') => {
    return type === 'deposit' ? 'success' : 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Comprehensive Transaction Import
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Upload an Excel file with ALL transactions (deposits and withdrawals) to process them chronologically with LIFO rules. 
        This will create new users, process all transactions in order, and aggregate balances according to deposit rules.
      </Typography>

      {/* Template Download Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Description sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Download Template</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Download the Excel template with required columns for comprehensive transaction import.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadTemplate}
          >
            Download Transaction Import Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <CloudUpload sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Upload Transaction Data</Typography>
          </Box>
          
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          
          <Box display="flex" gap={2} alignItems="center" mb={2}>
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
            >
              Select Excel File
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Processing...' : 'Upload & Process'}
            </Button>
          </Box>

          {selectedFile && (
            <Typography variant="body2" color="text.secondary">
              Selected: {selectedFile.name}
            </Typography>
          )}

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Processing transactions chronologically with LIFO rules...
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Success Results */}
      {uploadResult && uploadResult.results && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">Transaction Import Complete</Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              {uploadResult.message}
              {uploadResult.results?.created_users?.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                  ⚠️ Important: {uploadResult.results.created_users.length} temporary passwords generated. 
                  Click "Show Passwords" below to view and copy them.
                </Typography>
              )}
            </Alert>

            {/* Summary Statistics */}
            <Box display="flex" gap={3} mb={3} flexWrap="wrap">
              <Box>
                <Typography variant="h4" color="primary">
                  {uploadResult.summary.total_transactions_processed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Transactions
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="success.main">
                  {uploadResult.summary.deposits_processed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deposits
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="error.main">
                  {uploadResult.summary.withdrawals_processed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Withdrawals
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="secondary.main">
                  {uploadResult.summary.users_created}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Users Created
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="info.main">
                  {formatCurrency(uploadResult.summary.net_amount)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Net Amount
                </Typography>
              </Box>
              {uploadResult.summary.errors > 0 && (
                <Box>
                  <Typography variant="h4" color="error.main">
                    {uploadResult.summary.errors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Errors
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Show Details Button */}
            <Button
              variant="outlined"
              startIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setShowDetails(!showDetails)}
              sx={{ mb: 2 }}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>

            <Collapse in={showDetails}>
              <Divider sx={{ mb: 2 }} />

              {/* Created Users */}
              {uploadResult.results?.created_users?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6">
                      <PersonAdd sx={{ mr: 1, verticalAlign: 'middle' }} />
                      New Users Created ({uploadResult.results.created_users.length})
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? 'Hide' : 'Show'} Passwords
                    </Button>
                  </Box>
                  
                  {showPasswords && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          <strong>Temporary passwords generated!</strong> These are required for first login. 
                          Copy and share securely with clients.
                        </Typography>
                        <Button size="small" variant="contained" onClick={copyPasswordsToClipboard}>
                          Copy All Passwords
                        </Button>
                      </Box>
                    </Alert>
                  )}
                  
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Email</TableCell>
                          <TableCell align="right">Net Balance</TableCell>
                          <TableCell align="right">Total Deposits</TableCell>
                          <TableCell align="right">Total Withdrawals</TableCell>
                          {showPasswords && <TableCell>Temp Password</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.results.created_users?.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell>{user.email}</TableCell>
                            <TableCell align="right">
                              <Typography color={user.net_balance >= 0 ? 'success.main' : 'error.main'}>
                                {formatCurrency(user.net_balance)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(user.total_deposits)}</TableCell>
                            <TableCell align="right">{formatCurrency(user.total_withdrawals)}</TableCell>
                            {showPasswords && (
                              <TableCell>
                                <code style={{ 
                                  backgroundColor: '#f5f5f5', 
                                  padding: '2px 6px', 
                                  borderRadius: '3px',
                                  fontSize: '0.9em'
                                }}>
                                  {user.temp_password}
                                </code>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Transaction Summary */}
              {uploadResult.results?.transaction_summary?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" mb={2}>
                    <SwapHoriz sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Transaction Summary ({uploadResult.results.transaction_summary.length} users)
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Email</TableCell>
                          <TableCell align="center">Deposits</TableCell>
                          <TableCell align="center">Withdrawals</TableCell>
                          <TableCell align="right">Total Deposited</TableCell>
                          <TableCell align="right">Total Withdrawn</TableCell>
                          <TableCell align="right">Net Amount</TableCell>
                          <TableCell align="right">Final Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.results.transaction_summary?.map((summary) => (
                          <TableRow key={summary.email}>
                            <TableCell>{summary.email}</TableCell>
                            <TableCell align="center">
                              <Chip label={summary.deposit_count} size="small" color="success" />
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={summary.withdrawal_count} size="small" color="error" />
                            </TableCell>
                            <TableCell align="right">{formatCurrency(summary.total_deposited)}</TableCell>
                            <TableCell align="right">{formatCurrency(summary.total_withdrawn)}</TableCell>
                            <TableCell align="right">
                              <Typography color={summary.net_amount >= 0 ? 'success.main' : 'error.main'}>
                                {formatCurrency(summary.net_amount)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography color={summary.final_balance >= 0 ? 'success.main' : 'error.main'}>
                                {formatCurrency(summary.final_balance)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Processing Log */}
              {uploadResult.results?.processing_log?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6">
                      <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Processing Log ({uploadResult.results.processing_log.length} transactions)
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setShowProcessingLog(!showProcessingLog)}
                    >
                      {showProcessingLog ? 'Hide' : 'Show'} Log
                    </Button>
                  </Box>
                  
                  <Collapse in={showProcessingLog}>
                    <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell align="right">Running Balance</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {uploadResult.results.processing_log?.map((log, index) => (
                            <TableRow key={index}>
                              <TableCell>{new Date(log.transaction_date).toLocaleDateString()}</TableCell>
                              <TableCell>{log.email}</TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center">
                                  {getTransactionTypeIcon(log.type)}
                                  <Chip 
                                    label={log.type} 
                                    size="small" 
                                    color={getTransactionTypeColor(log.type)} 
                                    sx={{ ml: 1 }}
                                  />
                                </Box>
                              </TableCell>
                              <TableCell align="right">{formatCurrency(log.amount)}</TableCell>
                              <TableCell align="right">
                                {log.running_balance !== undefined ? formatCurrency(log.running_balance) : '-'}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={log.status} 
                                  size="small" 
                                  color={log.status === 'success' ? 'success' : 'error'} 
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Box>
              )}

              {/* Warnings */}
              {uploadResult.results?.warnings?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" mb={2}>
                    <Warning sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
                    Warnings
                  </Typography>
                  <List>
                    {uploadResult.results.warnings?.map((warning, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={warning} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Errors */}
              {uploadResult.results?.errors?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" mb={2}>
                    <Error sx={{ mr: 1, verticalAlign: 'middle', color: 'error.main' }} />
                    Errors
                  </Typography>
                  <List>
                    {uploadResult.results.errors?.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Error color="error" />
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

      {/* Instructions */}
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Info sx={{ mr: 1, color: 'info.main' }} />
            <Typography variant="h6">Instructions</Typography>
          </Box>
          <List>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="Download the template and fill in transaction data"
                secondary="Required: email, transaction_date, type (deposit/withdrawal), amount. Optional: first_name, last_name, phone for new users"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="Transactions are processed chronologically"
                secondary="All transactions are sorted by date and processed in order, regardless of row order in Excel"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="LIFO withdrawal rules applied"
                secondary="Withdrawals are processed using Last In, First Out rules from the most recent deposits"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="Automatic user creation and balance management"
                secondary="New users are created with temporary passwords, and all balances are automatically calculated"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TransactionImport;