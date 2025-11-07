'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subYears, differenceInDays } from 'date-fns';

interface FundData {
  date: string;
  netValue: number;  // 单位净值，用于计算申购份额和当前市值
  cumulativeNetValue: number;  // 累计净值，仅用于计算分红金额
}

interface BacktestResult {
  date: string;
  price: number; // 单位净值，用于显示
  cumulativePrice: number; // 累计净值，仅用于计算分红
  totalInvestment: number;
  totalShares: number;
  averageCost: number;
  currentValue: number; // 当前市值（份额 × 单位净值）
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

export default function Home() {
  const [fundCode, setFundCode] = useState('');
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
    if (!fundCode.trim()) {
      setError('请输入基金代码');
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

    try {
      // 获取基金数据（开始日期已确保必填）
      const fundResponse = await fetch(
        `/api/fund?code=${encodeURIComponent(fundCode)}&startDate=${parsedStartDate}${parsedEndDate ? `&endDate=${parsedEndDate}` : ''}`
      );

      if (!fundResponse.ok) {
        const errorData = await fundResponse.json();
        throw new Error(errorData.error || '获取基金数据失败');
      }

      const fundResult = await fundResponse.json();
      if (!fundResult.success || !fundResult.data || fundResult.data.length === 0) {
        throw new Error('未获取到基金数据，请检查基金代码是否正确');
      }

      const fundData: FundData[] = fundResult.data;

      // 如果没有设置日期，使用数据的日期范围
      const actualStartDate = parsedStartDate || fundData[0].date;
      const actualEndDate = parsedEndDate || fundData[fundData.length - 1].date;

      // 执行回测
      const backtestResponse = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fundData,
          investmentAmount: parseFloat(investmentAmount),
          frequency,
          weeklyDayOfWeek: frequency === 'weekly' ? weeklyDayOfWeek : undefined,
          startDate: actualStartDate,
          endDate: actualEndDate,
        }),
      });

      if (!backtestResponse.ok) {
        const errorData = await backtestResponse.json();
        throw new Error(errorData.error || '回测计算失败');
      }

      const backtestResult = await backtestResponse.json();
      const results: BacktestResult[] = backtestResult.data;
      const records = backtestResult.investmentRecords || [];

      // 准备图表数据：显示累计投入金额和当前份额价值
      const formattedData = results.map((item) => {
        const totalInvestment = typeof item.totalInvestment === 'number' ? item.totalInvestment : parseFloat(item.totalInvestment) || 0;
        const currentValue = typeof item.currentValue === 'number' ? item.currentValue : parseFloat(item.currentValue) || 0;
        return {
          date: format(new Date(item.date), 'yyyy-MM-dd'),
          dateObj: new Date(item.date), // 保存日期对象用于计算
          totalInvestment: Number(totalInvestment.toFixed(2)),  // 累计投入金额
          currentValue: Number(currentValue.toFixed(2)),  // 当前份额价值（份额 × 单位净值）
        };
      });
      
      // 保存开始日期用于计算年化收益率
      const startDateObj = new Date(actualStartDate);

      // 计算时间段的变化百分比（一次性投入收益率）
      // 使用累计净值计算：从开始日期的累计净值到结束日期的累计净值的变化
      let priceChangePercent = 0;
      if (results.length > 0) {
        const firstCumulativePrice = results[0].cumulativePrice;
        const lastCumulativePrice = results[results.length - 1].cumulativePrice;
        priceChangePercent = ((lastCumulativePrice - firstCumulativePrice) / firstCumulativePrice) * 100;
      }

      // 计算Y轴范围，使图表更好地展示数据（使用金额数据）
      const allValues = formattedData.flatMap(item => [item.totalInvestment, item.currentValue]).filter(v => !isNaN(v) && isFinite(v));
      if (allValues.length === 0) {
        // 如果没有有效数据，使用默认范围
        const yAxisDomain = [0, 1000];
        setChartData(formattedData);
        setStats({ ...backtestResult.stats, yAxisDomain, priceChangePercent });
        setInvestmentRecords(records);
        return;
      }
      
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);
      const range = maxValue - minValue;
      const padding = range * 0.1; // 10% 的边距
      // 如果数据范围较小，从接近最小值开始；如果最小值接近0，则从0开始
      const yAxisMin = minValue > range * 0.3 ? minValue - padding : Math.max(0, minValue - padding);
      const yAxisDomain = [
        yAxisMin,
        maxValue + padding // 最大值加上边距
      ];

      setChartData(formattedData);
      setStats({ ...backtestResult.stats, yAxisDomain, priceChangePercent, startDate: actualStartDate });
      setInvestmentRecords(records);
    } catch (err: any) {
      setError(err.message || '发生错误');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]">
      <div className="flex h-screen w-full">
        {/* 左侧参数设置面板 */}
        <div className="w-[340px] min-w-[340px] bg-gradient-to-b from-[#1a1a1a] to-[#151515] border-r border-[#2a2a2a] flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar shadow-2xl">
          <div className="px-5 py-4 flex-1 space-y-4">
            <div className="group">
              <label htmlFor="fundCode" className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
                <span className="text-[#4a9eff]">📊</span>
                基金代码
              </label>
              <input
                id="fundCode"
                type="text"
                value={fundCode}
                onChange={(e) => setFundCode(e.target.value)}
                placeholder="例如：000001"
                className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="基金代码输入框"
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
                className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
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
                className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a] cursor-pointer"
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
                  className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a] cursor-pointer"
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
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
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
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
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
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
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
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#252525] border border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a9eff] hover:text-[#4a9eff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4a9eff]/50"
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
                className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
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
                className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
                tabIndex={0}
                aria-label="结束日期输入框"
              />
            </div>

            <button
              onClick={handleBacktest}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBacktest();
                }
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#4a9eff] via-[#3a8eef] to-[#0066cc] text-white px-6 py-3 rounded-lg text-[15px] font-semibold cursor-pointer transition-all duration-200 mt-2 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(74,158,255,0.4)] hover:from-[#5aaeff] hover:to-[#0076dc] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none relative overflow-hidden group"
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
                <span>{error}</span>
              </div>
            )}

            {stats && (
              <div className="mt-6 pt-5 border-t border-[#2a2a2a] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-gradient-to-b from-[#4a9eff] to-[#0066cc] rounded-full"></div>
                  <h3 className="text-white text-base font-bold">回测统计</h3>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">定投总期数</div>
                      <span className="text-[#4a9eff] opacity-0 group-hover:opacity-100 transition-opacity">📊</span>
                    </div>
                    <div className="text-white text-xl font-bold">{investmentRecords.length}期</div>
                  </div>
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">投入总本金（元）</div>
                      <span className="text-[#4a9eff] opacity-0 group-hover:opacity-100 transition-opacity">💵</span>
                    </div>
                    <div className="text-white text-xl font-bold">¥{stats.totalInvestment.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">期末总资产（元）</div>
                      <span className="text-[#4a9eff] opacity-0 group-hover:opacity-100 transition-opacity">💰</span>
                    </div>
                    <div className="text-white text-xl font-bold">¥{stats.currentValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">定投收益率</div>
                      <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${stats.profitRate >= 0 ? 'text-[#52c41a]' : 'text-[#ff4d4f]'}`}>
                        {stats.profitRate >= 0 ? '📈' : '📉'}
                      </span>
                    </div>
                    <div className={`text-xl font-bold ${stats.profitRate >= 0 ? 'text-[#52c41a]' : 'text-[#ff4d4f]'}`}>
                      {stats.profitRate >= 0 ? '+' : ''}{stats.profitRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">当前份额</div>
                      <span className="text-[#4a9eff] opacity-0 group-hover:opacity-100 transition-opacity">📊</span>
                    </div>
                    <div className="text-white text-xl font-bold">{stats.totalShares.toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">一次性投入收益率</div>
                      <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${stats.priceChangePercent >= 0 ? 'text-[#52c41a]' : 'text-[#ff4d4f]'}`}>
                        {stats.priceChangePercent >= 0 ? '📈' : '📉'}
                      </span>
                    </div>
                    <div className={`text-xl font-bold ${stats.priceChangePercent >= 0 ? 'text-[#52c41a]' : 'text-[#ff4d4f]'}`}>
                      {stats.priceChangePercent >= 0 ? '+' : ''}{stats.priceChangePercent?.toFixed(2) || '0.00'}%
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#252525] to-[#1f1f1f] px-3 py-3 rounded-xl border border-[#2a2a2a] text-left hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg hover:shadow-[#4a9eff]/5 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#888] text-xs font-medium uppercase tracking-wide">盈亏金额</div>
                      <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${stats.profit >= 0 ? 'text-[#52c41a]' : 'text-[#ff4d4f]'}`}>
                        {stats.profit >= 0 ? '📈' : '📉'}
                      </span>
                    </div>
                    <div className={`text-xl font-bold ${stats.profit >= 0 ? 'text-[#52c41a]' : 'text-[#ff4d4f]'}`}>
                      {stats.profit >= 0 ? '+' : ''}¥{stats.profit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧图表展示区域 */}
        <div className="flex-1 bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#0f0f0f] flex flex-col relative overflow-hidden">
          {chartData.length > 0 ? (
            <div className="w-full h-full flex flex-col p-3 animate-in fade-in duration-500 overflow-hidden">
              <div className="mb-2 pb-2 border-b border-[#2a2a2a] flex-shrink-0">
                <h2 className="text-white text-[18px] font-bold m-0 bg-gradient-to-r from-white to-[#b0b0b0] bg-clip-text text-transparent">
                  定投成本 vs 价格趋势
                </h2>
              </div>
              <div className="flex-1 min-h-0 bg-gradient-to-br from-[#151515] to-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a] shadow-2xl mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 25, left: 15, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      stroke="#999"
                      tick={{ fill: '#999', fontSize: 12 }}
                      label={{ value: '时间', position: 'insideBottom', offset: -10, fill: '#999' }}
                    />
                    <YAxis 
                      label={{ value: '金额（元）', angle: -90, position: 'insideLeft', fill: '#999' }}
                      stroke="#999"
                      tick={{ fill: '#999', fontSize: 12 }}
                      domain={stats?.yAxisDomain || ['auto', 'auto']}
                      allowDataOverflow={false}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        
                        const data = payload[0].payload;
                        const totalInvestment = data.totalInvestment || 0;
                        const currentValue = data.currentValue || 0;
                        const currentDate = data.dateObj || new Date(data.date);
                        const startDate = stats?.startDate ? new Date(stats.startDate) : currentDate;
                        
                        // 计算当前收益率
                        const currentReturnRate = totalInvestment > 0 
                          ? ((currentValue - totalInvestment) / totalInvestment) * 100 
                          : 0;
                        
                        // 计算年化收益率
                        const daysDiff = differenceInDays(currentDate, startDate);
                        let annualizedReturnRate: number | null = null;
                        if (daysDiff > 0 && totalInvestment > 0 && currentValue > 0) {
                          const years = daysDiff / 365;
                          if (years > 0) {
                            const totalReturn = currentValue / totalInvestment;
                            if (totalReturn > 0) {
                              annualizedReturnRate = (Math.pow(totalReturn, 1 / years) - 1) * 100;
                            }
                          }
                        }
                        
                        return (
                          <div style={{
                            backgroundColor: 'rgba(20, 20, 20, 0.95)',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            padding: '12px',
                            color: '#fff'
                          }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '6px' }}>
                              日期: {label}
                            </div>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} style={{ marginBottom: '4px', fontSize: '13px' }}>
                                <span style={{ color: entry.color, marginRight: '8px' }}>●</span>
                                <span style={{ color: '#e0e0e0' }}>{entry.name}: </span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>¥{entry.value.toFixed(2)}</span>
                              </div>
                            ))}
                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #444' }}>
                              <div style={{ marginBottom: '4px', fontSize: '13px' }}>
                                <span style={{ color: '#888' }}>当前收益率: </span>
                                <span style={{ 
                                  color: currentReturnRate >= 0 ? '#52c41a' : '#ff4d4f',
                                  fontWeight: 'bold'
                                }}>
                                  {currentReturnRate >= 0 ? '+' : ''}{currentReturnRate.toFixed(2)}%
                                </span>
                              </div>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ color: '#888' }}>年化收益率: </span>
                                {annualizedReturnRate !== null ? (
                                  <span style={{ 
                                    color: annualizedReturnRate >= 0 ? '#52c41a' : '#ff4d4f',
                                    fontWeight: 'bold'
                                  }}>
                                    {annualizedReturnRate >= 0 ? '+' : ''}{annualizedReturnRate.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span style={{ color: '#888' }}>--</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px' }}
                      iconType="line"
                      formatter={(value) => <span style={{ color: '#e0e0e0', fontSize: '14px' }}>{value}</span>}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalInvestment" 
                      stroke="#00CED1" 
                      name="累计投入金额"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 8, fill: '#00CED1' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="currentValue" 
                      stroke="#FFD700" 
                      name="当前份额价值"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 8, fill: '#FFD700' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* 定投记录表格 */}
              {investmentRecords.length > 0 && (
                <div className="bg-gradient-to-br from-[#151515] to-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-2xl overflow-hidden flex flex-col flex-shrink-0 h-[200px]">
                  <div className="px-4 py-2 border-b border-[#2a2a2a] flex-shrink-0">
                    <h3 className="text-white text-sm font-bold">定投记录</h3>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">日期</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">类型</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">单位净值</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">金额</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#888] uppercase tracking-wider">份额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a2a]">
                        {investmentRecords.map((record: any, index: number) => {
                          const date = new Date(record.date);
                          const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                          const weekday = weekdays[date.getDay()];
                          return (
                            <tr key={index} className="hover:bg-[#1f1f1f] transition-colors">
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
                                {record.netValue.toFixed(4)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-[#e0e0e0]">
                                {record.investmentAmount.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-[#e0e0e0]">
                                {record.shares.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
    </div>
  );
}

