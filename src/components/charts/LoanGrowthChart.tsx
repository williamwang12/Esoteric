import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Box, Typography, useTheme } from '@mui/material';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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

interface LoanGrowthChartProps {
  analytics: AnalyticsData;
  height?: number;
}

const LoanGrowthChart: React.FC<LoanGrowthChartProps> = ({ analytics, height = 400 }): React.ReactElement => {
  const theme = useTheme();

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

  const labels = analytics.balanceHistory.map(item => formatMonth(item.month));

  const data = {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Loan Balance',
        data: analytics.balanceHistory.map(item => item.balance),
        borderColor: theme.palette.primary.main,
        backgroundColor: `${theme.palette.primary.main}20`,
        borderWidth: 3,
        pointBackgroundColor: theme.palette.primary.main,
        pointBorderColor: theme.palette.background.paper,
        pointBorderWidth: 2,
        pointRadius: 6,
        fill: true,
        tension: 0.1,
        yAxisID: 'y',
      },
      {
        type: 'bar' as const,
        label: 'Monthly Payment',
        data: analytics.balanceHistory.map(item => item.monthlyPayment),
        backgroundColor: theme.palette.success.main,
        borderColor: theme.palette.success.dark,
        borderWidth: 1,
        yAxisID: 'y1',
      },
      {
        type: 'bar' as const,
        label: 'Bonus Payment',
        data: analytics.balanceHistory.map(item => item.bonusPayment),
        backgroundColor: theme.palette.secondary.main,
        borderColor: theme.palette.secondary.dark,
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ],
  };

  const options: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme.palette.text.primary,
          font: {
            family: theme.typography.fontFamily,
          },
        },
      },
      title: {
        display: true,
        text: 'Loan Growth & Payment History',
        color: theme.palette.text.primary,
        font: {
          size: 18,
          family: theme.typography.fontFamily,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: theme.palette.primary.main,
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatCurrency(value)}`;
          },
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Month',
          color: theme.palette.text.secondary,
        },
        ticks: {
          color: theme.palette.text.secondary,
        },
        grid: {
          color: `${theme.palette.text.secondary}20`,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Loan Balance ($)',
          color: theme.palette.text.secondary,
        },
        ticks: {
          color: theme.palette.text.secondary,
          callback: function(value) {
            return formatCurrency(Number(value));
          },
        },
        grid: {
          color: `${theme.palette.text.secondary}20`,
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Monthly Payments ($)',
          color: theme.palette.text.secondary,
        },
        ticks: {
          color: theme.palette.text.secondary,
          callback: function(value) {
            return formatCurrency(Number(value));
          },
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <Box>
      <Box sx={{ position: 'relative', height }}>
        <Chart type="bar" data={data} options={options} />
      </Box>
      
      {/* Summary Statistics */}
      <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Current Balance
          </Typography>
          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
            {formatCurrency(analytics.currentBalance)}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Total Growth
          </Typography>
          <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
            {formatCurrency(analytics.currentBalance - analytics.totalPrincipal)}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Total Bonuses
          </Typography>
          <Typography variant="h6" color="secondary.main" sx={{ fontWeight: 'bold' }}>
            {formatCurrency(analytics.totalBonuses)}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Monthly Rate
          </Typography>
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            {(analytics.monthlyRate * 100).toFixed(1)}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoanGrowthChart; 