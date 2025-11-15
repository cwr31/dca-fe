import { NextRequest, NextResponse } from 'next/server';

interface FundData {
  date: string;
  netValue: number;
  cumulativeNetValue: number;
}

interface BacktestRequest {
  funds: Array<{
    code: string;
    data: FundData[];
  }>;
  investmentAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  weeklyDayOfWeek?: number;
  startDate: string;
  endDate: string;
  mode: 'single' | 'multi-dca' | 'multi-lumpsum';
}

interface BacktestResult {
  date: string;
  price: number;
  cumulativePrice: number;
  totalInvestment?: number;
  totalShares?: number;
  averageCost?: number;
  currentValue?: number;
  annualizedReturnRate?: number;
  // 多基金模式的数据字段
  [key: string]: any;
}

interface InvestmentRecord {
  date: string;
  type: '定投' | '一次性投入';
  netValue: number;
  investmentAmount: number;
  shares: number;
  fundCode?: string; // 多基金模式下的基金代码
}

export async function POST(request: NextRequest) {
  try {
    const body: BacktestRequest = await request.json();
    const {
      funds,
      investmentAmount,
      frequency,
      weeklyDayOfWeek,
      startDate,
      endDate,
      mode
    } = body;

    // 验证输入参数
    if (!funds || funds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请至少选择一个基金' },
        { status: 400 }
      );
    }

    if (mode === 'single' && funds.length !== 1) {
      return NextResponse.json(
        { success: false, error: '单基金模式只能选择一个基金' },
        { status: 400 }
      );
    }

    const results: BacktestResult[] = [];
    const investmentRecords: InvestmentRecord[] = [];

    // 根据模式处理
    if (mode === 'single') {
      // 单基金模式的原有逻辑
      const fund = funds[0];
      const backtestData = calculateSingleFundBacktest(
        fund.data,
        investmentAmount,
        frequency,
        weeklyDayOfWeek,
        startDate,
        endDate
      );

      results.push(...backtestData.data);
      investmentRecords.push(...backtestData.records);
    } else {
      // 多基金模式
      const multiFundData = calculateMultiFundBacktest(
        funds,
        investmentAmount,
        frequency,
        weeklyDayOfWeek,
        startDate,
        endDate,
        mode as 'multi-dca' | 'multi-lumpsum'
      );

      results.push(...multiFundData.data);
      investmentRecords.push(...multiFundData.records);
    }

    // 计算统计信息
    const stats = calculateStats(results, mode);

    return NextResponse.json({
      success: true,
      data: results,
      investmentRecords,
      stats
    });

  } catch (error: any) {
    console.error('回测计算错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '回测计算失败' },
      { status: 500 }
    );
  }
}

function calculateSingleFundBacktest(
  fundData: FundData[],
  investmentAmount: number,
  frequency: 'daily' | 'weekly' | 'monthly',
  weeklyDayOfWeek: number | undefined,
  startDate: string,
  endDate: string
) {
  const data: BacktestResult[] = [];
  const records: InvestmentRecord[] = [];

  const filteredData = fundData.filter(item =>
    item.date >= startDate && item.date <= endDate
  );

  let totalInvestment = 0;
  let totalShares = 0;
  let totalLumpSumInvestment = investmentAmount; // 一次性投入金额

  // 计算一次性投入的份额
  const firstDayData = filteredData[0];
  if (firstDayData) {
    totalLumpSumInvestment = investmentAmount;
  }

  filteredData.forEach((item, index) => {
    const currentDate = new Date(item.date);

    // 计算定投份额
    let shouldInvest = false;
    if (frequency === 'daily') {
      shouldInvest = true;
    } else if (frequency === 'weekly' && weeklyDayOfWeek !== undefined) {
      shouldInvest = currentDate.getDay() === weeklyDayOfWeek;
    } else if (frequency === 'monthly') {
      shouldInvest = currentDate.getDate() === 1;
    }

    if (shouldInvest && index < filteredData.length - 1) { // 不在最后一天投资
      const shares = investmentAmount / item.netValue;
      totalInvestment += investmentAmount;
      totalShares += shares;

      records.push({
        date: item.date,
        type: '定投',
        netValue: item.netValue,
        investmentAmount,
        shares
      });
    }

    // 计算当前价值
    const currentValue = totalShares * item.netValue;
    const lumpSumValue = totalLumpSumInvestment * (item.cumulativeNetValue / firstDayData.cumulativeNetValue);

    // 计算年化收益率
    let annualizedReturnRate = 0;
    if (totalInvestment > 0 && index > 0) {
      const daysDiff = Math.ceil((currentDate.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      const totalReturn = (currentValue - totalInvestment) / totalInvestment;
      annualizedReturnRate = Math.pow(1 + totalReturn, 365 / daysDiff) - 1;
    }

    data.push({
      date: item.date,
      price: item.netValue,
      cumulativePrice: item.cumulativeNetValue,
      totalInvestment,
      totalShares,
      averageCost: totalShares > 0 ? totalInvestment / totalShares : 0,
      currentValue,
      annualizedReturnRate: annualizedReturnRate * 100
    });
  });

  return { data, records };
}

function calculateMultiFundBacktest(
  funds: Array<{ code: string; data: FundData[] }>,
  investmentAmount: number,
  frequency: 'daily' | 'weekly' | 'monthly',
  weeklyDayOfWeek: number | undefined,
  startDate: string,
  endDate: string,
  mode: 'multi-dca' | 'multi-lumpsum'
) {
  const data: BacktestResult[] = [];
  const records: InvestmentRecord[] = [];

  // 筛选每个基金的数据
  const filteredFunds = funds.map(fund => ({
    code: fund.code,
    data: fund.data.filter(item => item.date >= startDate && item.date <= endDate)
  }));

  // 获取所有日期的并集
  const allDates = new Set<string>();
  filteredFunds.forEach(fund => {
    fund.data.forEach(item => allDates.add(item.date));
  });

  const sortedDates = Array.from(allDates).sort();

  sortedDates.forEach(date => {
    const dateData: BacktestResult = { date, price: 0, cumulativePrice: 0 };

    filteredFunds.forEach((fund, fundIndex) => {
      const fundData = fund.data.find(item => item.date === date);
      if (!fundData) return;

      const fundPrefix = `fund${fundIndex + 1}`;

      if (mode === 'multi-dca') {
        // 多基金定投模式
        const backtestResult = calculateSingleFundBacktest(
          fund.data,
          investmentAmount,
          frequency,
          weeklyDayOfWeek,
          startDate,
          endDate
        );

        const dayResult = backtestResult.data.find(item => item.date === date);
        if (dayResult) {
          dateData[`${fundPrefix}_currentValue`] = dayResult.currentValue || 0;
          dateData[`${fundPrefix}_totalInvestment`] = dayResult.totalInvestment || 0;
          dateData[`${fundPrefix}_return`] = dayResult.annualizedReturnRate || 0;
        }
      } else if (mode === 'multi-lumpsum') {
        // 多基金一次性投入模式
        const firstDayData = fund.data[0];
        if (firstDayData && firstDayData.cumulativeNetValue > 0) {
          const lumpSumValue = investmentAmount * (fundData.cumulativeNetValue / firstDayData.cumulativeNetValue);
          const lumpSumReturn = ((fundData.cumulativeNetValue - firstDayData.cumulativeNetValue) / firstDayData.cumulativeNetValue) * 100;

          dateData[`${fundPrefix}_lumpSum`] = lumpSumValue;
          dateData[`${fundPrefix}_lumpSumReturn`] = lumpSumReturn;
        }
      }

      dateData.price = fundData.netValue;
      dateData.cumulativePrice = fundData.cumulativeNetValue;
    });

    data.push(dateData);
  });

  return { data, records };
}

function calculateStats(results: BacktestResult[], mode: string) {
  if (results.length === 0) return {};

  const lastResult = results[results.length - 1];

  const totalInvestment = lastResult.totalInvestment || 0;
  const currentValue = lastResult.currentValue || 0;

  if (mode === 'single') {
    return {
      totalInvestment,
      currentValue,
      profitRate: totalInvestment > 0
        ? ((currentValue - totalInvestment) / totalInvestment) * 100
        : 0,
      annualizedReturnRate: lastResult.annualizedReturnRate || 0
    };
  } else {
    // 多基金模式的统计信息
    const stats: any = {};

    // 根据模式计算不同的统计信息
    if (mode === 'multi-dca') {
      // 多基金定投统计
      const fundCount = Object.keys(lastResult).filter(key => key.includes('currentValue')).length;
      let totalValue = 0;
      let totalInvestment = 0;

      for (let i = 1; i <= fundCount; i++) {
        const currentValue = lastResult[`fund${i}_currentValue`] || 0;
        const investment = lastResult[`fund${i}_totalInvestment`] || 0;
        totalValue += currentValue;
        totalInvestment += investment;
      }

      stats.totalInvestment = totalInvestment;
      stats.currentValue = totalValue;
      stats.profitRate = totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0;
    } else if (mode === 'multi-lumpsum') {
      // 多基金一次性投入统计
      const fundCount = Object.keys(lastResult).filter(key => key.includes('lumpSum')).length / 2; // 除以2因为每个基金有lumpSum和lumpSumReturn
      let totalValue = 0;
      const totalInvestment = fundCount * 100; // 假设每个基金投资100元

      for (let i = 1; i <= fundCount; i++) {
        const lumpSumValue = lastResult[`fund${i}_lumpSum`] || 0;
        totalValue += lumpSumValue;
      }

      stats.totalInvestment = totalInvestment;
      stats.currentValue = totalValue;
      stats.profitRate = totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0;
    }

    return stats;
  }
}