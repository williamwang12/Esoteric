import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
  Fade,
  Avatar,
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
} from 'chart.js';
import {
  Compare,
  Speed,
  DataUsage,
  EmojiEvents,
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

interface AdvancedMetricsProps {
  analytics: AnalyticsData;
  loanData: any;
}


const AdvancedMetrics: React.FC<AdvancedMetricsProps> = ({ analytics, loanData }) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);



  // Advanced Analytics Calculations
  const calculateVolatility = () => {
    if (analytics.balanceHistory.length < 2) return 0;
    const returns = analytics.balanceHistory.map((item, index) => {
      if (index === 0) return 0;
      const prevBalance = analytics.balanceHistory[index - 1].balance;
      return (item.balance - prevBalance) / prevBalance;
    }).slice(1);
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100;
  };

  const calculateSharpeRatio = () => {
    const riskFreeRate = 0.02;
    const totalReturn = (analytics.currentBalance - analytics.totalPrincipal) / analytics.totalPrincipal;
    const volatility = calculateVolatility() / 100;
    return volatility > 0 ? (totalReturn - riskFreeRate) / volatility : 0;
  };

  const calculateMaxDrawdown = () => {
    if (analytics.balanceHistory.length === 0) return 0;
    let maxDrawdown = 0;
    let peak = analytics.balanceHistory[0].balance;
    
    analytics.balanceHistory.forEach(item => {
      if (item.balance > peak) {
        peak = item.balance;
      }
      const drawdown = (peak - item.balance) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    return maxDrawdown * 100;
  };

  const volatility = calculateVolatility();
  const sharpeRatio = calculateSharpeRatio();
  const maxDrawdown = calculateMaxDrawdown();



  return (
    <Box>
      {/* Advanced Metrics Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3, mb: 4 }}>
        <Fade in={isVisible} timeout={800}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ 
                bgcolor: theme.palette.success.main, 
                width: 56, 
                height: 56, 
                mx: 'auto', 
                mb: 2 
              }}>
                <Speed />
              </Avatar>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                {sharpeRatio.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Sharpe Ratio
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Risk-adjusted return
              </Typography>
            </CardContent>
          </Card>
        </Fade>

        <Fade in={isVisible} timeout={1000}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ 
                bgcolor: theme.palette.warning.main, 
                width: 56, 
                height: 56, 
                mx: 'auto', 
                mb: 2 
              }}>
                <DataUsage />
              </Avatar>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                {volatility.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Volatility
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Price variation
              </Typography>
            </CardContent>
          </Card>
        </Fade>

        <Fade in={isVisible} timeout={1200}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ 
                bgcolor: theme.palette.error.main, 
                width: 56, 
                height: 56, 
                mx: 'auto', 
                mb: 2 
              }}>
                <Compare />
              </Avatar>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                {maxDrawdown.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Max Drawdown
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Largest decline
              </Typography>
            </CardContent>
          </Card>
        </Fade>

        <Fade in={isVisible} timeout={1400}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ 
                bgcolor: theme.palette.info.main, 
                width: 56, 
                height: 56, 
                mx: 'auto', 
                mb: 2 
              }}>
                <EmojiEvents />
              </Avatar>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                A+
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Performance Grade
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Overall rating
              </Typography>
            </CardContent>
          </Card>
        </Fade>
      </Box>

    </Box>
  );
};

export default AdvancedMetrics;