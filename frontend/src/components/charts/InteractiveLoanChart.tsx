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
  alpha,
  Slider,
  Paper,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
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
  CenterFocusStrong,
  ExpandMore,
  Tune,
  Speed
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
  const [dataView, setDataView] = useState<'balance' | 'growth' | 'returns'>('balance');
  const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const chartRef = useRef<any>(null);

  // Interactive slider states
  const [projectionMonths, setProjectionMonths] = useState<number>(12);
  const [growthRateMultiplier, setGrowthRateMultiplier] = useState<number>(1);
  const [volatility, setVolatility] = useState<number>(0.002);
  const [showProjections, setShowProjections] = useState<boolean>(false);
  const [slidersExpanded, setSlidersExpanded] = useState<boolean>(false);
  const [daysToShow, setDaysToShow] = useState<number>(30);

  // Debug: Log the data structure
  console.log('InteractiveLoanChart - loanData:', loanData);
  console.log('InteractiveLoanChart - analytics:', analytics);
  console.log('InteractiveLoanChart - transactions:', transactions, 'length:', transactions?.length);
  
  // Force recompilation
  
  // Calculate portfolio composition based on real data
  const getPortfolioComposition = () => {
    if (!loanData || !Array.isArray(transactions) || transactions.length === 0) {
      // Default composition if no real data available
      return {
        principal: 0.6,
        monthlyPayments: 0.25,
        bonuses: 0.15
      };
    }

    const principalAmount = parseFloat(loanData.principal_amount || '0');
    const totalBonuses = parseFloat(loanData.total_bonuses || '0');
    
    // Calculate total monthly payments from transactions
    const monthlyPayments = transactions
      .filter(t => t && t.transaction_type === 'monthly_payment')
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const total = principalAmount + monthlyPayments + totalBonuses;
    
    if (total === 0) {
      return { principal: 1, monthlyPayments: 0, bonuses: 0 };
    }

    return {
      principal: principalAmount / total,
      monthlyPayments: monthlyPayments / total,
      bonuses: totalBonuses / total
    };
  };

  const portfolioComposition = getPortfolioComposition();
  console.log('Portfolio Composition:', portfolioComposition);
  console.log('Transactions:', transactions, 'Type:', typeof transactions, 'IsArray:', Array.isArray(transactions));

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
    const days = daysToShow;
    
    const labels: string[] = [];
    const balances: (number | null)[] = [];
    const projectedBalances: (number | null)[] = [];
    const growthRates: (number | null)[] = [];
    const projectedGrowthRates: (number | null)[] = [];
    const totalReturns: (number | null)[] = [];
    const projectedTotalReturns: (number | null)[] = [];
    
    // Separate historical and projected data
    const historicalLabels: string[] = [];
    const projectedLabels: string[] = [];

    if (Array.isArray(transactions) && transactions.length > 0) {
      // Use real transaction data to build historical balance
      
      // Sort transactions by date
      const sortedTransactions = transactions.sort((a, b) => 
        new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
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
          const transactionDate = new Date(transaction.transaction_date).toISOString().split('T')[0];
          
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
      // Fallback to realistic monotonic growth if no transactions available
      console.log('No transaction data available, using calculated growth model');
      const initialValue = userAccount.initialLoanAmount;
      const currentValue = userAccount.currentBalance;
      
      // Calculate realistic compound growth without random volatility
      const totalGrowthRatio = currentValue / initialValue;
      const dailyCompoundRate = Math.pow(totalGrowthRatio, 1 / days) - 1;
      
      // Generate historical data with smooth compound growth
      for (let i = days; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const isToday = i === 0;
        
        const label = isToday ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(label);
        historicalLabels.push(label);
        
        // Calculate balance using compound growth (loans grow steadily, not randomly)
        const daysElapsed = days - i;
        const balanceValue = initialValue * Math.pow(1 + dailyCompoundRate, daysElapsed);
        balances.push(Math.round(balanceValue));
        
        // Calculate actual daily growth rate (will be consistent for loans)
        const prevBalance = daysElapsed === 0 ? initialValue : (balances[balances.length - 2] || initialValue);
        const actualGrowthRate = prevBalance > 0 ? ((balanceValue - prevBalance) / prevBalance) * 100 : 0;
        growthRates.push(Number(actualGrowthRate.toFixed(4)));
        
        // Calculate cumulative returns
        const returnsValue = balanceValue - initialValue;
        totalReturns.push(Math.max(0, returnsValue));

        // Initialize projected arrays with null for historical periods
        projectedBalances.push(null);
        projectedGrowthRates.push(null);
        projectedTotalReturns.push(null);
      }

      // Generate projected data if enabled
      if (showProjections) {
        const projectionDays = projectionMonths * 30;
        const lastHistoricalValue = balances[balances.length - 1] || initialValue;
        
        for (let i = 1; i <= projectionDays; i++) {
          const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          labels.push(label);
          projectedLabels.push(label);
          
          // Project future growth using consistent compound rate with optional volatility
          const baseProjectedRate = dailyCompoundRate * growthRateMultiplier;
          
          // Only add volatility if user has set it, and keep it small for loan projections
          const projectedVariation = volatility > 0.01 ? 
            (Math.random() * volatility * 0.5 - volatility * 0.25) * (1 + i / projectionDays * 0.2) : 0;
          
          const projectedGrowthRate = baseProjectedRate + projectedVariation;
          const previousValue = i === 1 ? lastHistoricalValue : (projectedBalances[projectedBalances.length - 1] || lastHistoricalValue);
          const projectedValue = previousValue * (1 + projectedGrowthRate);
          
          // Add to projected arrays
          projectedBalances.push(Math.round(Math.max(lastHistoricalValue, projectedValue)));
          projectedGrowthRates.push(Number((projectedGrowthRate * 100).toFixed(4)));
          projectedTotalReturns.push(Math.max(0, projectedValue - initialValue));
          
          // Add null to historical arrays for projected periods
          balances.push(null);
          growthRates.push(null);
          totalReturns.push(null);
        }
      }
    }

    return { 
      labels, 
      balances, 
      projectedBalances, 
      growthRates, 
      projectedGrowthRates, 
      totalReturns, 
      projectedTotalReturns,
      historicalLabels,
      projectedLabels
    };
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
            
            // Special handling for stacked bar chart portfolio composition
            if (viewMode === 'bar' && dataView === 'balance' && context.dataset.stack) {
              const datasetLabel = context.dataset.label;
              return `${datasetLabel}: $${value.toLocaleString()}`;
            }
            
            if (dataView === 'balance') {
              return `Portfolio Balance: $${value.toLocaleString()}`;
            } else if (dataView === 'growth') {
              return `Growth Rate: ${value.toFixed(3)}%`;
            } else {
              return `Total Returns: $${value.toLocaleString()}`;
            }
          },
          footer: (context) => {
            // Add portfolio composition info for stacked bars
            if (viewMode === 'bar' && dataView === 'balance' && context[0]?.dataset?.stack) {
              const totalValue = context.reduce((sum, item) => sum + item.parsed.y, 0);
              return `Total: $${totalValue.toLocaleString()}`;
            }
            return '';
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
        },
        ...(viewMode === 'bar' && dataView === 'balance' ? { stacked: true } : {})
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
        },
        ...(viewMode === 'bar' && dataView === 'balance' ? { stacked: true } : {})
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
    const historicalData = dataView === 'balance' ? chartData.balances : 
                          dataView === 'growth' ? chartData.growthRates : 
                          chartData.totalReturns;
    
    const projectedData = dataView === 'balance' ? chartData.projectedBalances : 
                         dataView === 'growth' ? chartData.projectedGrowthRates : 
                         chartData.projectedTotalReturns;
    
    const gradient = chartRef.current?.canvas.getContext('2d').createLinearGradient(0, 0, 0, 400);
    if (gradient) {
      gradient.addColorStop(0, alpha(theme.palette.primary.main, 0.3));
      gradient.addColorStop(1, alpha(theme.palette.primary.main, 0.05));
    }

    const projectedGradient = chartRef.current?.canvas.getContext('2d').createLinearGradient(0, 0, 0, 400);
    if (projectedGradient) {
      projectedGradient.addColorStop(0, alpha(theme.palette.warning.main, 0.3));
      projectedGradient.addColorStop(1, alpha(theme.palette.warning.main, 0.05));
    }

    // For bar chart, create portfolio composition colors
    if (viewMode === 'bar' && dataView === 'balance') {
      // Create stacked bar datasets for portfolio composition
      const combinedData = historicalData.map((hist, index) => hist || projectedData[index] || 0);
      const principalData = combinedData.map(value => value * portfolioComposition.principal);
      const paymentsData = combinedData.map(value => value * portfolioComposition.monthlyPayments);
      const bonusesData = combinedData.map(value => value * portfolioComposition.bonuses);

      return {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Principal Investment',
            data: principalData,
            backgroundColor: alpha(theme.palette.primary.main, 0.8),
            borderColor: theme.palette.primary.main,
            borderWidth: 1,
            stack: 'balance',
          },
          {
            label: 'Monthly Payments',
            data: paymentsData,
            backgroundColor: alpha(theme.palette.secondary.main, 0.8),
            borderColor: theme.palette.secondary.main,
            borderWidth: 1,
            stack: 'balance',
          },
          {
            label: 'Bonuses & Returns',
            data: bonusesData,
            backgroundColor: alpha(theme.palette.success.main, 0.8),
            borderColor: theme.palette.success.main,
            borderWidth: 1,
            stack: 'balance',
          }
        ]
      };
    }

    const datasets = [
      {
        label: dataView === 'balance' ? 'Account Balance (Historical)' : 
               dataView === 'growth' ? 'Growth Rate % (Historical)' : 'Total Returns (Historical)',
        data: historicalData,
        borderColor: theme.palette.primary.main,
        backgroundColor: viewMode === 'area' ? gradient : alpha(theme.palette.primary.main, 0.8),
        fill: viewMode === 'area',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 8,
        spanGaps: false,
      }
    ];

    // Add projected dataset if projections are enabled and data exists
    if (showProjections && projectedData && projectedData.some(d => d !== null)) {
      datasets.push({
        label: dataView === 'balance' ? 'Account Balance (Projected)' : 
               dataView === 'growth' ? 'Growth Rate % (Projected)' : 'Total Returns (Projected)',
        data: projectedData,
        borderColor: theme.palette.warning.main,
        backgroundColor: viewMode === 'area' ? projectedGradient : alpha(theme.palette.warning.main, 0.6),
        fill: viewMode === 'area',
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        spanGaps: false,
        // @ts-ignore - Chart.js extended properties for dashed lines and point styles
        borderDash: [5, 5],
        pointStyle: 'triangle',
      } as any);
    }

    return {
      labels: chartData.labels,
      datasets
    };
  };

  const ChartComponent = viewMode === 'bar' ? Bar : Line;

  return (
    <Card sx={{
      background: 'rgba(31, 41, 55, 0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(111, 92, 242, 0.3)',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    }}>
      <CardContent sx={{ p: 4 }}>
        {/* Header with controls */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                My Account Balance Growth
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


        {/* Portfolio Composition Info for Bar Chart */}
        {viewMode === 'bar' && dataView === 'balance' && (
          <Box sx={{ 
            mb: 3, 
            p: 2, 
            background: alpha(theme.palette.primary.main, 0.05),
            borderRadius: '12px',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Portfolio Composition
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  backgroundColor: theme.palette.primary.main, 
                  borderRadius: '2px' 
                }} />
                <Typography variant="body2">
                  Principal ({(portfolioComposition.principal * 100).toFixed(1)}%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  backgroundColor: theme.palette.secondary.main, 
                  borderRadius: '2px' 
                }} />
                <Typography variant="body2">
                  Monthly Payments ({(portfolioComposition.monthlyPayments * 100).toFixed(1)}%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  backgroundColor: theme.palette.success.main, 
                  borderRadius: '2px' 
                }} />
                <Typography variant="body2">
                  Bonuses & Returns ({(portfolioComposition.bonuses * 100).toFixed(1)}%)
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Projection Legend */}
        {showProjections && (
          <Box sx={{ 
            mb: 2, 
            p: 2, 
            background: alpha(theme.palette.warning.main, 0.05),
            borderRadius: '12px',
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Data Types Legend
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 20, 
                  height: 3, 
                  backgroundColor: theme.palette.primary.main, 
                  borderRadius: '2px' 
                }} />
                <Typography variant="body2">
                  Historical Data (Solid)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 20, 
                  height: 3, 
                  backgroundColor: theme.palette.warning.main, 
                  borderRadius: '2px',
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)'
                }} />
                <Typography variant="body2">
                  Projected Data (Dashed)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  backgroundColor: theme.palette.warning.main,
                  clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                }} />
                <Typography variant="body2" color="text.secondary">
                  Triangle points indicate projections
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Interactive Chart */}
        <Box sx={{ height: 400, position: 'relative' }}>
          <ChartComponent
            ref={chartRef}
            data={getChartData()}
            options={chartOptions}
          />
          
          {/* Today marker for projection boundary */}
          {showProjections && (
            <Box sx={{ 
              position: 'absolute',
              right: `${(chartData.projectedLabels.length / chartData.labels.length) * 100}%`,
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: theme.palette.info.main,
              opacity: 0.7,
              pointerEvents: 'none',
              '&::before': {
                content: '"Today"',
                position: 'absolute',
                top: '10px',
                left: '5px',
                fontSize: '12px',
                fontWeight: 600,
                color: theme.palette.info.main,
                background: theme.palette.background.paper,
                padding: '2px 6px',
                borderRadius: '4px',
                whiteSpace: 'nowrap'
              }
            }} />
          )}
        </Box>

        {/* Time Period Control */}
        <Box sx={{ 
          mt: 3, 
          p: 3, 
          background: alpha(theme.palette.primary.main, 0.05),
          borderRadius: '12px',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Timeline sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Time Period
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Adjust how many days of history to display
            </Typography>
          </Box>
          
          <Box sx={{ px: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
              Historical Period: {daysToShow} days
            </Typography>
            <Slider
              value={daysToShow}
              onChange={(e, value) => setDaysToShow(value as number)}
              min={7}
              max={365}
              step={1}
              marks={[
                { value: 7, label: '1w' },
                { value: 30, label: '1m' },
                { value: 90, label: '3m' },
                { value: 180, label: '6m' },
                { value: 365, label: '1y' }
              ]}
              sx={{ 
                mt: 2,
                '& .MuiSlider-mark': {
                  backgroundColor: theme.palette.primary.main,
                  height: 8,
                  width: 2,
                },
                '& .MuiSlider-markLabel': {
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                  fontSize: '0.75rem'
                },
                '& .MuiSlider-thumb': {
                  width: 20,
                  height: 20,
                  backgroundColor: theme.palette.primary.main,
                  '&:hover': {
                    boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
                  },
                },
                '& .MuiSlider-track': {
                  backgroundColor: theme.palette.primary.main,
                  height: 4,
                },
                '& .MuiSlider-rail': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                  height: 4,
                }
              }}
            />
          </Box>
        </Box>

        {/* Interactive Controls */}
        <Accordion 
          expanded={slidersExpanded} 
          onChange={(e, isExpanded) => setSlidersExpanded(isExpanded)}
          sx={{ 
            mt: 3,
            mb: 3,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(111, 92, 242, 0.3)',
            borderRadius: '12px !important',
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore sx={{ color: 'primary.main' }} />}
            sx={{
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                gap: 2
              }
            }}
          >
            <Tune sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Projection Controls
            </Typography>
            <Chip 
              label={slidersExpanded ? "Hide" : "Customize Projections"} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Box>
              <Paper sx={{ 
                p: 3, 
                background: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Speed sx={{ color: 'primary.main' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Projection Settings
                  </Typography>
                </Box>
                
                <FormControlLabel
                  control={
                    <Switch 
                      checked={showProjections} 
                      onChange={(e) => setShowProjections(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Show Future Projections"
                  sx={{ mb: 2 }}
                />

                {showProjections && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Projection Period: {projectionMonths} months
                    </Typography>
                    <Slider
                      value={projectionMonths}
                      onChange={(e, value) => setProjectionMonths(value as number)}
                      min={1}
                      max={60}
                      step={1}
                      marks={[
                        { value: 6, label: '6m' },
                        { value: 12, label: '1y' },
                        { value: 24, label: '2y' },
                        { value: 36, label: '3y' }
                      ]}
                      sx={{ mt: 2 }}
                    />
                  </Box>
                )}

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Growth Rate Multiplier: {growthRateMultiplier.toFixed(2)}x
                  </Typography>
                  <Slider
                    value={growthRateMultiplier}
                    onChange={(e, value) => setGrowthRateMultiplier(value as number)}
                    min={0.1}
                    max={3}
                    step={0.1}
                    marks={[
                      { value: 0.5, label: '0.5x' },
                      { value: 1, label: '1x' },
                      { value: 2, label: '2x' }
                    ]}
                    sx={{ mt: 2 }}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Volatility: {(volatility * 100).toFixed(2)}%
                  </Typography>
                  <Slider
                    value={volatility}
                    onChange={(e, value) => setVolatility(value as number)}
                    min={0.0001}
                    max={0.02}
                    step={0.0001}
                    marks={[
                      { value: 0.001, label: '0.1%' },
                      { value: 0.005, label: '0.5%' },
                      { value: 0.01, label: '1%' },
                      { value: 0.02, label: '2%' }
                    ]}
                    sx={{ mt: 2 }}
                  />
                </Box>
              </Paper>
            </Box>
          </AccordionDetails>
        </Accordion>

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
            border: '1px solid rgba(111, 92, 242, 0.3)',
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
            My Account Details - {selectedDataPoint?.date}
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