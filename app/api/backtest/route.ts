import { NextRequest, NextResponse } from 'next/server';

interface FundData {
  date: string;
  netValue: number;  // 单位净值，用于计算申购份额和当前市值
  cumulativeNetValue: number;  // 累计净值，仅用于计算分红金额
}

interface BacktestParams {
  fundData: FundData[];
  investmentAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  weeklyDayOfWeek?: number; // 0=周日, 1=周一, ..., 6=周六
  startDate: string;
  endDate: string;
}

function calculateDCA(params: BacktestParams) {
  const { fundData, investmentAmount, frequency, weeklyDayOfWeek, startDate, endDate } = params;
  
  const results: Array<{
    date: string;
    price: number;  // 单位净值，用于显示
    cumulativePrice: number; // 累计净值，仅用于计算分红
    totalInvestment: number;
    totalShares: number;
    averageCost: number;
    currentValue: number;  // 当前市值（份额 × 单位净值）
  }> = [];

  let totalInvestment = 0;
  let totalShares = 0;
  let lastInvestmentDate: Date | null = null;
  let previousDataPoint: FundData | null = null; // 用于计算分红
  const investmentRecords: Array<{
    date: string;
    type: '定投' | '分红再投';
    netValue: number;
    investmentAmount: number;
    shares: number;
  }> = [];

  // 按日期排序
  const sortedData = [...fundData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const start = new Date(startDate);
  const end = new Date(endDate);

  // 判断是否需要定投的辅助函数
  const shouldInvest = (currentDate: Date, lastDate: Date | null): boolean => {
    switch (frequency) {
      case 'daily':
        // 每天定投：每天都投资（不检查lastDate）
        return true;
      case 'weekly':
        // 每周指定日期定投
        if (weeklyDayOfWeek === undefined) {
          // 如果没有指定周几，使用原来的逻辑（间隔至少7天）
          if (!lastDate) return true;
          const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
          return daysDiff >= 7;
        } else {
          // 检查当前日期是否是指定的周几
          const currentDayOfWeek = currentDate.getDay(); // 0=周日, 1=周一, ..., 6=周六
          if (currentDayOfWeek !== weeklyDayOfWeek) {
            return false;
          }
          // 如果是第一次投资，直接返回true
          if (!lastDate) return true;
          // 如果上次投资也是同一天，需要确保至少间隔一周
          const lastDayOfWeek = lastDate.getDay();
          if (lastDayOfWeek === weeklyDayOfWeek) {
            const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
            return daysDiff >= 7;
          }
          return true;
        }
      case 'monthly':
        // 每月投资（检查是否跨月）
        if (!lastDate) return true;
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const lastMonth = lastDate.getMonth();
        const lastYear = lastDate.getFullYear();
        return currentYear > lastYear || (currentYear === lastYear && currentMonth > lastMonth);
      default:
        return false;
    }
  };

  for (const dataPoint of sortedData) {
    const currentDate = new Date(dataPoint.date);
    
    // 只处理在日期范围内的数据
    if (currentDate < start || currentDate > end) {
      continue;
    }

    // 判断是否需要定投
    if (shouldInvest(currentDate, lastInvestmentDate)) {
      // 执行定投 - 使用单位净值计算份额（基金申购按单位净值计算）
      const shares = investmentAmount / dataPoint.netValue;
      totalInvestment += investmentAmount;
      totalShares += shares;
      lastInvestmentDate = currentDate;
      
      // 记录每次定投的详细信息
      investmentRecords.push({
        date: dataPoint.date,
        type: '定投',
        netValue: dataPoint.netValue,
        investmentAmount: investmentAmount,
        shares: shares,
      });
    }

    // 检测并处理分红再投
    // 分红价值 = 持有份额 × ((累计净值变化) - (单位净值变化))
    // 分红再投：将分红金额按单位净值转换为份额
    if (previousDataPoint && totalShares > 0) {
      const cumulativeNetValueChange = dataPoint.cumulativeNetValue - previousDataPoint.cumulativeNetValue;
      const netValueChange = dataPoint.netValue - previousDataPoint.netValue;
      const dividendValue = totalShares * (cumulativeNetValueChange - netValueChange);
      
      // 如果检测到分红（差值大于0），进行分红再投
      if (dividendValue > 0.0001) { // 使用小阈值避免浮点数误差
        // 分红再投：将分红金额按单位净值转换为份额
        const dividendShares = dividendValue / dataPoint.netValue;
        totalShares += dividendShares;
        // 注意：分红再投不增加totalInvestment，因为这是用分红金额再投资
        
        // 记录分红再投的详细信息
        investmentRecords.push({
          date: dataPoint.date,
          type: '分红再投',
          netValue: dataPoint.netValue,
          investmentAmount: dividendValue, // 分红金额
          shares: dividendShares, // 分红再投获得的份额
        });
      }
    }

    // 更新前一个数据点
    previousDataPoint = dataPoint;

    // 计算平均成本（基于投资金额和份额）
    const averageCost = totalShares > 0 ? totalInvestment / totalShares : 0;
    
    // 计算当前市值 - 使用单位净值（当前份额价值 = 份额 × 单位净值）
    const currentValue = totalShares * dataPoint.netValue;

    results.push({
      date: dataPoint.date,
      price: dataPoint.netValue, // 单位净值，用于显示
      cumulativePrice: dataPoint.cumulativeNetValue, // 累计净值，仅用于计算分红
      totalInvestment,
      totalShares,
      averageCost: averageCost || dataPoint.netValue, // 如果没有投资，使用单位净值
      currentValue, // 当前市值
    });
  }

  return { results, investmentRecords };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundData, investmentAmount, frequency, weeklyDayOfWeek, startDate, endDate } = body;

    if (!fundData || !Array.isArray(fundData) || fundData.length === 0) {
      return NextResponse.json(
        { error: '基金数据不能为空' },
        { status: 400 }
      );
    }

    if (!investmentAmount || investmentAmount <= 0) {
      return NextResponse.json(
        { error: '投资金额必须大于0' },
        { status: 400 }
      );
    }

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json(
        { error: '定投频率必须是 daily、weekly 或 monthly' },
        { status: 400 }
      );
    }

    if (frequency === 'weekly' && weeklyDayOfWeek !== undefined) {
      if (weeklyDayOfWeek < 0 || weeklyDayOfWeek > 6 || !Number.isInteger(weeklyDayOfWeek)) {
        return NextResponse.json(
          { error: '每周几定投必须是 0-6 之间的整数（0=周日, 1=周一, ..., 6=周六）' },
          { status: 400 }
        );
      }
    }

    const { results, investmentRecords } = calculateDCA({
      fundData,
      investmentAmount: parseFloat(investmentAmount),
      frequency,
      weeklyDayOfWeek: frequency === 'weekly' ? weeklyDayOfWeek : undefined,
      startDate,
      endDate,
    });

    // 计算统计信息
    const lastResult = results[results.length - 1];
    // 期末总资产 = 当前份额 × 单位净值
    const finalTotalAssets = lastResult.currentValue;
    // 投入总本金 = 累计定投金额（不包括分红再投，因为分红再投是用分红金额再投资）
    const totalPrincipal = lastResult.totalInvestment;
    // 定投收益率 = (期末总资产 - 投入总本金) / 投入总本金 × 100%
    const profit = finalTotalAssets - totalPrincipal;
    const profitRate = totalPrincipal > 0 ? (profit / totalPrincipal) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: results,
      investmentRecords: investmentRecords.reverse(), // 反转，最新的在前
      stats: {
        totalInvestment: totalPrincipal, // 投入总本金
        totalShares: lastResult.totalShares,
        currentValue: finalTotalAssets, // 期末总资产
        profit,
        profitRate,
        averageCost: lastResult.averageCost,
        currentPrice: lastResult.price, // 使用单位净值作为当前价格
      },
    });
  } catch (error: any) {
    console.error('回测计算失败:', error);
    return NextResponse.json(
      { error: error.message || '回测计算失败' },
      { status: 500 }
    );
  }
}

