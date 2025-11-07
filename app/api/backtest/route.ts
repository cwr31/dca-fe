import { NextRequest, NextResponse } from 'next/server';

interface FundData {
  date: string;
  netValue: number;
  cumulativeNetValue: number;
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
    price: number;
    totalInvestment: number;
    totalShares: number;
    averageCost: number;
  }> = [];

  let totalInvestment = 0;
  let totalShares = 0;
  let lastInvestmentDate: Date | null = null;

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
      // 执行定投
      const shares = investmentAmount / dataPoint.netValue;
      totalInvestment += investmentAmount;
      totalShares += shares;
      lastInvestmentDate = currentDate;
    }

    // 计算平均成本
    const averageCost = totalShares > 0 ? totalInvestment / totalShares : 0;

    results.push({
      date: dataPoint.date,
      price: dataPoint.netValue,
      totalInvestment,
      totalShares,
      averageCost: averageCost || dataPoint.netValue, // 如果没有投资，使用当前价格
    });
  }

  return results;
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

    const results = calculateDCA({
      fundData,
      investmentAmount: parseFloat(investmentAmount),
      frequency,
      weeklyDayOfWeek: frequency === 'weekly' ? weeklyDayOfWeek : undefined,
      startDate,
      endDate,
    });

    // 计算统计信息
    const lastResult = results[results.length - 1];
    const currentValue = lastResult.totalShares * lastResult.price;
    const profit = currentValue - lastResult.totalInvestment;
    const profitRate = (profit / lastResult.totalInvestment) * 100;

    return NextResponse.json({
      success: true,
      data: results,
      stats: {
        totalInvestment: lastResult.totalInvestment,
        totalShares: lastResult.totalShares,
        currentValue,
        profit,
        profitRate,
        averageCost: lastResult.averageCost,
        currentPrice: lastResult.price,
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

