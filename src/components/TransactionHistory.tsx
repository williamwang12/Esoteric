import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { FilterList, GetApp } from '@mui/icons-material';

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

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ loanId }): React.ReactElement => {
  const [data, setData] = useState<TransactionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
  });
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
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
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

  useEffect(() => {
    if (loanId) {
      fetchTransactions();
    }
  }, [loanId, page, filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handleClearFilters = () => {
    setFilters({ type: '', startDate: '', endDate: '' });
    setPage(1);
  };

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
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <FilterList sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h2">
            Transaction History
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {data && (
            <Typography variant="body2" color="text.secondary">
              {data.pagination.total} transactions
            </Typography>
          )}
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type}
              label="Type"
              onChange={(e) => handleFilterChange('type', e.target.value)}
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
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            size="small"
            label="End Date"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Button
            variant="outlined"
            size="small"
            onClick={handleClearFilters}
            disabled={!filters.type && !filters.startDate && !filters.endDate}
          >
            Clear Filters
          </Button>
        </Box>

        {/* Transaction Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Bonus %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.transactions.map((transaction) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(transaction.transaction_date)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getTransactionTypeLabel(transaction.transaction_type)}
                      color={getTransactionTypeColor(transaction.transaction_type) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transaction.description}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{
                        color: parseFloat(transaction.amount) >= 0 ? 'success.main' : 'warning.main',
                        fontWeight: 'bold',
                      }}
                    >
                      {parseFloat(transaction.amount) >= 0 ? '+' : ''}
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {transaction.bonus_percentage ? (
                      <Typography variant="body2" color="secondary.main">
                        {(parseFloat(transaction.bonus_percentage) * 100).toFixed(2)}%
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}

        {/* Empty State */}
        {data?.transactions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No transactions found for the selected filters.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory; 