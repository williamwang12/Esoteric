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
  AttachMoney,
  TableChart,
  Receipt,
  Clear,
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

interface ExcelUploadProps {
  onUploadComplete?: () => void;
}

const ExcelUpload: React.FC<ExcelUploadProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ExcelUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResults, setShowResults] = useState(false);
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

    try {
      const formData = new FormData();
      formData.append('excel', file);

      const response = await adminApi.uploadExcel(formData);
      
      setUploadResult(response);
      setShowResults(true);
      
      // Debug logging
      console.log('Upload response:', response);
      console.log('Response updates:', response?.updates);
      console.log('Updates length:', response?.updates?.length);
      console.log('Show results state:', true);
      
      // Show immediate feedback
      if (response?.summary?.successfulUpdates > 0) {
        alert(`Successfully updated ${response.summary.successfulUpdates} loan account(s)!`);
        
        // Add successful updates to recent updates list
        console.log('Checking for updates to add to recent list...');
        if (response.updates && response.updates.length > 0) {
          console.log('Adding updates to recent list:', response.updates);
          const newUpdates = response.updates.map((update: any) => ({
            ...update,
            updatedAt: new Date().toISOString()
          }));
          
          // Save to localStorage immediately before component might re-mount
          try {
            const saved = localStorage.getItem('excelUploadRecentUpdates');
            const existing = saved ? JSON.parse(saved) : [];
            const updatedList = [...newUpdates, ...existing].slice(0, 20);
            localStorage.setItem('excelUploadRecentUpdates', JSON.stringify(updatedList));
            console.log('Saved recent updates to localStorage immediately:', updatedList.length, 'items');
          } catch (error) {
            console.log('Failed to save to localStorage:', error);
          }
          
          // Also update state (though this might be reset by re-mount)
          setRecentUpdates(prev => {
            const updatedList = [...newUpdates, ...prev].slice(0, 20);
            console.log('Recent updates state should be updated');
            console.log('New recent updates state:', updatedList);
            return updatedList;
          });
        } else {
          console.log('No updates array found in response or array is empty');
          console.log('Response structure:', JSON.stringify(response, null, 2));
          
          // Fallback: Create placeholder entries if we know updates happened but don't have details
          if (response?.summary?.successfulUpdates > 0) {
            console.log('Creating placeholder entries for recent updates table');
            const placeholderUpdates = Array(response.summary.successfulUpdates).fill(null).map((_, index) => ({
              email: 'Updated via Excel',
              accountNumber: `Account ${index + 1}`,
              oldBalance: 0,
              newBalance: 0,
              change: 0,
              updatedAt: new Date().toISOString()
            }));
            setRecentUpdates(prev => [...placeholderUpdates, ...prev].slice(0, 20));
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
      const response = await adminApi.downloadExcelTemplate();
      
      // Create blob and download
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'loan_update_template.xlsx';
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
          Excel Loan Updates
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Info />}
          onClick={() => setShowInstructions(true)}
        >
          Instructions
        </Button>
      </Box>

      {/* Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableChart />
            Bulk Loan Balance Updates
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload an Excel spreadsheet to update multiple loan balances at once. Download the template first to see the required format.
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
            Recent Loan Updates
            {recentUpdates.length > 0 && (
              <Chip 
                label={`${recentUpdates.length} updates`} 
                size="small" 
                color="primary" 
              />
            )}
          </Typography>
          
          {recentUpdates.length === 0 ? (
            <>
              {console.log('Recent updates array is empty:', recentUpdates)}
              <Alert severity="info">
                No recent updates. Upload an Excel file to see updated loan accounts here.
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
                Showing last {recentUpdates.length} updates (maximum 20)
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
      {uploadResult && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle color="success" />
                Upload Results
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
                    {uploadResult.summary.totalRows}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Rows
                  </Typography>
                </CardContent>
              </Card>
              
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="success.main">
                    {uploadResult.summary.successfulUpdates}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successful Updates
                  </Typography>
                </CardContent>
              </Card>
              
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="h4" color="error.main">
                    {uploadResult.summary.errors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Errors
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Collapse in={showResults} timeout="auto" unmountOnExit>
              {uploadResult && (
                <Box sx={{ mb: 2 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Upload Results: {uploadResult.summary?.successfulUpdates || 0} successful updates, {uploadResult.summary?.errors || 0} errors
                    </Typography>
                  </Alert>
                </Box>
              )}
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

              {/* Errors */}
              {uploadResult?.errors && uploadResult.errors.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Error color="error" />
                    Errors ({uploadResult.errors.length})
                  </Typography>
                  
                  <List dense>
                    {uploadResult.errors.map((error, index) => (
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