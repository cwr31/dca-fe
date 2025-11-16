'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { format, subYears } from 'date-fns';
import dynamic from 'next/dynamic';

// 动态导入组件以避免SSR问题
const InvestmentChart = dynamic(() => import('./components/InvestmentChart'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><div className="text-center text-[#666]"><div className="text-lg mb-2">📊</div><div className="text-sm">正在加载图表...</div></div></div>
});

const StatsCards = dynamic(() => import('./components/StatsCards').then((mod) => ({ default: mod.StatsCards })), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><div className="text-sm text-[#666]">加载统计卡片...</div></div>
});

const MultiFundStatsCards = dynamic(() => import('./components/MultiFundStatsCards').then((mod) => ({ default: mod.MultiFundStatsCards })), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><div className="text-sm text-[#666]">加载统计卡片...</div></div>
});

const StatsSkeleton = dynamic(() => import('./components/Skeleton').then((mod) => ({ default: mod.StatsSkeleton })), {
  ssr: false
});

const ChartLegend = dynamic(() => import('./components/ChartLegend'), {
  ssr: false,
  loading: () => <div className="flex items-center gap-2"><div className="w-3 h-0.5 rounded bg-[#4a9eff] animate-pulse"></div></div>
});

const FundSelector = dynamic(() => import('./components/FundSelector'), {
  ssr: false,
  loading: () => <div className="w-full h-12 bg-[#252525] border border-[#3a3a3a] rounded-lg animate-pulse"></div>
});

interface FundData {
  date: string;
  netValue: number;  // 单位净值，用于计算申购份额和当前市值
  cumulativeNetValue: number;  // 累计净值，仅用于计算分红金额
}

interface BacktestResult {
  date: string;
  price: number; // 单位净值，用于显示
  cumulativePrice: number; // 累计净值，用于计算分红和一次性投入价值
  totalInvestment: number;
  totalShares: number;
  averageCost: number;
  currentValue: number; // 当前市值（份额 × 单位净值）
  annualizedReturnRate?: number; // 从开始到该天的年化收益率
  averageAnnualizedReturnRate?: number; // 从开始到该天的平均年化收益率
  averageAnnualizedReturnRateForInterval?: number; // 区间内定投平均年化收益率（水平直线）
}

// 日期解析函数：将用户输入转换为 YYYY-MM-DD 格式
function parseDateInput(input: string): string | null {
  if (!input || !input.trim()) return null;
  
  // 移除所有空格和常见分隔符，只保留数字
  const digits = input.replace(/[\s\-/\.]/g, '');
  
  // 检查是否为8位数字（YYYYMMDD）
  if (/^\d{8}$/.test(digits)) {
    const year = digits.substring(0, 4);
    const month = digits.substring(4, 6);
    const day = digits.substring(6, 8);
    
    // 验证日期有效性
    const date = new Date(`${year}-${month}-${day}`);
    if (date.getFullYear() == parseInt(year) && 
        date.getMonth() + 1 == parseInt(month) && 
        date.getDate() == parseInt(day)) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // 尝试解析其他格式（如 YYYY-MM-DD）
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return format(date, 'yyyy-MM-dd');
  }
  
  return null;
}

interface FundInput {
  id: string;
  code: string;
  name?: string;
}

export default function Home() {
  const [mode, setMode] = useState<'single' | 'multi-dca' | 'multi-lumpsum'>('single');
  const [funds, setFunds] = useState<FundInput[]>([{ id: '1', code: '' }]);
  const [investmentAmount, setInvestmentAmount] = useState('100');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState<number>(1); // 0=周日, 1=周一, ..., 6=周六
  const [startDateInput, setStartDateInput] = useState(''); // 用户输入的原始值
  const [endDateInput, setEndDateInput] = useState(''); // 用户输入的原始值
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [investmentRecords, setInvestmentRecords] = useState<any[]>([]);
  const chartRef = useRef<any>(null);

  // 模式切换时清空右侧数据，保留左侧参数
  const handleModeChange = (newMode: 'single' | 'multi-dca' | 'multi-lumpsum') => {
    setMode(newMode);
    // 清空右侧数据，防止数据错乱导致图表渲染错误
    setChartData([]);
    setStats(null);
    setInvestmentRecords([]);
    setError('');

    // 重置图例可见性状态
    if (newMode === 'single') {
      setSeriesVisibility({
        cost: true,
        value: true,
        lumpSum: true,
        return: true,
        lumpSumReturn: true,
      });
    } else {
      const visibility: any = {};
      funds.filter(f => f.code.trim()).forEach((fund, index) => {
        const fundPrefix = `fund${index + 1}`;
        if (newMode === 'multi-dca') {
          visibility[`${fundPrefix}_value`] = true;
          visibility[`${fundPrefix}_return`] = true;
        } else if (newMode === 'multi-lumpsum') {
          visibility[`${fundPrefix}_lumpSum`] = true;
          visibility[`${fundPrefix}_lumpSumReturn`] = true;
        }
      });
      if (newMode === 'multi-dca') {
        visibility.shared_investment = true;
      }
      setSeriesVisibility(visibility);
    }
  };

  const [chartView, setChartView] = useState<'cost' | 'return'>('cost'); // 图表视图：cost=成本收益视图, return=年化收益率视图
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number>(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const recordsPerPage = 10;
  // 处理图例切换
  const handleToggleSeries = (seriesKey: string) => {
    setSeriesVisibility(prev => ({
      ...prev,
      [seriesKey]: !prev[seriesKey]
    }));
  };

  // 图例可见性状态
  const [seriesVisibility, setSeriesVisibility] = useState(() => {
    if (mode === 'single') {
      return {
        cost: true,
        value: true,
        lumpSum: true,
        return: true,
        lumpSumReturn: true,
      };
    } else {
      const visibility: any = {};
      funds.filter(f => f.code.trim()).forEach((fund, index) => {
        const fundPrefix = `fund${index + 1}`;
        if (mode === 'multi-dca') {
          visibility[`${fundPrefix}_value`] = true;
          visibility[`${fundPrefix}_return`] = true;
        } else if (mode === 'multi-lumpsum') {
          visibility[`${fundPrefix}_lumpSum`] = true;
          visibility[`${fundPrefix}_lumpSumReturn`] = true;
        }
      });
      if (mode === 'multi-dca') {
        visibility.shared_investment = true;
      }
      return visibility;
    }
  });

  useEffect(() => {
    setRecordsPage(1);
  }, [investmentRecords.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(Math.max(investmentRecords.length, 1) / recordsPerPage));
    if (recordsPage > totalPages) {
      setRecordsPage(totalPages);
    }
  }, [investmentRecords.length, recordsPage, recordsPerPage]);

  const paginatedRecords = useMemo(() => {
    const start = (recordsPage - 1) * recordsPerPage;
    return investmentRecords.slice(start, start + recordsPerPage);
  }, [investmentRecords, recordsPage, recordsPerPage]);

  const totalRecordPages = Math.max(1, Math.ceil(Math.max(investmentRecords.length, 1) / recordsPerPage));

  // 设置结束日期默认为今天
  useEffect(() => {
    const today = format(new Date(), 'yyyyMMdd');
    setEndDateInput(today);
  }, []);

  // 处理快捷日期选择
  const handleQuickDateSelect = (years: number) => {
    const today = new Date();
    const startDate = subYears(today, years);
    const formattedDate = format(startDate, 'yyyyMMdd');
    setStartDateInput(formattedDate);
  };

  const handleBacktest = async () => {
    // 验证基金输入
    const validFunds = funds.filter(fund => fund.code.trim());
    if (validFunds.length === 0) {
      setError('请至少输入一个基金代码');
      return;
    }

    if (mode === 'single' && validFunds.length !== 1) {
      setError('单基金模式只能选择一个基金');
      return;
    }

    if ((mode === 'multi-dca' || mode === 'multi-lumpsum') && validFunds.length < 2) {
      setError('多基金比较模式至少需要两个基金');
      return;
    }

    // 开始日期必填验证
    if (!startDateInput.trim()) {
      setError('请选择或输入开始日期');
      return;
    }

    // 解析日期输入
    const parsedStartDate = startDateInput ? parseDateInput(startDateInput) : null;
    const parsedEndDate = endDateInput ? parseDateInput(endDateInput) : null;

    if (!parsedStartDate) {
      setError('开始日期格式不正确，请输入年月日（如：20200101 或 2020-01-01）');
      return;
    }

    if (endDateInput && !parsedEndDate) {
      setError('结束日期格式不正确，请输入年月日（如：20241231 或 2024-12-31）');
      return;
    }

    setLoading(true);
    setError('');
      setChartData([]);
      setStats(null);
      setInvestmentRecords([]);
      setRecordsPage(1);

    try {
      // 获取所有基金的数据
      const fundPromises = validFunds.map(async (fund) => {
        const fundResponse = await fetch(
          `/api/fund?code=${encodeURIComponent(fund.code)}&startDate=${parsedStartDate}${parsedEndDate ? `&endDate=${parsedEndDate}` : ''}`
        );

        if (!fundResponse.ok) {
          const errorData = await fundResponse.json();
          throw new Error(`基金${fund.code}: ${errorData.error || '获取数据失败'}`);
        }

        const fundResult = await fundResponse.json();
        if (!fundResult.success || !fundResult.data || fundResult.data.length === 0) {
          throw new Error(`基金${fund.code}: 未获取到数据`);
        }

        return {
          code: fund.code,
          data: fundResult.data
        };
      });

      const fundDataResults = await Promise.all(fundPromises);

      // 如果没有设置日期，使用数据的日期范围
      const actualStartDate = parsedStartDate;
      const actualEndDate = parsedEndDate || fundDataResults[0].data[fundDataResults[0].data.length - 1].date;

      // 执行回测
      const backtestResponse = await fetch('/api/backtest-multi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          funds: fundDataResults,
          investmentAmount: parseFloat(investmentAmount),
          frequency,
          weeklyDayOfWeek: frequency === 'weekly' ? weeklyDayOfWeek : undefined,
          startDate: actualStartDate,
          endDate: actualEndDate,
          mode
        }),
      });

      if (!backtestResponse.ok) {
        const errorData = await backtestResponse.json();
        throw new Error(errorData.error || '回测计算失败');
      }

      const backtestResult = await backtestResponse.json();
      const results: BacktestResult[] = backtestResult.data;
      const records = backtestResult.investmentRecords || [];

      // 保存开始日期用于计算年化收益率
      const startDateObj = new Date(actualStartDate);

      // 准备图表数据
      let formattedData: any[] = [];

      if (mode === 'single') {
        // 单基金模式的原有数据处理逻辑
        formattedData = results.map((item) => {
          const totalInvestment = typeof item.totalInvestment === 'number' ? item.totalInvestment : parseFloat(item.totalInvestment) || 0;
          const currentValue = typeof item.currentValue === 'number' ? item.currentValue : parseFloat(item.currentValue) || 0;
          const currentDate = new Date(item.date);

          // 确保数据有效
          const validTotalInvestment = isFinite(totalInvestment) ? totalInvestment : 0;
          const validCurrentValue = isFinite(currentValue) ? currentValue : 0;
          const validAnnualizedRate = item.annualizedReturnRate !== undefined &&
                                     item.annualizedReturnRate !== null &&
                                     isFinite(item.annualizedReturnRate) &&
                                     !isNaN(item.annualizedReturnRate)
            ? Number(item.annualizedReturnRate.toFixed(2))
            : 0;

          return {
            date: format(new Date(item.date), 'yyyy-MM-dd'),
            dateObj: currentDate,
            totalInvestment: Number(validTotalInvestment.toFixed(2)),
            currentValue: Number(validCurrentValue.toFixed(2)),
            annualizedReturnRate: validAnnualizedRate,
            cumulativePrice: item.cumulativePrice,
          };
        });
      } else {
        // 多基金模式的数据处理
        formattedData = results.map((item) => {
          const currentDate = new Date(item.date);
          const baseData: any = {
            date: format(new Date(item.date), 'yyyy-MM-dd'),
            dateObj: currentDate,
            cumulativePrice: item.cumulativePrice
          };

          // 根据模式添加不同的数据字段
          if (mode === 'multi-dca') {
            // 多基金定投模式
            validFunds.forEach((fund, index) => {
              const fundPrefix = `fund${index + 1}`;
              baseData[`${fundPrefix}_currentValue`] = Number(((item as any)[`${fundPrefix}_currentValue`] || 0).toFixed(2));
              baseData[`${fundPrefix}_totalInvestment`] = Number(((item as any)[`${fundPrefix}_totalInvestment`] || 0).toFixed(2));
              baseData[`${fundPrefix}_return`] = Number(((item as any)[`${fundPrefix}_return`] || 0).toFixed(2));
            });
          } else if (mode === 'multi-lumpsum') {
            // 多基金一次性投入模式
            validFunds.forEach((fund, index) => {
              const fundPrefix = `fund${index + 1}`;
              baseData[`${fundPrefix}_lumpSum`] = Number(((item as any)[`${fundPrefix}_lumpSum`] || 0).toFixed(2));
              baseData[`${fundPrefix}_lumpSumReturn`] = Number(((item as any)[`${fundPrefix}_lumpSumReturn`] || 0).toFixed(2));
            });
          }

          return baseData;
        });
      }

      // 计算统计数据
      let priceChangePercent = 0;
      if (results.length > 0 && mode === 'single') {
        const firstCumulativePrice = results[0].cumulativePrice;
        const lastCumulativePrice = results[results.length - 1].cumulativePrice;
        priceChangePercent = ((lastCumulativePrice - firstCumulativePrice) / firstCumulativePrice) * 100;
      }

      // 计算Y轴范围（单基金模式）
      let yAxisDomain: [number, number] = [0, 1000];
      let yAxisRightDomain: [number, number] = [-10, 10];

      if (mode === 'single' && formattedData.length > 0) {
        const allValues = formattedData.flatMap(item => [
          item.totalInvestment,
          item.currentValue
        ]).filter((v): v is number => v !== null && !isNaN(v) && isFinite(v) && v >= 0);

        const allReturnRates = formattedData.flatMap(item => [
          item.annualizedReturnRate
        ]).filter((v): v is number => v !== null && !isNaN(v) && isFinite(v));

        if (allValues.length > 0) {
          const minValue = Math.min(...allValues);
          const maxValue = Math.max(...allValues);
          const range = maxValue - minValue;
          const padding = Math.max(range * 0.1, maxValue * 0.05);
          yAxisDomain = [0, maxValue + padding];
        }

        if (allReturnRates.length > 0) {
          const minRate = Math.min(...allReturnRates);
          const maxRate = Math.max(...allReturnRates);
          const rateRange = maxRate - minRate;
          const ratePadding = Math.max(rateRange * 0.1, Math.abs(maxRate) * 0.05, 2);
          yAxisRightDomain = [
            Math.max(minRate - ratePadding, -50),
            Math.min(maxRate + ratePadding, 50)
          ];
        }
      }

      console.log('图表数据准备完成:', {
        mode,
        dataLength: formattedData.length,
        firstItem: formattedData[0],
        lastItem: formattedData[formattedData.length - 1],
        yAxisDomain,
        yAxisRightDomain
      });

      setChartData(formattedData);
      setStats({ ...backtestResult.stats, yAxisDomain, yAxisRightDomain, priceChangePercent, startDate: actualStartDate, mode });
      setInvestmentRecords(records);
      // 初始化缩放范围：显示全部数据
      setBrushStartIndex(0);
      setBrushEndIndex(formattedData.length > 0 ? formattedData.length - 1 : 0);
    } catch (err: any) {
      setError(err.message || '发生错误');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]">
      {/* 桌面端布局：左右分栏 */}
      <div className="hidden md:flex min-h-screen w-full relative">
        {/* 左侧参数设置面板 - 桌面端 */}
        <div
          className="w-[340px] min-w-[340px] h-screen bg-gradient-to-b from-[#1a1a1a] to-[#151515] border-r border-[#2a2a2a] flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar shadow-2xl flex-shrink-0 fixed"
        >
          <div className="px-4 py-4 flex-1 space-y-4">

            <div className="group">
              <label htmlFor="fundCode" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📊</span>
                基金选择
              </label>
              <FundSelector
                mode={mode}
                onModeChange={handleModeChange}
                funds={funds}
                onFundsChange={setFunds}
              />
            </div>

            <div className="group">
              <label htmlFor="investmentAmount" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">💰</span>
                每次投资金额（元）
              </label>
              <input
                id="investmentAmount"
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                min="1"
                step="0.01"
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="每次投资金额输入框"
              />
            </div>

            <div className="group">
              <label htmlFor="frequency" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">⏰</span>
                定投频率
              </label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a] cursor-pointer"
                tabIndex={0}
                aria-label="定投频率选择"
              >
                <option value="daily" className="bg-[#252525] text-[#e0e0e0]">每日</option>
                <option value="weekly" className="bg-[#252525] text-[#e0e0e0]">每周</option>
                <option value="monthly" className="bg-[#252525] text-[#e0e0e0]">每月</option>
              </select>
            </div>

            {frequency === 'weekly' && (
              <div className="group animate-in fade-in slide-in-from-top-2 duration-300">
                <label htmlFor="weeklyDayOfWeek" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                  <span className="text-[#4a9eff]">📅</span>
                  每周几定投
                </label>
                <select
                  id="weeklyDayOfWeek"
                  value={weeklyDayOfWeek}
                  onChange={(e) => setWeeklyDayOfWeek(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a] cursor-pointer"
                  tabIndex={0}
                  aria-label="每周定投日期选择"
                >
                  <option value="0" className="bg-[#252525] text-[#e0e0e0]">周日</option>
                  <option value="1" className="bg-[#252525] text-[#e0e0e0]">周一</option>
                  <option value="2" className="bg-[#252525] text-[#e0e0e0]">周二</option>
                  <option value="3" className="bg-[#252525] text-[#e0e0e0]">周三</option>
                  <option value="4" className="bg-[#252525] text-[#e0e0e0]">周四</option>
                  <option value="5" className="bg-[#252525] text-[#e0e0e0]">周五</option>
                  <option value="6" className="bg-[#252525] text-[#e0e0e0]">周六</option>
                </select>
              </div>
            )}

            <div className="group">
              <label htmlFor="startDate" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📆</span>
                开始日期
                <span className="text-[#ff4d4f] text-xs">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(1);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近一年"
                >
                  近1年
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(3)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(3);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近3年"
                >
                  近3年
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(5)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(5);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近5年"
                >
                  近5年
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(10)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(10);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近10年"
                >
                  近10年
                </button>
              </div>
              <input
                id="startDate"
                type="text"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                placeholder="例如：20200101 或 2020-01-01"
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="开始日期输入框"
                required
              />
            </div>

            <div className="group">
              <label htmlFor="endDate" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📆</span>
                结束日期（默认今天）
              </label>
              <input
                id="endDate"
                type="text"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                placeholder="例如：20241231 或 2024-12-31"
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="结束日期输入框"
              />
            </div>

            <button
              onClick={async () => {
                await handleBacktest();
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  await handleBacktest();
                }
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#4a9eff] via-[#3a8eef] to-[#0066cc] text-white font-semibold cursor-pointer transition-all duration-200 mt-2 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(74,158,255,0.4)] hover:from-[#5aaeff] hover:to-[#0076dc] active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none relative overflow-hidden group"
              tabIndex={0}
              aria-label="开始回测按钮"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>计算中...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>开始回测</span>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            </button>

            {error && (
              <div className="mt-4 bg-gradient-to-r from-[rgba(255,77,77,0.15)] to-[rgba(255,77,77,0.1)] text-[#ff6b6b] px-4 py-3 rounded-lg border border-[rgba(255,77,77,0.3)] text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <span className="flex-1">{error}</span>
              </div>
            )}

          </div>
        </div>

        {/* 右侧图表展示区域 - 桌面端 */}
        <div className="ml-[340px] flex-1 bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#0f0f0f] min-h-screen">
          {chartData.length > 0 ? (
            <div className="w-full flex flex-col p-5 gap-6 min-h-screen animate-in fade-in duration-500">
              {/* 回测统计 - 根据模式显示不同的统计卡片 */}
              {stats ? (
                mode === 'single' ? (
                  <StatsCards stats={(() => {
                    const statsData = {
                      totalPeriods: investmentRecords.length,
                      totalInvestment: stats.totalInvestment,
                      averageInvestment: stats.totalInvestment / (investmentRecords.length || 1),
                      finalAssetValue: stats.currentValue,
                      dcaProfitRate: stats.profitRate,
                      dcaAnnualizedReturn: stats.annualizedReturnRate || 0,
                      lumpSumFinalAsset: stats.totalInvestment * (1 + stats.priceChangePercent / 100),
                      lumpSumProfitRate: stats.priceChangePercent,
                      lumpSumAnnualizedReturn: (() => {
                        const daysDiff = stats.startDate && chartData.length > 0
                          ? Math.ceil((new Date(chartData[chartData.length - 1].date).getTime() - new Date(stats.startDate).getTime()) / (1000 * 60 * 60 * 24))
                          : 365;
                        return daysDiff > 0
                          ? ((Math.pow(1 + stats.priceChangePercent / 100, 365 / daysDiff) - 1) * 100)
                          : 0;
                      })()
                    };

                    return statsData;
                  })()} startDate={stats.startDate} endDate={chartData.length > 0 ? chartData[chartData.length - 1].date : undefined} />
                ) : (
                  <MultiFundStatsCards
                    stats={stats}
                    mode={mode as 'multi-dca' | 'multi-lumpsum'}
                    funds={funds.filter(f => f.code.trim())}
                  />
                )
              ) : chartData.length > 0 ? (
                // 如果chartData有数据但stats还在加载，显示骨架屏
                <StatsSkeleton count={4} />
              ) : null}
              <div className="flex flex-col gap-5 flex-1">
                {/* 图表区域 - 无遮挡，全区域显示 */}
                <div
                  className="bg-gradient-to-br from-[#151515] to-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-2xl flex-1 flex flex-col"
                  style={{
                    minHeight: '450px',
                    position: 'relative'
                  }}
                >
                  <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#2a2a2a] bg-gradient-to-r from-[#1a1a1a] to-[#1f1f1f] flex-shrink-0">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-white text-base font-semibold truncate flex-1">
                          {mode === 'single'
                            ? (chartView === 'cost' ? '收益表' : '收益率表')
                            : (mode === 'multi-dca'
                                ? (chartView === 'cost' ? '多基金定投收益对比' : '多基金定投收益率对比')
                                : (chartView === 'cost' ? '多基金一次性投入收益对比' : '多基金一次性投入收益率对比')
                              )
                          }
                        </h3>
                        {chartData.length > 0 && brushEndIndex >= brushStartIndex && (
                          <span className="text-xs text-[#888] font-medium w-full sm:w-auto order-2 sm:order-1">
                            {format(new Date(chartData[Math.max(0, Math.min(chartData.length - 1, brushStartIndex))].date), 'yyyy-MM-dd')}
                            {' ~ '}
                            {format(new Date(chartData[Math.max(0, Math.min(chartData.length - 1, brushEndIndex))].date), 'yyyy-MM-dd')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 order-1 sm:order-1">
                          <button
                            onClick={() => setChartView(chartView === 'cost' ? 'return' : 'cost')}
                            className="inline-flex items-center rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] px-3 py-1.5 text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
                            aria-label="切换视图"
                          >
                            {chartView === 'cost'
                              ? (mode === 'single'
                                  ? '切换到收益率表'
                                  : (mode === 'multi-dca'
                                      ? '切换到收益率对比'
                                      : '切换到收益率对比')
                                )
                              : (mode === 'single'
                                  ? '切换到收益表'
                                  : (mode === 'multi-dca'
                                      ? '切换到收益对比'
                                      : '切换到收益对比')
                                )
                            }
                          </button>
                          {chartData.length > 0 && (
                            <button
                              onClick={() => {
                                setBrushStartIndex(0);
                                setBrushEndIndex(chartData.length - 1);
                              }}
                              className="inline-flex items-center rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] px-3 py-1.5 text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
                              aria-label="重置区间"
                            >
                              重置区间
                            </button>
                          )}
                        </div>

                        {/* 图例控制区域 */}
                        <ChartLegend
                          mode={mode}
                          chartView={chartView}
                          seriesVisibility={seriesVisibility}
                          funds={funds.filter(f => f.code.trim())}
                          onToggleSeries={handleToggleSeries}
                        />
                      </div>
                    </div>
                  </div>
                  <InvestmentChart
                    ref={chartRef}
                    data={chartData}
                    chartView={chartView}
                    mode={mode}
                    funds={funds}
                    onZoomChange={(start, end) => {
                      setBrushStartIndex(start);
                      setBrushEndIndex(end);
                    }}
                    brushStartIndex={brushStartIndex}
                    brushEndIndex={brushEndIndex > 0 ? brushEndIndex : (chartData.length > 0 ? chartData.length - 1 : 0)}
                    externalSeriesVisibility={seriesVisibility}
                    onToggleSeries={handleToggleSeries}
                  />
                </div>

                {/* 定投记录表格 */}
                {investmentRecords.length > 0 && (
                  <div className="bg-gradient-to-br from-[#151515] to-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-2xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
                    <h3 className="text-white text-sm font-bold flex items-center gap-2">
                      <span className="text-base">📋</span>
                      定投记录
                    </h3>
                    {investmentRecords.length > 0 && (
                      <button
                        onClick={() => handleExportCSV(investmentRecords, mode === 'single' ? '基金定投' : '多基金定投')}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#4a9eff] hover:text-white hover:border-[#4a9eff] transition-all duration-200 active:scale-95 flex items-center gap-1"
                        title="导出为CSV"
                        aria-label="导出定投记录为CSV格式"
                      >
                        ⬇️ 导出
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto scroll-smooth">
                    <table className="w-full min-w-full">
                      <thead className="sticky top-0 z-10 bg-[#1a1a1a] bg-gradient-to-b from-[#1f1f1f] to-[#1a1a1a]">
                        <tr className="border-b border-[#2a2a2a]">
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">日期</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">类型</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">单位净值</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">金额</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">份额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a2a]">
                        {paginatedRecords.map((record: any, index: number) => {
                          const date = new Date(record.date);
                          const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                          const weekday = weekdays[date.getDay()];
                          return (
                            <tr key={`${record.date}-${index}`} className="hover:bg-[#1f1f1f] active:bg-[#252525] transition-colors">
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-[#e0e0e0]">
                                {format(date, 'yyyy-MM-dd')} {weekday}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  record.type === '定投'
                                    ? 'bg-[#4a9eff]/20 text-[#4a9eff] border border-[#4a9eff]/30'
                                    : 'bg-[#52c41a]/20 text-[#52c41a] border border-[#52c41a]/30'
                                }`}>
                                  {record.type}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-[#e0e0e0]">
                                {record.netValue ? record.netValue.toFixed(2) : '0.00'}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-[#e0e0e0]">
                                {record.investmentAmount ? Number(record.investmentAmount.toFixed(2)).toLocaleString('zh-CN') : '0.00'}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-[#e0e0e0]">
                                {record.shares ? Number(record.shares.toFixed(2)) : '0.00'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 border-t border-[#2a2a2a] flex items-center justify-between gap-2">
                    <span className="text-xs text-[#888]">
                      第 {recordsPage} / {totalRecordPages} 页 · 共 {investmentRecords.length} 条记录
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRecordsPage(prev => Math.max(1, prev - 1))}
                        disabled={recordsPage === 1}
                        className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                          recordsPage === 1
                            ? 'bg-[#1f1f1f] border-[#2a2a2a] text-[#444] cursor-not-allowed'
                            : 'bg-[#252525] border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#4a9eff] hover:text-white hover:border-[#4a9eff]'
                        } transition-all duration-200`}
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => setRecordsPage(prev => Math.min(totalRecordPages, prev + 1))}
                        disabled={recordsPage === totalRecordPages}
                        className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                          recordsPage === totalRecordPages
                            ? 'bg-[#1f1f1f] border-[#2a2a2a] text-[#444] cursor-not-allowed'
                            : 'bg-[#252525] border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#4a9eff] hover:text-white hover:border-[#4a9eff]'
                        } transition-all duration-200`}
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#0f0f0f]">
              <div className="text-center text-[#666] max-w-md px-6">
                <div className="relative inline-block mb-6">
                  <div className="text-7xl mb-2 opacity-60 animate-pulse">📊</div>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4a9eff]/20 via-transparent to-[#4a9eff]/20 blur-2xl"></div>
                </div>
                <h3 className="text-xl text-[#b0b0b0] font-semibold mb-3">准备开始回测</h3>
                <p className="text-base text-[#888] mb-4 leading-relaxed">请在左侧设置参数并开始回测</p>
                <div className="flex items-center justify-center gap-2 text-sm text-[#666]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4a9eff] animate-pulse"></span>
                  <span>回测结果将在此处显示</span>
                </div>
                <div className="mt-8 pt-6 border-t border-[#2a2a2a]">
                  <div className="grid grid-cols-3 gap-4 text-xs text-[#666]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">📈</span>
                      <span>数据获取</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">💰</span>
                      <span>回测计算</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">📊</span>
                      <span>结果展示</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-[rgba(15,15,15,0.95)] backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-300">
              <div className="text-center text-[#b0b0b0]">
                <div className="relative mb-6">
                  <div className="w-16 h-16 border-4 border-[#2a2a2a] border-t-[#4a9eff] rounded-full animate-spin mx-auto"></div>
                  <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-[#0066cc] rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
                <p className="text-base text-[#b0b0b0] font-medium mb-2">正在获取数据并计算回测结果</p>
                <div className="flex items-center justify-center gap-1 mt-3">
                  <div className="w-2 h-2 rounded-full bg-[#4a9eff] animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-[#4a9eff] animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-[#4a9eff] animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 移动端布局：垂直堆叠 */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* 移动端顶部导航 */}
        <div className="sticky top-0 z-50 bg-gradient-to-b from-[#1a1a1a] to-[#151515] border-b border-[#2a2a2a] p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>📊</span>
              <span>基金回测</span>
            </h2>
            <button
              onClick={() => {
                // 切换参数面板显示
                const paramPanel = document.getElementById('mobile-param-panel');
                if (paramPanel) {
                  paramPanel.classList.toggle('hidden');
                }
              }}
              className="p-2 bg-[#4a9eff] rounded-lg text-white"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* 移动端参数设置面板 */}
        <div id="mobile-param-panel" className="bg-gradient-to-b from-[#1a1a1a] to-[#151515] border-b border-[#2a2a2a] p-4 space-y-4 flex-shrink-0">
          <div className="px-2 py-4 space-y-4">
            <div className="group">
              <label htmlFor="fundCode" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📊</span>
                基金选择
              </label>
              <FundSelector
                mode={mode}
                onModeChange={handleModeChange}
                funds={funds}
                onFundsChange={setFunds}
              />
            </div>

            <div className="group">
              <label htmlFor="investmentAmount" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">💰</span>
                每次投资金额（元）
              </label>
              <input
                id="investmentAmount"
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                min="1"
                step="0.01"
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="每次投资金额输入框"
              />
            </div>

            <div className="group">
              <label htmlFor="frequency" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">⏰</span>
                定投频率
              </label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a] cursor-pointer"
                tabIndex={0}
                aria-label="定投频率选择"
              >
                <option value="daily" className="bg-[#252525] text-[#e0e0e0]">每日</option>
                <option value="weekly" className="bg-[#252525] text-[#e0e0e0]">每周</option>
                <option value="monthly" className="bg-[#252525] text-[#e0e0e0]">每月</option>
              </select>
            </div>

            {frequency === 'weekly' && (
              <div className="group animate-in fade-in slide-in-from-top-2 duration-300">
                <label htmlFor="weeklyDayOfWeek" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                  <span className="text-[#4a9eff]">📅</span>
                  每周几定投
                </label>
                <select
                  id="weeklyDayOfWeek"
                  value={weeklyDayOfWeek}
                  onChange={(e) => setWeeklyDayOfWeek(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a] cursor-pointer"
                  tabIndex={0}
                  aria-label="每周定投日期选择"
                >
                  <option value="0" className="bg-[#252525] text-[#e0e0e0]">周日</option>
                  <option value="1" className="bg-[#252525] text-[#e0e0e0]">周一</option>
                  <option value="2" className="bg-[#252525] text-[#e0e0e0]">周二</option>
                  <option value="3" className="bg-[#252525] text-[#e0e0e0]">周三</option>
                  <option value="4" className="bg-[#252525] text-[#e0e0e0]">周四</option>
                  <option value="5" className="bg-[#252525] text-[#e0e0e0]">周五</option>
                  <option value="6" className="bg-[#252525] text-[#e0e0e0]">周六</option>
                </select>
              </div>
            )}

            <div className="group">
              <label htmlFor="startDate" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📆</span>
                开始日期
                <span className="text-[#ff4d4f] text-xs">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(1);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近一年"
                >
                  近1年
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(3)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(3);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近3年"
                >
                  近3年
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(5)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(5);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近5年"
                >
                  近5年
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDateSelect(10)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuickDateSelect(10);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] active:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
                  tabIndex={0}
                  aria-label="选择近10年"
                >
                  近10年
                </button>
              </div>
              <input
                id="startDate"
                type="text"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                placeholder="例如：20200101 或 2020-01-01"
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="开始日期输入框"
                required
              />
            </div>

            <div className="group">
              <label htmlFor="endDate" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📆</span>
                结束日期（默认今天）
              </label>
              <input
                id="endDate"
                type="text"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                placeholder="例如：20241231 或 2024-12-31"
                className="w-full px-4 py-3 border border-[#3a3a3a] rounded-lg transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="结束日期输入框"
              />
            </div>

            <button
              onClick={async () => {
                await handleBacktest();
                // 移动端执行回测后自动隐藏参数面板
                const paramPanel = document.getElementById('mobile-param-panel');
                if (paramPanel) {
                  paramPanel.classList.add('hidden');
                }
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  await handleBacktest();
                  const paramPanel = document.getElementById('mobile-param-panel');
                  if (paramPanel) {
                    paramPanel.classList.add('hidden');
                  }
                }
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#4a9eff] via-[#3a8eef] to-[#0066cc] text-white font-semibold cursor-pointer transition-all duration-200 mt-2 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(74,158,255,0.4)] hover:from-[#5aaeff] hover:to-[#0076dc] active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none relative overflow-hidden group"
              tabIndex={0}
              aria-label="开始回测按钮"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>计算中...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>开始回测</span>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            </button>

            {error && (
              <div className="mt-4 bg-gradient-to-r from-[rgba(255,77,77,0.15)] to-[rgba(255,77,77,0.1)] text-[#ff6b6b] px-4 py-3 rounded-lg border border-[rgba(255,77,77,0.3)] text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <span className="flex-1">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* 移动端结果展示区域 */}
        <div className="flex-1 bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#0f0f0f] min-h-screen">
          {chartData.length > 0 ? (
            <div className="w-full p-4 space-y-4">
              {/* 移动端统计卡片 */}
              {stats ? (
                mode === 'single' ? (
                  <StatsCards stats={(() => {
                    const statsData = {
                      totalPeriods: investmentRecords.length,
                      totalInvestment: stats.totalInvestment,
                      averageInvestment: stats.totalInvestment / (investmentRecords.length || 1),
                      finalAssetValue: stats.currentValue,
                      dcaProfitRate: stats.profitRate,
                      dcaAnnualizedReturn: stats.annualizedReturnRate || 0,
                      lumpSumFinalAsset: stats.totalInvestment * (1 + stats.priceChangePercent / 100),
                      lumpSumProfitRate: stats.priceChangePercent,
                      lumpSumAnnualizedReturn: (() => {
                        const daysDiff = stats.startDate && chartData.length > 0
                          ? Math.ceil((new Date(chartData[chartData.length - 1].date).getTime() - new Date(stats.startDate).getTime()) / (1000 * 60 * 60 * 24))
                          : 365;
                        return daysDiff > 0
                          ? ((Math.pow(1 + stats.priceChangePercent / 100, 365 / daysDiff) - 1) * 100)
                          : 0;
                      })()
                    };

                    return statsData;
                  })()} startDate={stats.startDate} endDate={chartData.length > 0 ? chartData[chartData.length - 1].date : undefined} />
                ) : (
                  <MultiFundStatsCards
                    stats={stats}
                    mode={mode as 'multi-dca' | 'multi-lumpsum'}
                    funds={funds.filter(f => f.code.trim())}
                  />
                )
              ) : chartData.length > 0 ? (
                <StatsSkeleton count={4} />
              ) : null}

              {/* 移动端图表区域 */}
              <div className="bg-gradient-to-br from-[#151515] to-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-2xl"
                   style={{ minHeight: '550px', position: 'relative' }}>
                <div className="flex flex-col gap-3 px-3 py-2 border-b border-[#2a2a2a] bg-gradient-to-r from-[#1a1a1a] to-[#1f1f1f] flex-shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-white text-sm font-semibold truncate flex-1">
                      {mode === 'single'
                        ? (chartView === 'cost' ? '收益表' : '收益率表')
                        : (mode === 'multi-dca'
                            ? (chartView === 'cost' ? '多基金定投收益对比' : '多基金定投收益率对比')
                            : (chartView === 'cost' ? '多基金一次性投入收益对比' : '多基金一次性投入收益率对比')
                          )
                      }
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setChartView(chartView === 'cost' ? 'return' : 'cost')}
                        className="inline-flex items-center rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] px-2 py-1 text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
                        aria-label="切换视图"
                      >
                        {chartView === 'cost' ? '收益率' : '收益'}
                      </button>
                    </div>
                  </div>
                </div>
                <InvestmentChart
                  data={chartData}
                  chartView={chartView}
                  mode={mode}
                  funds={funds}
                  onZoomChange={(start, end) => {
                    setBrushStartIndex(start);
                    setBrushEndIndex(end);
                  }}
                  brushStartIndex={brushStartIndex}
                  brushEndIndex={brushEndIndex > 0 ? brushEndIndex : (chartData.length > 0 ? chartData.length - 1 : 0)}
                  externalSeriesVisibility={seriesVisibility}
                  onToggleSeries={handleToggleSeries}
                />
              </div>

              {/* 移动端定投记录表格 */}
              {investmentRecords.length > 0 && (
                <div className="bg-gradient-to-br from-[#151515] to-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-2xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
                    <h3 className="text-white text-sm font-bold flex items-center gap-2">
                      <span className="text-base">📋</span>
                      定投记录
                    </h3>
                    <button
                      onClick={() => handleExportCSV(investmentRecords, mode === 'single' ? '基金定投' : '多基金定投')}
                      className="px-2 py-1 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#4a9eff] hover:text-white hover:border-[#4a9eff] transition-all duration-200 active:scale-95 flex items-center gap-1"
                      title="导出为CSV"
                      aria-label="导出定投记录为CSV格式"
                    >
                      ⬇️ 导出
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-[#1a1a1a] bg-gradient-to-b from-[#1f1f1f] to-[#1a1a1a]">
                        <tr className="border-b border-[#2a2a2a]">
                          <th className="px-2 py-1 text-left text-[10px] font-medium text-[#888] uppercase tracking-wider">日期</th>
                          <th className="px-2 py-1 text-left text-[10px] font-medium text-[#888] uppercase tracking-wider">类型</th>
                          <th className="px-2 py-1 text-left text-[10px] font-medium text-[#888] uppercase tracking-wider">净值</th>
                          <th className="px-2 py-1 text-left text-[10px] font-medium text-[#888] uppercase tracking-wider">金额</th>
                          <th className="px-2 py-1 text-left text-[10px] font-medium text-[#888] uppercase tracking-wider">份额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a2a]">
                        {investmentRecords.slice(0, 5).map((record: any, index: number) => {
                          const date = new Date(record.date);
                          const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                          const weekday = weekdays[date.getDay()];
                          return (
                            <tr key={`${record.date}-${index}`} className="hover:bg-[#1f1f1f] transition-colors">
                              <td className="px-2 py-1 text-[10px] text-[#e0e0e0]">
                                {format(date, 'MM/dd')} {weekday}
                              </td>
                              <td className="px-2 py-1">
                                <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                                  record.type === '定投'
                                    ? 'bg-[#4a9eff]/20 text-[#4a9eff] border border-[#4a9eff]/30'
                                    : 'bg-[#52c41a]/20 text-[#52c41a] border border-[#52c41a]/30'
                                }`}>
                                  {record.type}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-[10px] text-[#e0e0e0]">
                                {record.netValue ? record.netValue.toFixed(4) : '0.0000'}
                              </td>
                              <td className="px-2 py-1 text-[10px] text-[#e0e0e0]">
                                {record.investmentAmount ? Number(record.investmentAmount.toFixed(2)).toLocaleString('zh-CN') : '0.00'}
                              </td>
                              <td className="px-2 py-1 text-[10px] text-[#e0e0e0]">
                                {record.shares ? Number(record.shares.toFixed(2)) : '0.00'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {investmentRecords.length > 5 && (
                    <div className="px-3 py-2 border-t border-[#2a2a2a] text-center">
                      <span className="text-xs text-[#888]">
                        显示最近5条，共{investmentRecords.length}条记录
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#0f0f0f]">
              <div className="text-center text-[#666] px-6">
                <div className="relative inline-block mb-6">
                  <div className="text-5xl mb-2 opacity-60 animate-pulse">📊</div>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4a9eff]/20 via-transparent to-[#4a9eff]/20 blur-xl"></div>
                </div>
                <h3 className="text-lg text-[#b0b0b0] font-semibold mb-3">准备开始回测</h3>
                <p className="text-sm text-[#888] mb-4 leading-relaxed">请设置参数并开始回测</p>
              </div>
            </div>
          )}

          {/* 移动端加载状态 */}
          {loading && (
            <div className="absolute inset-0 bg-[rgba(15,15,15,0.95)] backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-300">
              <div className="text-center text-[#b0b0b0]">
                <div className="relative mb-6">
                  <div className="w-12 h-12 border-4 border-[#2a2a2a] border-t-[#4a9eff] rounded-full animate-spin mx-auto"></div>
                  <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-[#0066cc] rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
                <p className="text-sm text-[#b0b0b0] font-medium mb-2">正在获取数据并计算回测结果</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 导出CSV函数
function handleExportCSV(records: any[], fundCode: string) {
  if (!records || records.length === 0) return;

  const headers = ['日期', '类型', '单位净值', '金额', '份额'];
  const csvContent = [
    headers.join(','),
    ...records.map(record => [
      record.date,
      record.type,
      record.netValue ? record.netValue.toFixed(4) : '0.0000',
      record.investmentAmount ? record.investmentAmount.toFixed(2) : '0.00',
      record.shares ? record.shares.toFixed(2) : '0.00'
    ].join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `定投记录_${fundCode}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
