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
} from '@mui/icons-material';
import { adminApi } from '../../services/api';

interface OnboardingResult {
  message: string;
  summary: {
    total_rows_processed: number;
    unique_users_processed: number;
    users_created: number;
    deposits_created: number;
    errors: number;
  };
  results: {
    created_users: Array<{
      email: string;
      user_id: number;
      temp_password: string;
      deposits_count: number;
    }>;
    created_deposits: Array<{
      email: string;
      deposit_id: number;
      amount: number;
      start_date: string;
    }>;
    errors: string[];
    warnings: string[];
  };
}

const ClientOnboarding: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<OnboardingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
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

      const result = await adminApi.uploadClientOnboarding(formData);
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
      const response = await adminApi.downloadClientOnboardingTemplate();
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'client_onboarding_template.xlsx';
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Client Onboarding
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Upload an Excel file to onboard multiple clients with initial deposits. New users will be created with temporary passwords, and deposits will be added to their accounts.
      </Typography>

      {/* Template Download Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Description sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Download Template</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Download the Excel template with the required format and example data.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadTemplate}
          >
            Download Client Onboarding Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <CloudUpload sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Upload Client Data</Typography>
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
                Processing client onboarding...
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
      {uploadResult && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">Onboarding Complete</Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              {uploadResult.message}
              {uploadResult.results.created_users.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                  ⚠️ Important: {uploadResult.results.created_users.length} temporary passwords generated. 
                  Click "Show Passwords" below to view and copy them.
                </Typography>
              )}
            </Alert>

            {/* Summary */}
            <Box display="flex" gap={3} mb={3} flexWrap="wrap">
              <Box>
                <Typography variant="h4" color="primary">
                  {uploadResult.summary.total_rows_processed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Rows
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="secondary.main">
                  {uploadResult.summary.unique_users_processed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Unique Users
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="success.main">
                  {uploadResult.summary.users_created}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Users Created
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="info.main">
                  {uploadResult.summary.deposits_created}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deposits Created
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
              {uploadResult.results.created_users.length > 0 && (
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
                          Copy and share securely with clients via encrypted email or secure channel.
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
                          <TableCell>User ID</TableCell>
                          <TableCell>Deposits</TableCell>
                          {showPasswords && <TableCell>Temp Password</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.results.created_users.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.user_id}</TableCell>
                            <TableCell>
                              <Chip 
                                label={`${user.deposits_count} deposit${user.deposits_count !== 1 ? 's' : ''}`}
                                size="small"
                                color="info"
                              />
                            </TableCell>
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

              {/* Created Deposits */}
              {uploadResult.results.created_deposits.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" mb={2}>
                    <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Deposits Created ({uploadResult.results.created_deposits.length})
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Email</TableCell>
                          <TableCell>Deposit ID</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Start Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadResult.results.created_deposits.map((deposit) => (
                          <TableRow key={deposit.deposit_id}>
                            <TableCell>{deposit.email}</TableCell>
                            <TableCell>{deposit.deposit_id}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(deposit.amount)}
                            </TableCell>
                            <TableCell>
                              {new Date(deposit.start_date).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Warnings */}
              {uploadResult.results.warnings.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" mb={2}>
                    <Warning sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
                    Warnings
                  </Typography>
                  <List>
                    {uploadResult.results.warnings.map((warning, index) => (
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
              {uploadResult.results.errors.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" mb={2}>
                    <Error sx={{ mr: 1, verticalAlign: 'middle', color: 'error.main' }} />
                    Errors
                  </Typography>
                  <List>
                    {uploadResult.results.errors.map((error, index) => (
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
                primary="Download the template and fill in client data"
                secondary="Required: email, deposit_amount. Optional: start_date (defaults to today), first_name, last_name, phone"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="New users will be created with temporary passwords"
                secondary="Share these passwords securely with clients for first login"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="Initial deposits will be added to client accounts"
                secondary="All deposits will have 12% annual yield rate and start earning immediately"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="Multiple deposits per user are supported"
                secondary="Same email can have multiple rows with different deposit amounts and start dates"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClientOnboarding;