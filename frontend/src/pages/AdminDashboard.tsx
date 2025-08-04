import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Upload,
  Download,
  Delete,
  Visibility,
  ArrowBack,
  People,
  Description,
  AccountBalance,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { adminApi, documentsApi } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [userLoans, setUserLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: '',
    userId: '',
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await adminApi.getUsers();
      setUsers(usersData);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Users fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const [documentsData, loansData] = await Promise.all([
        adminApi.getUserDocuments(userId),
        adminApi.getUserLoans(userId),
      ]);
      
      setSelectedUser(documentsData.user);
      setUserDocuments(documentsData.documents);
      setUserLoans(loansData.loans);
    } catch (err) {
      console.error('User details fetch error:', err);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadForm.file || !uploadForm.title || !uploadForm.category || !uploadForm.userId) {
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('document', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('category', uploadForm.category);
      formData.append('userId', uploadForm.userId);

      await adminApi.uploadDocument(formData);
      
      // Refresh data
      await fetchUsers();
      if (selectedUser && selectedUser.id === uploadForm.userId) {
        await fetchUserDetails(uploadForm.userId);
      }

      // Reset form
      setUploadForm({
        title: '',
        category: '',
        userId: '',
        file: null,
      });
      setUploadDialogOpen(false);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await adminApi.deleteDocument(documentId);
      
      // Refresh data
      if (selectedUser) {
        await fetchUserDetails(selectedUser.id);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDocumentDownload = async (documentId: string, title: string) => {
    try {
      const blob = await documentsApi.downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = title;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Navigation Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
            ESOTERIC ADMIN PANEL
          </Typography>
          <Button
            variant="contained"
            startIcon={<Upload />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ ml: 2 }}
          >
            Upload Document
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !error && (
          <>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                aria-label="admin tabs"
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab 
                  icon={<People />} 
                  label="Users" 
                  id="admin-tab-0"
                  aria-controls="admin-tabpanel-0"
                />
                <Tab 
                  icon={<Description />} 
                  label="Documents" 
                  id="admin-tab-1"
                  aria-controls="admin-tabpanel-1"
                  disabled={!selectedUser}
                />
                <Tab 
                  icon={<AccountBalance />} 
                  label="Loans" 
                  id="admin-tab-2"
                  aria-controls="admin-tabpanel-2"
                  disabled={!selectedUser}
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <TabPanel value={tabValue} index={0}>
              {/* Users Tab */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    👥 User Management
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id} hover>
                            <TableCell>
                              {user.first_name} {user.last_name}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Chip 
                                label={user.role || 'user'} 
                                color={user.role === 'admin' ? 'secondary' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => {
                                  fetchUserDetails(user.id);
                                  setTabValue(1);
                                }}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {/* Documents Tab */}
              {selectedUser && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📄 Documents for {selectedUser.firstName} {selectedUser.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {selectedUser.email}
                    </Typography>
                    
                    {userDocuments.length > 0 ? (
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Title</TableCell>
                              <TableCell>Category</TableCell>
                              <TableCell>Size</TableCell>
                              <TableCell>Upload Date</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {userDocuments.map((doc) => (
                              <TableRow key={doc.id} hover>
                                <TableCell>{doc.title}</TableCell>
                                <TableCell>
                                  <Chip label={doc.category} size="small" />
                                </TableCell>
                                <TableCell>
                                  {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Unknown'}
                                </TableCell>
                                <TableCell>
                                  {new Date(doc.upload_date).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDocumentDownload(doc.id, doc.title)}
                                  >
                                    <Download />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteDocument(doc.id)}
                                    color="error"
                                  >
                                    <Delete />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          No documents found for this user.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {/* Loans Tab */}
              {selectedUser && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      💰 Loans for {selectedUser.firstName} {selectedUser.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {selectedUser.email}
                    </Typography>
                    
                    {userLoans.length > 0 ? (
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Account Number</TableCell>
                              <TableCell>Principal</TableCell>
                              <TableCell>Current Balance</TableCell>
                              <TableCell>Monthly Rate</TableCell>
                              <TableCell>Total Bonuses</TableCell>
                              <TableCell>Created</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {userLoans.map((loan) => (
                              <TableRow key={loan.id} hover>
                                <TableCell sx={{ fontFamily: 'monospace' }}>
                                  {loan.account_number}
                                </TableCell>
                                <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                                <TableCell>{formatCurrency(loan.current_balance)}</TableCell>
                                <TableCell>
                                  {(parseFloat(loan.monthly_rate) * 100).toFixed(1)}%
                                </TableCell>
                                <TableCell>{formatCurrency(loan.total_bonuses)}</TableCell>
                                <TableCell>
                                  {new Date(loan.created_at).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          No loan accounts found for this user.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabPanel>
          </>
        )}
      </Container>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Document Title"
              value={uploadForm.title}
              onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={uploadForm.category}
                label="Category"
                onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="statement">Statement</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="invoice">Invoice</MenuItem>
                <MenuItem value="receipt">Receipt</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>User</InputLabel>
              <Select
                value={uploadForm.userId}
                label="User"
                onChange={(e) => setUploadForm(prev => ({ ...prev, userId: e.target.value }))}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              component="label"
              variant="outlined"
              startIcon={<Upload />}
              sx={{ justifyContent: 'flex-start' }}
            >
              {uploadForm.file ? uploadForm.file.name : 'Choose File'}
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadForm(prev => ({ ...prev, file }));
                  }
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUploadDocument}
            variant="contained"
            disabled={!uploadForm.file || !uploadForm.title || !uploadForm.category || !uploadForm.userId || uploading}
          >
            {uploading ? <CircularProgress size={20} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard; 