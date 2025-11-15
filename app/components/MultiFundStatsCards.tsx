import React from 'react';
import { StatsCard } from './StatsCards';

interface MultiFundStatsCardsProps {
  stats: {
    funds?: Array<{
      code: string;
      name?: string;
      totalInvestment?: number;
      finalAssetValue?: number;
      profitRate?: number;
      annualizedReturn?: number;
    }>;
    bestPerformer?: string;
    worstPerformer?: string;
    performanceDifference?: number;
    totalInvestment?: number;
    totalFinalValue?: number;
    averageReturn?: number;
  };
  mode: 'multi-dca' | 'multi-lumpsum';
  funds: Array<{ code: string; name?: string }>;
}

export function MultiFundStatsCards({ stats, mode, funds }: MultiFundStatsCardsProps) {
  // 获取基金收益率数据
  const getFundPerformance = (fundCode: string) => {
    const fundData = stats.funds?.find(f => f.code === fundCode);
    return fundData || {
      totalInvestment: 0,
      finalAssetValue: 0,
      profitRate: 0,
      annualizedReturn: 0
    };
  };

  // 找出表现最好和最差的基金
  const sortedFunds = funds
    .map(fund => ({
      ...fund,
      performance: getFundPerformance(fund.code)
    }))
    .sort((a, b) => (b.performance.profitRate || 0) - (a.performance.profitRate || 0));

  const bestFund = sortedFunds[0];
  const worstFund = sortedFunds[sortedFunds.length - 1];
  const performanceDifference = (bestFund?.performance.profitRate || 0) - (worstFund?.performance.profitRate || 0);

  // 计算总计数据
  const totalInvestment = funds.reduce((sum, fund) => {
    const fundData = getFundPerformance(fund.code);
    return sum + (fundData.totalInvestment || 0);
  }, 0);

  const totalFinalValue = funds.reduce((sum, fund) => {
    const fundData = getFundPerformance(fund.code);
    return sum + (fundData.finalAssetValue || 0);
  }, 0);

  const averageReturn = funds.length > 0
    ? funds.reduce((sum, fund) => {
        const fundData = getFundPerformance(fund.code);
        return sum + (fundData.profitRate || 0);
      }, 0) / funds.length
    : 0;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
      {/* 卡片1: 基金数量概况 */}
      <StatsCard
        icon={mode === 'multi-dca' ? '📈' : '💹'}
        title={`${mode === 'multi-dca' ? '定投' : '一次性投入'}概况`}
        value={`${funds.length}个基金`}
        subtitle="总投资"
        subValue={`¥${Number(totalInvestment.toFixed(2)).toLocaleString('zh-CN')}`}
        accentColor="#FFD700"
        trend="neutral"
      />

      {/* 卡片2: 最佳表现基金 */}
      <StatsCard
        icon="🏆"
        title="最佳表现"
        value={
          bestFund ? (
            <>
              <span className="text-red-400">
                {bestFund.code}
              </span>
              <br />
              <span className="text-lg">
                {(bestFund.performance.profitRate || 0) >= 0 ? '+' : ''}{(bestFund.performance.profitRate || 0).toFixed(2)}%
              </span>
            </>
          ) : '-'
        }
        subtitle="年化收益"
        subValue={
          bestFund
            ? `${(bestFund.performance.annualizedReturn || 0) >= 0 ? '+' : ''}${(bestFund.performance.annualizedReturn || 0).toFixed(2)}%`
            : '-'
        }
        accentColor="#4a9eff"
        trend="positive"
      />

      {/* 卡片3: 表现差异分析 */}
      <StatsCard
        icon="📊"
        title="收益差异"
        value={
          bestFund && worstFund ? (
            <>
              <span className="text-red-400">{bestFund.code}</span>
              <span className="text-[#888]"> vs </span>
              <span className="text-green-400">{worstFund.code}</span>
            </>
          ) : '-'
        }
        subtitle="差距"
        subValue={`${performanceDifference?.toFixed(2) || 0}%`}
        accentColor="#FF6BFF"
        trend={performanceDifference && performanceDifference > 0 ? 'positive' : 'neutral'}
      />

      {/* 卡片4: 平均表现 */}
      <StatsCard
        icon="⚖️"
        title="平均表现"
        value={`${averageReturn >= 0 ? '+' : ''}${averageReturn.toFixed(2)}%`}
        subtitle="总资产"
        subValue={`¥${Number(totalFinalValue.toFixed(2)).toLocaleString('zh-CN')}`}
        accentColor="#00CED1"
        trend={averageReturn >= 0 ? 'positive' : 'negative'}
      />
    </div>
  );
}