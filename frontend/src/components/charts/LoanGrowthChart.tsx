import React, { useEffect, useState } from 'react';
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
  TooltipItem,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Box, Typography, useTheme, Fade, Card, CardContent, alpha } from '@mui/material';
import { TrendingUp, AttachMoney, Timeline, AccountBalance } from '@mui/icons-material';

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

const LoanGrowthChart: React.FC<LoanGrowthChartProps> = ({ analytics, height = 400 }) => {
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

  const labels = analytics.balanceHistory.map(item => formatMonth(item.month));

  const data = {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Loan Balance',
        data: analytics.balanceHistory.map(item => item.balance),
        borderColor: theme.palette.primary.main,
        backgroundColor: `${theme.palette.primary.main}15`,
        borderWidth: 4,
        pointBackgroundColor: theme.palette.primary.main,
        pointBorderColor: theme.palette.background.default,
        pointBorderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 12,
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
        pointShadowOffsetX: 2,
        pointShadowOffsetY: 2,
        pointShadowBlur: 8,
        pointShadowColor: `${theme.palette.primary.main}40`,
      },
      {
        type: 'bar' as const,
        label: 'Monthly Payment',
        data: analytics.balanceHistory.map(item => item.monthlyPayment),
        backgroundColor: `${theme.palette.success.main}CC`,
        borderColor: theme.palette.success.main,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        yAxisID: 'y1',
        barThickness: 20,
      },
      {
        type: 'bar' as const,
        label: 'Bonus Payment',
        data: analytics.balanceHistory.map(item => item.bonusPayment),
        backgroundColor: `${theme.palette.secondary.main}CC`,
        borderColor: theme.palette.secondary.main,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        yAxisID: 'y1',
        barThickness: 20,
      },
    ],
  };

  const options: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart',
      delay: (context) => context.dataIndex * 50,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme.palette.text.primary,
          font: {
            family: theme.typography.fontFamily,
            size: 14,
            weight: 'bold',
          },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
        },
      },
      title: {
        display: true,
        text: 'Loan Growth & Payment History',
        color: theme.palette.text.primary,
        font: {
          size: 20,
          family: theme.typography.fontFamily,
          weight: 'bold',
        },
        padding: 20,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
        cornerRadius: 12,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
          weight: 'normal',
        },
        padding: 16,
        callbacks: {
          title: function(tooltipItems) {
            return `${tooltipItems[0].label}`;
          },
          label: function(context: TooltipItem<'line' | 'bar'>) {
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
          font: {
            size: 12,
            weight: 'normal',
          },
        },
        grid: {
          color: alpha(theme.palette.primary.main, 0.1),
          lineWidth: 1,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Loan Balance ($)',
          color: theme.palette.text.secondary,
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: {
            size: 12,
            weight: 'normal',
          },
          callback: function(value) {
            return formatCurrency(Number(value));
          },
        },
        grid: {
          color: alpha(theme.palette.primary.main, 0.1),
          lineWidth: 1,
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Monthly Payments ($)',
          color: theme.palette.text.secondary,
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: {
            size: 12,
            weight: 'normal',
          },
          callback: function(value) {
            return formatCurrency(Number(value));
          },
        },
        grid: {
          drawOnChartArea: false,
          color: alpha(theme.palette.secondary.main, 0.2),
        },
      },
    },
  };

  return (
    <Fade in={isVisible} timeout={1000}>
      <Box>
        <Box 
          sx={{ 
            position: 'relative', 
            height,
            background: alpha(theme.palette.primary.main, 0.02),
            borderRadius: '16px',
            padding: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <Chart type="bar" data={data} options={options} />
        </Box>
      </Box>
    </Fade>
  );
};

export default LoanGrowthChart; 