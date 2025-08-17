import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
  alpha,
  Fade,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Timeline,
  Assessment,
  ShowChart,
} from '@mui/icons-material';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsData {
  balanceHistory: Array<{
    month: string;
    balance: number;
    monthlyPayment: number;
    bonusPayment: number;
    withdrawal: number;
    netGrowth: number;
  }>;
  currentBalance: number;
  totalPrincipal: number;
  totalBonuses: number;
  totalWithdrawals: number;
  monthlyRate: number;
}

interface PortfolioDashboardProps {
  analytics: AnalyticsData;
  loanData: any;
}

const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({ analytics, loanData }) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatMonth = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
  };

  // Calculate performance metrics
  const totalGrowth = analytics.currentBalance - analytics.totalPrincipal;
  const growthRate = ((totalGrowth / analytics.totalPrincipal) * 100).toFixed(2);
  const averageMonthlyGrowth = analytics.balanceHistory.length > 0 
    ? analytics.balanceHistory.reduce((sum, month) => sum + month.netGrowth, 0) / analytics.balanceHistory.length 
    : 0;
  
  // Calculate trend (last 3 months vs previous 3 months)
  const recentMonths = analytics.balanceHistory.slice(-3);
  const previousMonths = analytics.balanceHistory.slice(-6, -3);
  const recentAvg = recentMonths.length > 0 ? recentMonths.reduce((sum, m) => sum + m.netGrowth, 0) / recentMonths.length : 0;
  const previousAvg = previousMonths.length > 0 ? previousMonths.reduce((sum, m) => sum + m.netGrowth, 0) / previousMonths.length : 0;
  const trend = recentAvg > previousAvg ? 'up' : 'down';
  const trendPercentage = previousAvg !== 0 ? (((recentAvg - previousAvg) / Math.abs(previousAvg)) * 100).toFixed(1) : '0.0';

  // ROI Chart Data
  const roiData = {
    labels: analytics.balanceHistory.map(item => formatMonth(item.month)),
    datasets: [
      {
        label: 'Monthly ROI (%)',
        data: analytics.balanceHistory.map(item => {
          const prevBalance = analytics.totalPrincipal;
          return ((item.netGrowth / prevBalance) * 100).toFixed(2);
        }),
        borderColor: theme.palette.success.main,
        backgroundColor: alpha(theme.palette.success.main, 0.1),
        borderWidth: 3,
        pointBackgroundColor: theme.palette.success.main,
        pointBorderColor: theme.palette.background.default,
        pointBorderWidth: 2,
        pointRadius: 6,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Portfolio Composition
  const portfolioComposition = {
    labels: ['Principal', 'Growth', 'Bonuses'],
    datasets: [
      {
        data: [
          analytics.totalPrincipal,
          totalGrowth - analytics.totalBonuses,
          analytics.totalBonuses,
        ],
        backgroundColor: [
          theme.palette.primary.main,
          theme.palette.success.main,
          theme.palette.secondary.main,
        ],
        borderColor: [
          theme.palette.primary.main,
          theme.palette.success.main,
          theme.palette.secondary.main,
        ],
        borderWidth: 3,
        hoverOffset: 10,
      },
    ],
  };

  // Monthly Performance Bar Chart
  const monthlyPerformance = {
    labels: analytics.balanceHistory.map(item => formatMonth(item.month)),
    datasets: [
      {
        label: 'Monthly Payment',
        data: analytics.balanceHistory.map(item => item.monthlyPayment),
        backgroundColor: alpha(theme.palette.primary.main, 0.8),
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
        borderRadius: 6,
      },
      {
        label: 'Bonus Payment',
        data: analytics.balanceHistory.map(item => item.bonusPayment),
        backgroundColor: alpha(theme.palette.secondary.main, 0.8),
        borderColor: theme.palette.secondary.main,
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart',
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: theme.palette.text.primary,
          font: {
            size: 12,
            weight: 'bold',
          },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: theme.palette.primary.main,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
        },
        grid: {
          color: alpha(theme.palette.divider, 0.1),
        },
      },
      y: {
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
        },
        grid: {
          color: alpha(theme.palette.divider, 0.1),
        },
      },
    },
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart',
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: theme.palette.text.primary,
          font: { size: 12, weight: 'bold' },
          padding: 15,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: theme.palette.primary.main,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
    cutout: '60%',
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Key Performance Indicators */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 4 }}>
        <Fade in={isVisible} timeout={800}>
          <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.light})`, color: 'white' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ fontSize: 32, mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Total Growth
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
                {formatCurrency(totalGrowth)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                +{growthRate}% overall return
              </Typography>
            </CardContent>
          </Card>
        </Fade>

        <Fade in={isVisible} timeout={1000}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ fontSize: 32, color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Avg Monthly Growth
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main, mb: 1 }}>
                {formatCurrency(averageMonthlyGrowth)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {trend === 'up' ? (
                  <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 16, mr: 0.5 }} />
                ) : (
                  <TrendingDown sx={{ color: theme.palette.error.main, fontSize: 16, mr: 0.5 }} />
                )}
                <Typography variant="body2" color="text.secondary">
                  {trend === 'up' ? '+' : ''}{trendPercentage}% vs prev period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        <Fade in={isVisible} timeout={1200}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AttachMoney sx={{ fontSize: 32, color: theme.palette.info.main, mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  % Return
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.info.main, mb: 1 }}>
                +{growthRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall return on investment
              </Typography>
            </CardContent>
          </Card>
        </Fade>

        <Fade in={isVisible} timeout={1400}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ShowChart sx={{ fontSize: 32, color: theme.palette.secondary.main, mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  % Change
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {trend === 'up' ? (
                  <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 24, mr: 0.5 }} />
                ) : (
                  <TrendingDown sx={{ color: theme.palette.error.main, fontSize: 24, mr: 0.5 }} />
                )}
                <Typography variant="h3" sx={{ 
                  fontWeight: 800, 
                  color: trend === 'up' ? theme.palette.success.main : theme.palette.error.main
                }}>
                  {trend === 'up' ? '+' : ''}{trendPercentage}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                vs previous period
              </Typography>
            </CardContent>
          </Card>
        </Fade>
      </Box>

      {/* Charts Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 3 }}>
        {/* ROI Trend Chart */}
        <Fade in={isVisible} timeout={1600}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                Monthly Return on Investment
              </Typography>
              <Box sx={{ height: 300, position: 'relative' }}>
                <Line data={roiData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Fade>

        {/* Portfolio Composition */}
        <Fade in={isVisible} timeout={1800}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                Portfolio Composition
              </Typography>
              <Box sx={{ height: 300, position: 'relative' }}>
                <Doughnut data={portfolioComposition} options={doughnutOptions} />
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Box>

      {/* Monthly Performance Comparison */}
      <Fade in={isVisible} timeout={2000}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
              Monthly Performance Breakdown
            </Typography>
            <Box sx={{ height: 350, position: 'relative' }}>
              <Bar data={monthlyPerformance} options={chartOptions} />
            </Box>
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
};

export default PortfolioDashboard;