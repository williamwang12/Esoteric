import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Autocomplete,
  IconButton,
  Tooltip,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { adminApi } from '../../services/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface YieldDeposit {
  id: number;
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  principal_amount: string;
  annual_yield_rate: string;
  start_date: string;
  status: string;
  last_payout_date: string | null;
  total_paid_out: string;
  next_payout_date: string;
  annual_payout: string;
  account_balance: string;
  notes: string | null;
  created_at: string;
}

interface CreateDepositData {
  user_id: number;
  principal_amount: number;
  start_date: string;
  notes: string;
}

const YieldDeposits: React.FC = () => {
  const [deposits, setDeposits] = useState<YieldDeposit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<YieldDeposit | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Daily yield payment state
  const [dailyYieldStatus, setDailyYieldStatus] = useState<any>(null);
  const [processingDailyYield, setProcessingDailyYield] = useState(false);
  const [selectedPaymentDate, setSelectedPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Create form state
  const [createForm, setCreateForm] = useState<CreateDepositData>({
    user_id: 0,
    principal_amount: 0,
    start_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchData();
    fetchDailyYieldStatus(selectedPaymentDate);
  }, [statusFilter]);

  useEffect(() => {
    fetchDailyYieldStatus(selectedPaymentDate);
  }, [selectedPaymentDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [depositsData, usersData] = await Promise.all([
        adminApi.getYieldDeposits({ status: statusFilter || undefined }),
        adminApi.getUsers()
      ]);
      setDeposits(depositsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setAlert({ type: 'error', message: 'Failed to fetch data' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeposit = async () => {
    try {
      if (!createForm.user_id || !createForm.principal_amount || !createForm.start_date) {
        setAlert({ type: 'error', message: 'Please fill in all required fields' });
        return;
      }

      await adminApi.createYieldDeposit({
        user_id: createForm.user_id,
        principal_amount: createForm.principal_amount,
        start_date: createForm.start_date,
        notes: createForm.notes || undefined
      });

      setAlert({ type: 'success', message: 'Deposit created successfully' });
      setCreateDialogOpen(false);
      setCreateForm({
        user_id: 0,
        principal_amount: 0,
        start_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to create deposit' });
    }
  };

  const handleDeleteDeposit = async () => {
    if (!selectedDeposit) return;

    try {
      await adminApi.deleteYieldDeposit(selectedDeposit.id);
      setAlert({ type: 'success', message: 'Deposit deleted successfully' });
      setDeleteDialogOpen(false);
      setSelectedDeposit(null);
      fetchData();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to delete deposit' });
    }
  };

  const handleToggleStatus = async (depositId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await adminApi.updateYieldDeposit(depositId, { status: newStatus });
      setAlert({ type: 'success', message: `Deposit ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully` });
      fetchData();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to update status' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  // Daily yield payment functions
  const fetchDailyYieldStatus = async (date?: string) => {
    try {
      const status = await adminApi.getDailyYieldStatus(date);
      setDailyYieldStatus(status);
    } catch (error) {
      console.error('Error fetching daily yield status:', error);
    }
  };

  const handleProcessDailyYield = async () => {
    try {
      setProcessingDailyYield(true);
      const result = await adminApi.processDailyYieldPayments(selectedPaymentDate);
      setAlert({ 
        type: 'success', 
        message: `Processed ${result.total_payments} payments totaling ${formatCurrency(result.total_amount)}` 
      });
      fetchDailyYieldStatus(selectedPaymentDate);
      fetchData(); // Refresh deposits to show updated balances
    } catch (error: any) {
      setAlert({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to process daily yield payments' 
      });
    } finally {
      setProcessingDailyYield(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate summary stats
  const totalActiveDeposits = deposits
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + parseFloat(d.principal_amount), 0);
  
  const totalAnnualLiability = deposits
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + parseFloat(d.annual_payout), 0);

  const nextPayoutsDue = deposits
    .filter(d => d.status === 'active' && new Date(d.next_payout_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    .length;

  return (
    <Box sx={{ p: 3 }}>
      {alert && (
        <Alert 
          severity={alert.type} 
          onClose={() => setAlert(null)}
          sx={{ mb: 2 }}
        >
          {alert.message}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Deposits
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create New Deposit
        </Button>
      </Box>

      {/* Process Overview */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          <strong>Deposits Process:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          • When creating a deposit, the <strong>principal amount is immediately added</strong> to the client's account balance
          <br />
          • Each year on the anniversary date, <strong>12% of the current principal</strong> is automatically paid out
          <br />
          • When clients withdraw funds, the withdrawal <strong>reduces deposits in LIFO order</strong> (newest first)
          <br />
          • Future payouts are automatically <strong>adjusted based on the reduced principal amounts</strong>
          <br />
          • Payouts continue annually until the deposit is fully withdrawn or marked inactive
        </Typography>
      </Alert>

      {/* Summary Cards */}
      <Box display="flex" gap={3} mb={3} flexWrap="wrap">
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <AccountBalanceIcon color="primary" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h6">
                  {formatCurrency(totalActiveDeposits)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Active Deposits
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <TrendingUpIcon color="warning" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h6">
                  {formatCurrency(totalAnnualLiability / 365)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Daily Yield Liability
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <ScheduleIcon color="info" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h6">
                  {nextPayoutsDue}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Payouts Due (30 days)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Daily Yield Payment Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Daily Yield Payments (12% ÷ 365 = 0.0329% daily)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Process daily yield payments for all active deposits. Payments are calculated as 12% annual yield divided by 365 days.
          </Typography>
          
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <Box sx={{ minWidth: 200 }}>
              <TextField
                label="Payment Date"
                type="date"
                value={selectedPaymentDate}
                onChange={(e) => setSelectedPaymentDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleProcessDailyYield}
                disabled={processingDailyYield}
                fullWidth
              >
                {processingDailyYield ? <CircularProgress size={20} /> : 'Process Daily Payments'}
              </Button>
            </Box>
            <Box sx={{ flex: 1, minWidth: 300 }}>
              {dailyYieldStatus && (
                <Box>
                  <Typography variant="body2">
                    <strong>Status for {dailyYieldStatus.date}:</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Processed: {dailyYieldStatus.payments_processed.count} payments 
                    ({formatCurrency(dailyYieldStatus.payments_processed.amount)})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending: {dailyYieldStatus.pending_payments} deposits
                  </Typography>
                  {dailyYieldStatus.is_complete && (
                    <Chip label="All payments complete" color="success" size="small" sx={{ mt: 1 }} />
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Filters */}
      <Box mb={3}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select
            value={statusFilter}
            label="Status Filter"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Deposits Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell align="right">Principal</TableCell>
              <TableCell align="right">Annual Payout</TableCell>
              <TableCell align="center">Start Date</TableCell>
              <TableCell align="center">Next Payout</TableCell>
              <TableCell align="right">Total Paid</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : deposits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No deposits found
                </TableCell>
              </TableRow>
            ) : (
              deposits.map((deposit) => (
                <TableRow key={deposit.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {deposit.first_name} {deposit.last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {deposit.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(deposit.principal_amount)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(deposit.annual_payout)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDate(deposit.start_date)}
                  </TableCell>
                  <TableCell align="center">
                    {deposit.next_payout_date ? formatDate(deposit.next_payout_date) : 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(deposit.total_paid_out)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={deposit.status}
                      color={getStatusColor(deposit.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      <Tooltip title={deposit.status === 'active' ? 'Deactivate' : 'Activate'}>
                        <Switch
                          checked={deposit.status === 'active'}
                          onChange={() => handleToggleStatus(deposit.id, deposit.status)}
                          size="small"
                        />
                      </Tooltip>
                      <Tooltip title="Delete Deposit">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedDeposit(deposit);
                            setDeleteDialogOpen(true);
                          }}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Deposit Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { 
            backgroundColor: '#424242',
            backgroundImage: 'none',
            opacity: 1
          }
        }}
        BackdropProps={{
          sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
        }}
      >
        <DialogTitle>Create New Deposit</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              options={users}
              getOptionLabel={(user) => `${user.email} - ${user.first_name} ${user.last_name}`}
              value={users.find(u => u.id === createForm.user_id) || null}
              onChange={(_, user) => setCreateForm(prev => ({ ...prev, user_id: user?.id || 0 }))}
              renderInput={(params) => (
                <TextField {...params} label="Client" required />
              )}
              PaperComponent={(props) => (
                <Paper {...props} sx={{ backgroundColor: '#424242', backgroundImage: 'none' }} />
              )}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Principal Amount"
                type="number"
                required
                value={createForm.principal_amount || ''}
                onChange={(e) => setCreateForm(prev => ({ 
                  ...prev, 
                  principal_amount: parseFloat(e.target.value) || 0 
                }))}
                InputProps={{
                  startAdornment: '$'
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Start Date"
                type="date"
                required
                value={createForm.start_date}
                onChange={(e) => setCreateForm(prev => ({ ...prev, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
            </Box>
            <Alert severity="info">
              <strong>12% Annual Yield</strong> - This deposit will pay{' '}
              <strong>{formatCurrency(createForm.principal_amount * 0.12)}</strong> annually
            </Alert>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={createForm.notes}
              onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateDeposit} variant="contained">
            Create Deposit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Deposit</DialogTitle>
        <DialogContent>
          {selectedDeposit && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete this deposit?
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Client:</strong> {selectedDeposit.first_name} {selectedDeposit.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Principal:</strong> {formatCurrency(selectedDeposit.principal_amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Status:</strong> {selectedDeposit.status}
              </Typography>
              <Alert severity="error" sx={{ mt: 2 }}>
                This action cannot be undone. The deposit will be marked as deleted.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteDeposit} variant="contained" color="error">
            Delete Deposit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default YieldDeposits;