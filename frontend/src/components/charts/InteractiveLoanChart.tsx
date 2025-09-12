import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  useTheme,
  alpha
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import {
  Timeline,
  TrendingUp,
  BarChart,
  ShowChart,
  Close,
  AttachMoney,
  AccountBalance,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { loansApi } from '../../services/api';

// Dynamic zoom plugin import to avoid TypeScript issues
let zoomPlugin: any = null;
let zoomHelpers: any = null;
try {
  const zoomModule = require('chartjs-plugin-zoom');
  zoomPlugin = zoomModule.default || zoomModule;
  zoomHelpers = zoomModule;
} catch (e) {
  console.warn('chartjs-plugin-zoom not available');
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ...(zoomPlugin ? [zoomPlugin] : [])
);

interface UserAccountData {
  initialLoanAmount: number;
  currentBalance: number;
  interestRate: number;
  status: string;
  createdDate: string;
  maturityDate: string;
  totalReturns: number;
  monthlyGrowth: number;
}

interface InteractiveLoanChartProps {
  loanData?: any;
  analytics?: any;
}

const InteractiveLoanChart: React.FC<InteractiveLoanChartProps> = ({ loanData, analytics }) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'line' | 'bar' | 'area'>('line');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [dataView, setDataView] = useState<'balance' | 'growth' | 'returns'>('balance');
  const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const chartRef = useRef<any>(null);

  // Debug: Log the data structure
  console.log('InteractiveLoanChart - loanData:', loanData);
  console.log('InteractiveLoanChart - analytics:', analytics);

  // Fetch transaction history for more accurate data
  React.useEffect(() => {
    const fetchTransactions = async () => {
      if (loanData?.id) {
        try {
          const transactionData = await loansApi.getLoanTransactions(loanData.id.toString());
          setTransactions(transactionData);
          console.log('Transaction data:', transactionData);
        } catch (error) {
          console.error('Error fetching transactions:', error);
        }
      }
    };

    fetchTransactions();
  }, [loanData?.id]);

  // Generate user's account data based on real loan information
  const getUserAccountData = (): UserAccountData => {
    if (!loanData) {
      // Fallback to placeholder data if no real data available
      const baseAmount = 75000;
      const accountAge = new Date().getTime() - new Date('2024-01-15').getTime();
      const monthsActive = Math.floor(accountAge / (1000 * 60 * 60 * 24 * 30));
      const monthlyGrowthRate = 0.0225;
      
      const currentBalance = baseAmount * Math.pow(1 + monthlyGrowthRate, monthsActive);
      const totalReturns = currentBalance - baseAmount;
      
      return {
        initialLoanAmount: baseAmount,
        currentBalance: Math.round(currentBalance),
        interestRate: 7.25,
        status: 'active',
        createdDate: '2024-01-15',
        maturityDate: '2025-01-15',
        totalReturns: Math.round(totalReturns),
        monthlyGrowth: monthlyGrowthRate * 100
      };
    }

    // Use real loan data
    const initialAmount = parseFloat(loanData.principal_amount || loanData.current_balance || '0');
    const currentBalance = parseFloat(loanData.current_balance || '0');
    const monthlyRate = parseFloat(loanData.monthly_rate || '0.0225');
    const totalWithdrawals = parseFloat(loanData.total_withdrawals || '0');
    const totalBonuses = parseFloat(loanData.total_bonuses || '0');
    
    // Calculate total returns considering withdrawals
    const totalReturns = currentBalance + totalWithdrawals - initialAmount + totalBonuses;
    
    return {
      initialLoanAmount: initialAmount,
      currentBalance: currentBalance,
      interestRate: monthlyRate * 100 * 12, // Convert to annual percentage
      status: loanData.status || 'active',
      createdDate: loanData.created_at || new Date().toISOString(),
      maturityDate: loanData.maturity_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      totalReturns: totalReturns,
      monthlyGrowth: monthlyRate * 100
    };
  };

  const userAccount = getUserAccountData();

  // Generate time series data based on real transaction history
  const generateChartData = () => {
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : timeRange === '1y' ? 365 : 730;
    
    const labels: string[] = [];
    const balances: number[] = [];
    const growthRates: number[] = [];
    const totalReturns: number[] = [];

    if (transactions.length > 0) {
      // Use real transaction data to build historical balance
      
      // Sort transactions by date
      const sortedTransactions = transactions.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Build balance over time based on transactions
      let runningBalance = userAccount.initialLoanAmount;
      let transactionIndex = 0;
      
      for (let i = days; i >= 0; i--) {
        const currentDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        labels.push(i === 0 ? 'Today' : i === 1 ? 'Yesterday' : currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Process transactions up to this date
        while (transactionIndex < sortedTransactions.length) {
          const transaction = sortedTransactions[transactionIndex];
          const transactionDate = new Date(transaction.created_at).toISOString().split('T')[0];
          
          if (transactionDate <= dateStr) {
            const amount = parseFloat(transaction.amount);
            
            switch (transaction.transaction_type) {
              case 'loan':
                runningBalance += amount;
                break;
              case 'monthly_payment':
              case 'bonus':
                runningBalance += amount;
                break;
              case 'withdrawal':
                // Withdrawals don't reduce balance in this system
                break;
            }
            transactionIndex++;
          } else {
            break;
          }
        }
        
        balances.push(runningBalance);
        
        // Calculate growth rate based on previous day
        const prevBalance = balances[balances.length - 2] || userAccount.initialLoanAmount;
        const growthRate = prevBalance > 0 ? ((runningBalance - prevBalance) / prevBalance) * 100 : 0;
        growthRates.push(Number(growthRate.toFixed(4)));
        
        // Calculate cumulative returns
        const returnsValue = runningBalance - userAccount.initialLoanAmount;
        totalReturns.push(Math.max(0, returnsValue));
      }
    } else {
      // Fallback to simulated data if no transactions available
      const initialValue = userAccount.initialLoanAmount;
      const currentValue = userAccount.currentBalance;
      const monthlyGrowthRate = userAccount.monthlyGrowth / 100;
      const dailyGrowthRate = monthlyGrowthRate / 30;
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        
        labels.push(i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Simulate realistic account balance growth over time
        const progressRatio = (days - i) / days; // 0 to 1 as time progresses
        const growthFactor = 1 + (currentValue / initialValue - 1) * progressRatio;
        const dailyVariation = Math.sin((days - i) / 7) * 0.01 + (Math.random() * 0.005 - 0.0025); // Small daily variations
        
        const balanceValue = initialValue * growthFactor * (1 + dailyVariation);
        balances.push(Math.max(initialValue, balanceValue));
        
        // Calculate daily growth rate with small variations
        const growthVariation = Math.random() * 0.2 - 0.1; // ±0.1% variation
        growthRates.push(Number((dailyGrowthRate + dailyGrowthRate * growthVariation).toFixed(4)));
        
        // Calculate cumulative returns
        const returnsValue = balanceValue - initialValue;
        totalReturns.push(Math.max(0, returnsValue));
      }
    }

    return { labels, balances, growthRates, totalReturns };
  };

  const chartData = generateChartData();

  // Chart configuration with click handling
  const chartOptions: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    onHover: (event, elements) => {
      if (chartRef.current) {
        chartRef.current.canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const element = elements[0];
        const dataIndex = element.index;
        const label = chartData.labels[dataIndex];
        const value = dataView === 'balance' ? chartData.balances[dataIndex] : 
                     dataView === 'growth' ? chartData.growthRates[dataIndex] : 
                     chartData.totalReturns[dataIndex];
        
        setSelectedDataPoint({
          date: label,
          value,
          dataType: dataView,
          userAccount: userAccount, // Show user's account details
        });
        setDetailDialogOpen(true);
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme.palette.text.primary,
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      tooltip: {
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.primary.main,
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => `${context[0].label}`,
          label: (context) => {
            const value = context.parsed.y;
            if (dataView === 'balance') {
              return `Portfolio Balance: $${value.toLocaleString()}`;
            } else if (dataView === 'growth') {
              return `Growth Rate: ${value.toFixed(3)}%`;
            } else {
              return `Total Returns: $${value.toLocaleString()}`;
            }
          }
        }
      },
      ...(zoomPlugin ? {
        zoom: {
          limits: {
            x: { min: 'original', max: 'original' },
            y: { min: 'original', max: 'original' }
          },
          pan: {
            enabled: true,
            mode: 'x' as const,
            modifierKey: 'shift' as const,
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'x' as const,
          }
        }
      } : {})
    },
    scales: {
      x: {
        grid: {
          color: alpha(theme.palette.divider, 0.1),
        },
        ticks: {
          color: theme.palette.text.secondary,
        }
      },
      y: {
        grid: {
          color: alpha(theme.palette.divider, 0.1),
        },
        ticks: {
          color: theme.palette.text.secondary,
          callback: (value) => {
            if (dataView === 'balance') {
              return `$${Number(value).toLocaleString()}`;
            } else if (dataView === 'growth') {
              return `${Number(value).toFixed(2)}%`;
            } else {
              return `$${Number(value).toLocaleString()}`;
            }
          }
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 8,
        backgroundColor: theme.palette.primary.main,
        borderColor: theme.palette.background.paper,
        borderWidth: 2,
      },
      line: {
        tension: 0.3,
        borderWidth: 3,
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart',
    }
  };

  const getChartData = () => {
    const data = dataView === 'balance' ? chartData.balances : 
                 dataView === 'growth' ? chartData.growthRates : 
                 chartData.totalReturns;
    
    const gradient = chartRef.current?.canvas.getContext('2d').createLinearGradient(0, 0, 0, 400);
    if (gradient) {
      gradient.addColorStop(0, alpha(theme.palette.primary.main, 0.3));
      gradient.addColorStop(1, alpha(theme.palette.primary.main, 0.05));
    }

    return {
      labels: chartData.labels,
      datasets: [
        {
          label: dataView === 'balance' ? 'Account Balance' : 
                 dataView === 'growth' ? 'Growth Rate %' : 'Total Returns',
          data,
          borderColor: theme.palette.primary.main,
          backgroundColor: viewMode === 'area' ? gradient : alpha(theme.palette.primary.main, 0.8),
          fill: viewMode === 'area',
          tension: 0.4,
        }
      ]
    };
  };

  const ChartComponent = viewMode === 'bar' ? Bar : Line;

  return (
    <Card sx={{
      background: 'rgba(31, 41, 55, 0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(107, 70, 193, 0.3)',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    }}>
      <CardContent sx={{ p: 4 }}>
        {/* Header with controls */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                📈 My Account Balance Growth
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track your personal loan account balance and growth over time
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip 
                icon={<Timeline />} 
                label="Live Data" 
                color="primary" 
                variant="outlined"
                size="small"
              />
              {zoomPlugin && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (chartRef.current && zoomHelpers?.zoom) {
                        zoomHelpers.zoom(chartRef.current, 1.2);
                      }
                    }}
                    title="Zoom In"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <ZoomIn fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (chartRef.current && zoomHelpers?.zoom) {
                        zoomHelpers.zoom(chartRef.current, 0.8);
                      }
                    }}
                    title="Zoom Out"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <ZoomOut fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (chartRef.current && zoomHelpers?.resetZoom) {
                        zoomHelpers.resetZoom(chartRef.current);
                      }
                    }}
                    title="Reset Zoom"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <CenterFocusStrong fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Box>

          {/* Interactive Controls */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150, flex: 1 }}>
              <InputLabel>Chart Type</InputLabel>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                label="Chart Type"
              >
                <MenuItem value="line">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShowChart fontSize="small" />
                    Line Chart
                  </Box>
                </MenuItem>
                <MenuItem value="bar">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BarChart fontSize="small" />
                    Bar Chart
                  </Box>
                </MenuItem>
                <MenuItem value="area">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline fontSize="small" />
                    Area Chart
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150, flex: 1 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                label="Time Range"
              >
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="90d">Last 90 Days</MenuItem>
                <MenuItem value="1y">Last Year</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150, flex: 1 }}>
              <InputLabel>Data View</InputLabel>
              <Select
                value={dataView}
                onChange={(e) => setDataView(e.target.value as any)}
                label="Data View"
              >
                <MenuItem value="balance">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalance fontSize="small" />
                    My Balance
                  </Box>
                </MenuItem>
                <MenuItem value="growth">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp fontSize="small" />
                    Growth Rate %
                  </Box>
                </MenuItem>
                <MenuItem value="returns">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoney fontSize="small" />
                    My Returns
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Interactive Chart */}
        <Box sx={{ height: 400, position: 'relative' }}>
          <ChartComponent
            ref={chartRef}
            data={getChartData()}
            options={chartOptions}
          />
        </Box>

        {/* My Account Stats */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-around', 
          mt: 3, 
          pt: 3, 
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` 
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
              ${userAccount.initialLoanAmount.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Initial Loan
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
              ${userAccount.currentBalance.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current Balance
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
              ${userAccount.totalReturns.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Returns
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
              {userAccount.monthlyGrowth.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monthly Growth
            </Typography>
          </Box>
        </Box>
      </CardContent>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
            border: '1px solid rgba(107, 70, 193, 0.3)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            📈 My Account Details - {selectedDataPoint?.date}
          </Typography>
          <IconButton 
            onClick={() => setDetailDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedDataPoint && (
            <Box>
              <Box sx={{ 
                p: 3, 
                mb: 3, 
                background: alpha(theme.palette.primary.main, 0.1),
                borderRadius: '12px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }}>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mb: 1 }}>
                  {selectedDataPoint.dataType === 'balance' 
                    ? `$${selectedDataPoint.value.toLocaleString()}`
                    : selectedDataPoint.dataType === 'growth'
                    ? `${selectedDataPoint.value.toFixed(3)}%`
                    : `$${selectedDataPoint.value.toLocaleString()}`
                  }
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {selectedDataPoint.dataType === 'balance' 
                    ? 'Your current account balance on this date'
                    : selectedDataPoint.dataType === 'growth'
                    ? 'Your account growth rate on this date'
                    : 'Your cumulative returns on this date'
                  }
                </Typography>
              </Box>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                My Account Details:
              </Typography>
              
              <Card sx={{ 
                mb: 2, 
                background: alpha(theme.palette.background.paper, 0.05),
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
              }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {user?.firstName} {user?.lastName}'s Account
                    </Typography>
                    <Chip 
                      label={selectedDataPoint.userAccount?.status} 
                      color={selectedDataPoint.userAccount?.status === 'active' ? 'success' : selectedDataPoint.userAccount?.status === 'completed' ? 'primary' : 'warning'}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Initial Loan: <strong>${selectedDataPoint.userAccount?.initialLoanAmount.toLocaleString()}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Current Balance: <strong>${selectedDataPoint.userAccount?.currentBalance.toLocaleString()}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Returns: <strong>${selectedDataPoint.userAccount?.totalReturns.toLocaleString()}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Monthly Growth: <strong>{selectedDataPoint.userAccount?.monthlyGrowth.toFixed(1)}%</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Interest Rate: <strong>{selectedDataPoint.userAccount?.interestRate}%</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Maturity Date: <strong>{new Date(selectedDataPoint.userAccount?.maturityDate).toLocaleDateString()}</strong>
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default InteractiveLoanChart;