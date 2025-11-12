'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  LineStyle,
  CrosshairMode,
  ISeriesApi,
  BaselineSeries,
  LineSeries,
  LineSeriesOptions,
  BaselineSeriesOptions
} from 'lightweight-charts';

interface ChartDataPoint {
  date: string;
  totalInvestment: number;
  currentValue: number;
  annualizedReturnRate: number;
}

interface InvestmentChartProps {
  data: ChartDataPoint[];
  chartView: 'cost' | 'return';
  isMobile: boolean;
  onZoomChange?: (startIndex: number, endIndex: number) => void;
  brushStartIndex?: number;
  brushEndIndex?: number;
}

export default function InvestmentChart({
  data,
  chartView,
  isMobile,
  onZoomChange,
  brushStartIndex = 0,
  brushEndIndex = 0,
}: InvestmentChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);

  // 转换数据为 lightweight-charts 格式
  const convertData = useCallback(() => {
    if (!data || data.length === 0) return { costData: [], valueData: [], returnData: [] };

    const costData = data.map(item => ({
      time: item.date as any,
      value: item.totalInvestment,
    }));

    const valueData = data.map(item => ({
      time: item.date as any,
      value: item.currentValue,
    }));

    const returnData = data.map(item => ({
      time: item.date as any,
      value: item.annualizedReturnRate,
    }));

    return { costData, valueData, returnData };
  }, [data]);

  // 创建浮动工具提示
  const createTooltip = useCallback(() => {
    if (!chartContainerRef.current || tooltipRef.current) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'lightweight-charts-tooltip';
    Object.assign(tooltip.style, {
      position: 'absolute',
      display: 'none',
      padding: '8px 12px',
      fontSize: isMobile ? '11px' : '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: 'rgba(10, 10, 10, 0.95)',
      color: '#e0e0e0',
      border: '1px solid #4a9eff',
      borderRadius: '6px',
      pointerEvents: 'none',
      zIndex: '1000',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(4px)',
      maxWidth: '200px',
    });

    chartContainerRef.current.appendChild(tooltip);
    tooltipRef.current = tooltip;
  }, [isMobile]);

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表实例
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: '#e0e0e0',
        fontSize: isMobile ? 10 : 12,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      grid: {
        vertLines: {
          color: 'rgba(51, 51, 51, 0.2)',
          style: LineStyle.Solid,
        },
        horzLines: {
          color: 'rgba(51, 51, 51, 0.2)',
          style: LineStyle.Solid,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#4a9eff',
          labelBackgroundColor: '#4a9eff',
          width: 1,
        },
        horzLine: {
          color: '#4a9eff',
          labelBackgroundColor: '#4a9eff',
          width: 1,
        },
      },
      rightPriceScale: {
        visible: true,
        borderColor: 'rgba(51, 51, 51, 0.3)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        ticksVisible: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: 'rgba(51, 51, 51, 0.3)',
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time: any) => {
          try {
            const date = new Date(time);
            if (isMobile) {
              return `${date.getMonth() + 1}/${date.getDate()}`;
            } else {
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - date.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays < 30) {
                return `${date.getMonth() + 1}/${date.getDate()}`;
              } else if (diffDays < 365) {
                return `${date.getMonth() + 1}月`;
              } else {
                return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
              }
            }
          } catch (error) {
            return time;
          }
        },
      },
      handleScroll: {
        vertTouchDrag: false,
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;
    setIsChartReady(true);
    createTooltip();

    // 清理函数
    return () => {
      if (tooltipRef.current && chartContainerRef.current) {
        chartContainerRef.current.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      setIsChartReady(false);
    };
  }, [isMobile, createTooltip]);

  // 设置工具提示事件
  const setupTooltip = useCallback(() => {
    if (!chartRef.current || !tooltipRef.current || !data || data.length === 0) return;

    const chart = chartRef.current;
    const tooltip = tooltipRef.current;

    // 订阅十字线移动事件
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.point || !param.time) {
        tooltip.style.display = 'none';
        return;
      }

      // 获取数据点
      const dataIndex = data.findIndex(item => item.date === param.time);
      if (dataIndex === -1) {
        tooltip.style.display = 'none';
        return;
      }

      const item = data[dataIndex];
      let tooltipContent = '';

      if (chartView === 'cost') {
        // 成本视图显示两条线的数据
        const currentReturnRate = ((item.currentValue - item.totalInvestment) / item.totalInvestment) * 100;
        tooltipContent = `
          <div style="margin-bottom: 4px; color: #00CED1; font-weight: 600;">
            累计投入: ¥${item.totalInvestment.toFixed(2)}
          </div>
          <div style="margin-bottom: 4px; color: #FFD700; font-weight: 600;">
            当前价值: ¥${item.currentValue.toFixed(2)}
          </div>
          <div style="color: #4ECDC4; font-size: 11px;">
            收益率: ${currentReturnRate.toFixed(2)}%
          </div>
        `;
      } else {
        // 收益率视图显示单条线数据
        tooltipContent = `
          <div style="margin-bottom: 4px; color: #4ECDC4; font-weight: 600;">
            年化收益率: ${item.annualizedReturnRate.toFixed(2)}%
          </div>
        `;
      }

      tooltip.innerHTML = `
        <div style="margin-bottom: 6px; color: #4a9eff; font-weight: 600; border-bottom: 1px solid #333; padding-bottom: 4px;">
          ${item.date}
        </div>
        ${tooltipContent}
      `;

      // 计算工具提示位置
      const containerRect = chartContainerRef.current!.getBoundingClientRect();
      const chartWidth = containerRect.width;
      const chartHeight = containerRect.height;

      let left = param.point.x - 215; // 从左侧显示（因为Y轴在右边）
      let top = param.point.y - 40;

      // 防止工具提示超出图表边界
      const tooltipRect = tooltip.getBoundingClientRect();
      if (left < 0) {
        left = param.point.x + 15; // 如果太靠左，就显示在右边
      }
      if (top < 0) {
        top = param.point.y + 15;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.display = 'block';
    });
  }, [data, chartView]);

  // 更新系列数据
  useEffect(() => {
    if (!chartRef.current || !isChartReady) return;

    const chart = chartRef.current;
    const { costData, valueData, returnData } = convertData();

    // 清除现有系列
    seriesRef.current.forEach(series => {
      chart.removeSeries(series);
    });
    seriesRef.current = [];

    if (chartView === 'cost') {
      // 成本视图 - 使用两条普通线型图对比
      const costSeries = chart.addSeries(LineSeries, {
        color: '#00CED1',
        lineWidth: 2,
        title: '累计投入金额',
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: '#00CED1',
        crosshairMarkerBorderColor: '#ffffff',
        crosshairMarkerBorderWidth: 2,
      } as LineSeriesOptions);
      costSeries.setData(costData);
      seriesRef.current.push(costSeries);

      const valueSeries = chart.addSeries(LineSeries, {
        color: '#FFD700',
        lineWidth: 2,
        title: '当前份额价值',
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: '#FFD700',
        crosshairMarkerBorderColor: '#ffffff',
        crosshairMarkerBorderWidth: 2,
      } as LineSeriesOptions);
      valueSeries.setData(valueData);
      seriesRef.current.push(valueSeries);
    } else {
      // 收益率视图 - 使用BaselineSeries，以0为基线
      const returnSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: 0 },
        topLineColor: '#4ECDC4',
        topFillColor1: 'rgba(78, 205, 196, 0.3)',
        topFillColor2: 'rgba(78, 205, 196, 0.05)',
        bottomLineColor: '#FF6B6B',
        bottomFillColor1: 'rgba(255, 107, 107, 0.3)',
        bottomFillColor2: 'rgba(255, 107, 107, 0.05)',
        lineWidth: 2,
        title: '年化收益率',
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: '#4ECDC4',
        crosshairMarkerBorderColor: '#ffffff',
        crosshairMarkerBorderWidth: 2,
      } as any);
      returnSeries.setData(returnData);
      seriesRef.current.push(returnSeries);
    }

    // 设置工具提示
    setupTooltip();

    // 设置可见范围
    if (brushStartIndex >= 0 && brushEndIndex > 0) {
      const visibleData = data.slice(brushStartIndex, brushEndIndex + 1);
      if (visibleData.length > 0) {
        chart.timeScale().setVisibleRange({
          from: visibleData[0].date as any,
          to: visibleData[visibleData.length - 1].date as any,
        });
      }
    }

    // 订阅可见范围变化事件
    const handleVisibleTimeRangeChange = () => {
      if (!onZoomChange) return;

      const visibleRange = chart.timeScale().getVisibleRange();
      if (visibleRange) {
        const startIndex = data.findIndex(item => item.date === visibleRange.from);
        const endIndex = data.findIndex(item => item.date === visibleRange.to);

        if (startIndex !== -1 && endIndex !== -1) {
          onZoomChange(Math.max(0, startIndex), Math.min(data.length - 1, endIndex));
        }
      }
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    };
  }, [chartView, isChartReady, convertData, data, onZoomChange, brushStartIndex, brushEndIndex, setupTooltip]);

  // 处理窗口大小变化
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <div
        ref={chartContainerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {!isChartReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#151515] rounded-xl">
          <div className="text-center text-[#666]">
            <div className="text-lg mb-2">📊</div>
            <div className="text-sm">正在加载图表...</div>
          </div>
        </div>
      )}
    </div>
  );
}