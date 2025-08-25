import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Pagination,
  CircularProgress,
  Alert,
  InputAdornment,
  useTheme,
  alpha,
  Fade,
} from '@mui/material';
import { 
  FilterList, 
  GetApp, 
  Search, 
  Receipt, 
  TrendingUp,
  TrendingDown,
  AccountBalance 
} from '@mui/icons-material';

interface Transaction {
  id: number;
  amount: string;
  transaction_type: string;
  bonus_percentage: string | null;
  description: string;
  transaction_date: string;
  created_at: string;
  account_number: string;
}

interface TransactionResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface TransactionHistoryProps {
  loanId: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ loanId }) => {
  const theme = useTheme();
  const [data, setData] = useState<TransactionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'loan':
        return 'info';
      case 'monthly_payment':
        return 'success';
      case 'bonus':
        return 'secondary';
      case 'withdrawal':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'loan':
        return 'Initial Loan';
      case 'monthly_payment':
        return 'Monthly Payment';
      case 'bonus':
        return 'Bonus Payment';
      case 'withdrawal':
        return 'Withdrawal';
      default:
        return type;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'loan':
        return <AccountBalance sx={{ fontSize: 20 }} />;
      case 'monthly_payment':
        return <TrendingUp sx={{ fontSize: 20 }} />;
      case 'bonus':
        return <TrendingUp sx={{ fontSize: 20 }} />;
      case 'withdrawal':
        return <TrendingDown sx={{ fontSize: 20 }} />;
      default:
        return <Receipt sx={{ fontSize: 20 }} />;
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });

      if (filters.type) {
        params.append('type', filters.type);
      }
      if (filters.startDate) {
        params.append('start_date', filters.startDate);
      }
      if (filters.endDate) {
        params.append('end_date', filters.endDate);
      }

      const response = await fetch(
        `http://localhost:5002/api/loans/${loanId}/transactions?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
      setPage(1); // Reset to first page when searching
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // Debounce start date input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setFilters(prev => ({ ...prev, startDate: startDateInput }));
      setPage(1); // Reset to first page when filtering
    }, 500); // 500ms debounce delay for dates

    return () => clearTimeout(debounceTimer);
  }, [startDateInput]);

  // Debounce end date input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setFilters(prev => ({ ...prev, endDate: endDateInput }));
      setPage(1); // Reset to first page when filtering
    }, 500); // 500ms debounce delay for dates

    return () => clearTimeout(debounceTimer);
  }, [endDateInput]);

  useEffect(() => {
    if (loanId) {
      fetchTransactions();
    }
  }, [loanId, page, filters.type, filters.startDate, filters.endDate]); // Removed filters.search from dependencies

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handleClearFilters = () => {
    setFilters({ type: '', startDate: '', endDate: '', search: '' });
    setSearchInput('');
    setStartDateInput('');
    setEndDateInput('');
    setPage(1);
  };

  // Client-side filtering for search
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (!filters.search.trim()) return data.transactions;
    
    const searchTerm = filters.search.toLowerCase();
    return data.transactions.filter(transaction =>
      transaction.description.toLowerCase().includes(searchTerm) ||
      transaction.transaction_type.toLowerCase().includes(searchTerm) ||
      getTransactionTypeLabel(transaction.transaction_type).toLowerCase().includes(searchTerm) ||
      formatCurrency(transaction.amount).toLowerCase().includes(searchTerm)
    );
  }, [data?.transactions, filters.search]);

  const totalPages = data ? Math.ceil(data.pagination.total / limit) : 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Receipt sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Transaction History
          </Typography>
        </Box>
        {data && (
          <Chip 
            label={`${filteredTransactions.length} of ${data.pagination.total} transactions`}
            color="primary"
            variant="outlined"
          />
        )}
      </Box>

      {/* Search and Filter Controls */}
      <Card sx={{ 
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search transactions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              size="small"
              sx={{ minWidth: 300, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.type}
                label="Type"
                onChange={(e) => handleFilterChange('type', e.target.value)}
                startAdornment={<FilterList sx={{ color: 'text.secondary', mr: 1 }} />}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="loan">Initial Loan</MenuItem>
                <MenuItem value="monthly_payment">Monthly Payment</MenuItem>
                <MenuItem value="bonus">Bonus Payment</MenuItem>
                <MenuItem value="withdrawal">Withdrawal</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Start Date"
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              label="End Date"
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            {(filters.type || startDateInput || endDateInput || searchInput) && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearFilters}
                sx={{
                  height: '40px',
                  minHeight: '40px',
                  px: 2,
                }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Transaction Cards */}
      {filteredTransactions.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredTransactions.map((transaction, index) => (
            <Fade in={true} timeout={600 + index * 100} key={transaction.id}>
              <Card sx={{
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                borderRadius: 3,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 2, 
                        background: alpha(getTransactionTypeColor(transaction.transaction_type) === 'success' ? theme.palette.success.main :
                                         getTransactionTypeColor(transaction.transaction_type) === 'info' ? theme.palette.info.main :
                                         getTransactionTypeColor(transaction.transaction_type) === 'secondary' ? theme.palette.secondary.main :
                                         theme.palette.warning.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {getTransactionIcon(transaction.transaction_type)}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            label={getTransactionTypeLabel(transaction.transaction_type)}
                            color={getTransactionTypeColor(transaction.transaction_type) as any}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(transaction.transaction_date)}
                          </Typography>
                        </Box>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={transaction.description}
                        >
                          {transaction.description}
                        </Typography>
                        {transaction.bonus_percentage && (
                          <Typography variant="body2" color="secondary.main" sx={{ mt: 0.5 }}>
                            Bonus: {(parseFloat(transaction.bonus_percentage) * 100).toFixed(2)}%
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 'fit-content' }}>
                      <Typography
                        variant="h6"
                        sx={{
                          color: parseFloat(transaction.amount) >= 0 ? 'success.main' : 'warning.main',
                          fontWeight: 700,
                        }}
                      >
                        {parseFloat(transaction.amount) >= 0 ? '+' : ''}
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          ))}
        </Box>
      ) : (
        <Card sx={{ 
          textAlign: 'center', 
          py: 8,
          background: alpha(theme.palette.background.paper, 0.5),
          border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`
        }}>
          <CardContent>
            <Receipt sx={{ fontSize: 64, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {data?.transactions.length === 0 ? 'No transactions found' : 'No transactions match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data?.transactions.length === 0 
                ? 'Transactions will appear here once they are processed'
                : 'Try adjusting your search terms or filters'
              }
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Card sx={{ 
            background: alpha(theme.palette.primary.main, 0.02),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}>
            <CardContent sx={{ py: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2,
                    fontWeight: 600,
                    '&.Mui-selected': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      color: 'white',
                    }
                  }
                }}
              />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default TransactionHistory; 