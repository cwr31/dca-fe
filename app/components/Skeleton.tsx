import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-[#2a2a2a] rounded ${className}`} />
  );
}

// 卡片骨架屏
export function StatsCardSkeleton() {
  return (
    <div className="bg-[#1c1c1c]/90 rounded-lg border border-[#2a2a2a] p-4">
      <div className="flex items-start gap-3">
        {/* 图标骨架 */}
        <Skeleton className="w-8 h-8 rounded-full" />

        <div className="flex-1">
          {/* 标题骨架 */}
          <Skeleton className="w-20 h-3 mb-2" />
          {/* 数值骨架 */}
          <Skeleton className="w-32 h-6 mb-2" />
          {/* 副标题骨架 */}
          <Skeleton className="w-40 h-3" />
        </div>
      </div>
    </div>
  );
}

// 表格骨架屏
export function TableSkeleton() {
  return (
    <div className="w-full h-full flex flex-col">
      {/* 表头 */}
      <div className="px-3 px-4 py-2 border-b border-[#2a2a2a]">
        <Skeleton className="w-24 h-4" />
      </div>

      {/* 表格行 */}
      <div className="flex-1 p-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-16 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 图表骨架屏
export function ChartSkeleton() {
  return (
    <div className="w-full h-full p-4">
      {/* 图表区域 */}
      <div className="h-72 bg-[#151515] rounded-lg border border-[#2a2a2a] relative overflow-hidden">
        {/* 网格线效果 */}
        <div className="absolute inset-0">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-[#2a2a2a]"
              style={{ top: `${20 + i * 15}%` }}
            />
          ))}
        </div>
        {/* 主数据线条 */}
        <Skeleton className="absolute bottom-0 left-0 right-0 h-32 rounded-t-lg" />
      </div>
    </div>
  );
}

// 空状态骨架屏组件
interface StatsSkeletonProps {
  count?: number;
}

export function StatsSkeleton({ count = 4 }: StatsSkeletonProps) {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {[...Array(count)].map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
