import React from 'react';

interface StatsCardProps {
  icon: string;
  title: string;
  value: string | number;
  subtitle: string;
  subValue: string | number;
  trend?: 'positive' | 'negative' | 'neutral';
  accentColor?: string;
  className?: string;
}

export function StatsCard({
  icon,
  title,
  value,
  subtitle,
  subValue,
  trend = 'neutral',
  accentColor = '#4a9eff',
  className = ''
}: StatsCardProps) {
  const trendColors = {
    positive: 'text-red-400',
    negative: 'text-green-400',
    neutral: 'text-white'
  };

  return (
    <div className={`stats-card group bg-[#1c1c1c]/90 rounded-lg border border-[#2a2a2a]
                transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                relative overflow-hidden ${className}`}
    >
      {/* 顶部装饰线条 */}
      <div className="absolute left-0 top-0 h-1 w-full group-hover:h-1.5 transition-all duration-300"
           style={{ background: `linear-gradient(to right, ${accentColor}, transparent)` }} />

      <div className="flex items-start gap-3 p-4 md:p-5">
        {/* 图标 */}
        <div className="text-2xl md:text-3xl flex-shrink-0"
             style={{ filter: `drop-shadow(0 0 4px ${accentColor}40)` }}
        >
          {icon}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div className="text-[11px] md:text-xs text-[#888] font-medium uppercase tracking-wider mb-2">
            {title}
          </div>

          {/* 主要数值 */}
          <div className={`text-lg md:text-2xl font-bold mb-2 break-words ${trendColors[trend]}`}
               style={{ textShadow: trend === 'positive' ? '0 0 8px rgba(255,77,77,0.3)' :
                                  trend === 'negative' ? '0 0 8px rgba(82,196,130,0.3)' : 'none' }}
          >
            {value}
          </div>

          {/* 辅助信息 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#666]">{subtitle}</span>
            <span className="text-[11px] md:text-xs text-[#888] font-medium break-words">
              {subValue}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 统计卡片组组件
interface StatsCardsProps {
  stats: {
    totalPeriods: number;
    totalInvestment: number;
    finalAssetValue: number;
    dcaProfitRate: number;
    dcaAnnualizedReturn: number;
    lumpSumFinalAsset: number;
    lumpSumProfitRate: number;
    lumpSumAnnualizedReturn: number;
    averageInvestment: number;
  };
  startDate?: string;
  endDate?: string;
}

export function StatsCards({ stats, startDate, endDate }: StatsCardsProps) {
  // 判断哪种策略更优
  const dcaIsBetter = stats.dcaProfitRate > stats.lumpSumProfitRate;
  const winnerText = dcaIsBetter ? '定投优于一次性' : '一次性优于定投';

  // 计算盈亏差值
  const profitDiff = Math.abs(stats.dcaProfitRate - stats.lumpSumProfitRate).toFixed(2);
  const assetDiff = Math.abs(stats.finalAssetValue - stats.lumpSumFinalAsset).toFixed(2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
      {/* 卡片1: 定投执行概况 */}
      <StatsCard
        icon="💰"
        title="定投执行概况"
        value={`¥${Number(stats.totalInvestment.toFixed(2)).toLocaleString('zh-CN')}`}
        subtitle="执行期数"
        subValue={`${stats.totalPeriods}期 × ¥${stats.averageInvestment.toLocaleString('zh-CN')}`}
        accentColor="#FFD700"
        trend="neutral"
      />

      {/* 卡片2: 区间收益率 */}
      <StatsCard
        icon="📈"
        title="区间收益率"
        value={
          <>
            <span className={dcaIsBetter ? 'text-red-400' : 'text-[#888]'}>
              定投：{stats.dcaProfitRate >= 0 ? '+' : ''}{stats.dcaProfitRate.toFixed(2)}%
            </span>
            <br />
            <span className={!dcaIsBetter ? 'text-red-400' : 'text-[#888]'}>
              一次性：{stats.lumpSumProfitRate >= 0 ? '+' : ''}{stats.lumpSumProfitRate.toFixed(2)}%
            </span>
          </>
        }
        subtitle="结论"
        subValue={`${winnerText} (${profitDiff}%)`}
        accentColor="#4a9eff"
        trend={dcaIsBetter ? 'positive' : 'negative'}
      />

      {/* 卡片3: 资产增长分析 */}
      <StatsCard
        icon="💼"
        title="资产增长分析"
        value={
          <>
            <span className={dcaIsBetter ? 'text-red-400' : 'text-[#888]'}>
              定投：¥{Number(stats.finalAssetValue.toFixed(2)).toLocaleString('zh-CN')}
            </span>
            <br />
            <span className={!dcaIsBetter ? 'text-red-400' : 'text-[#888]'}>
              一次性：¥{Number(stats.lumpSumFinalAsset.toFixed(2)).toLocaleString('zh-CN')}
            </span>
          </>
        }
        subtitle="对比"
        subValue={`${dcaIsBetter ? '定投 > 一次性' : '一次性 > 定投'} (¥${Number(assetDiff).toLocaleString('zh-CN')})`}
        accentColor="#FF6BFF"
        trend={dcaIsBetter ? 'positive' : 'negative'}
      />

      {/* 卡片4: 年化收益率 */}
      <StatsCard
        icon="⚡"
        title="年化收益率"
        value={
          <>
            <span className={stats.dcaAnnualizedReturn >= stats.lumpSumAnnualizedReturn ? 'text-red-400' : 'text-[#888]'}>
              定投：{stats.dcaAnnualizedReturn >= 0 ? '+' : ''}{stats.dcaAnnualizedReturn.toFixed(2)}%
            </span>
            <br />
            <span className={stats.lumpSumAnnualizedReturn >= stats.dcaAnnualizedReturn ? 'text-red-400' : 'text-[#888]'}>
              一次性：{stats.lumpSumAnnualizedReturn >= 0 ? '+' : ''}{stats.lumpSumAnnualizedReturn.toFixed(2)}%
            </span>
          </>
        }
        subtitle="效率差距"
        subValue={`年化差值 ${Math.abs(stats.dcaAnnualizedReturn - stats.lumpSumAnnualizedReturn).toFixed(2)}%`}
        accentColor="#00CED1"
        trend={stats.dcaAnnualizedReturn >= stats.lumpSumAnnualizedReturn ? 'positive' : 'negative'}
      />
    </div>
  );
}
