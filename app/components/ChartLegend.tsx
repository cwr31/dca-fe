'use client';

import React from 'react';
import { FundInput } from './FundSelector';

interface ChartLegendProps {
  mode: 'single' | 'multi-dca' | 'multi-lumpsum';
  chartView: 'cost' | 'return';
  seriesVisibility: any;
  funds: FundInput[];
  onToggleSeries: (seriesKey: string) => void;
}

// 获取多基金颜色配置
const getFundColor = (index: number) => {
  const colors = ['#00CED1', '#FFD700', '#FF6BFF', '#4ECDC4', '#FF8C00', '#32CD32'];
  return colors[index % colors.length];
};

// 系列配置
const seriesConfig = {
  // 单基金模式配置
  cost: { name: '累计投入', color: '#FFFFFF' },
  value: { name: '当前价值', color: '#FFD700' },
  lumpSum: { name: '一次性投入', color: '#FF6BFF' },
  return: { name: '定投年化收益率', color: '#4ECDC4' },
  lumpSumReturn: { name: '一次性投入年化收益率', color: '#FF6BFF' },
  // 多基金共用配置
  shared_investment: { name: '累计投入', color: '#FFFFFF' },
};

export default function ChartLegend({ mode, chartView, seriesVisibility, funds, onToggleSeries }: ChartLegendProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {mode === 'single' ? (
        chartView === 'cost' ? (
          <>
            <button
              onClick={() => onToggleSeries('cost')}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
              style={{ opacity: seriesVisibility.cost ? 1 : 0.5 }}
            >
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: seriesConfig.cost.color }}
              />
              <span>{seriesConfig.cost.name}</span>
            </button>

            <button
              onClick={() => onToggleSeries('value')}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
              style={{ opacity: seriesVisibility.value ? 1 : 0.5 }}
            >
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: seriesConfig.value.color }}
              />
              <span>{seriesConfig.value.name}</span>
            </button>

            <button
              onClick={() => onToggleSeries('lumpSum')}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
              style={{ opacity: seriesVisibility.lumpSum ? 1 : 0.5 }}
            >
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: seriesConfig.lumpSum.color }}
              />
              <span>{seriesConfig.lumpSum.name}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onToggleSeries('return')}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
              style={{ opacity: seriesVisibility.return ? 1 : 0.5 }}
            >
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: seriesConfig.return.color }}
              />
              <span>{seriesConfig.return.name}</span>
            </button>

            <button
              onClick={() => onToggleSeries('lumpSumReturn')}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
              style={{ opacity: seriesVisibility.lumpSumReturn ? 1 : 0.5 }}
            >
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: seriesConfig.lumpSumReturn.color }}
              />
              <span>{seriesConfig.lumpSumReturn.name}</span>
            </button>
          </>
        )
      ) : (
        // 多基金模式的图例
        funds.map((fund, fundIndex) => {
          const fundPrefix = `fund${fundIndex + 1}`;
          const fundCode = fund.code || `基金${fundIndex + 1}`;
          const fundColor = getFundColor(fundIndex);

          if (mode === 'multi-dca') {
            return chartView === 'cost' ? (
              <div key={fundIndex} className="flex items-center gap-1.5 mr-3">
                <button
                  onClick={() => onToggleSeries(`${fundPrefix}_value`)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
                  style={{ opacity: seriesVisibility[`${fundPrefix}_value`] ? 1 : 0.5 }}
                >
                  <div
                    className="w-3 h-0.5 rounded"
                    style={{ backgroundColor: fundColor }}
                  />
                  <span>{`${fundCode} 当前价值`}</span>
                </button>

                <button
                  onClick={() => onToggleSeries(`${fundPrefix}_investment`)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
                  style={{ opacity: seriesVisibility[`${fundPrefix}_investment`] ? 1 : 0.5 }}
                >
                  <div
                    className="w-3 h-0.5 rounded"
                    style={{ backgroundColor: fundColor, borderStyle: 'dashed' }}
                  />
                  <span>{`${fundCode} 累计投入`}</span>
                </button>
              </div>
            ) : (
              <button
                key={fundIndex}
                onClick={() => onToggleSeries(`${fundPrefix}_return`)}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70 mr-3"
                style={{ opacity: seriesVisibility[`${fundPrefix}_return`] ? 1 : 0.5 }}
              >
                <div
                  className="w-3 h-0.5 rounded"
                  style={{ backgroundColor: fundColor }}
                />
                <span>{`${fundCode} 收益率`}</span>
              </button>
            );
          } else if (mode === 'multi-lumpsum') {
            return chartView === 'cost' ? (
              <button
                key={fundIndex}
                onClick={() => onToggleSeries(`${fundPrefix}_lumpSum`)}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70 mr-3"
                style={{ opacity: seriesVisibility[`${fundPrefix}_lumpSum`] ? 1 : 0.5 }}
              >
                <div
                  className="w-3 h-0.5 rounded"
                  style={{ backgroundColor: fundColor }}
                />
                <span>{`${fundCode} 一次性`}</span>
              </button>
            ) : (
              <button
                key={fundIndex}
                onClick={() => onToggleSeries(`${fundPrefix}_lumpSumReturn`)}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70 mr-3"
                style={{ opacity: seriesVisibility[`${fundPrefix}_lumpSumReturn`] ? 1 : 0.5 }}
              >
                <div
                  className="w-3 h-0.5 rounded"
                  style={{ backgroundColor: fundColor }}
                />
                <span>{`${fundCode} 收益率`}</span>
              </button>
            );
          }
          return null;
        })
      )}

      {/* 为多基金定投模式添加共用的累计投入线图例 */}
      {mode === 'multi-dca' && chartView === 'cost' && (
        <div className="border-l border-[#2a2a2a] pl-3 ml-2">
          <button
            onClick={() => onToggleSeries('shared_investment')}
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1f1f1f] text-xs font-medium text-[#d0d0d0] shadow-sm hover:bg-[#2a2a2a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9eff]/70"
            style={{ opacity: seriesVisibility.shared_investment ? 1 : 0.5 }}
          >
            <div
              className="w-3 h-0.5 rounded"
              style={{ backgroundColor: seriesConfig.shared_investment.color, borderStyle: 'dashed' }}
            />
            <span>{seriesConfig.shared_investment.name}</span>
          </button>
        </div>
      )}
    </div>
  );
}