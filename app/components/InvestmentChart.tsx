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
  cumulativePrice?: number; // 累计净值，用于一次性投入计算（包含分红）
}

interface InvestmentChartProps {
  data: ChartDataPoint[];
  chartView: 'cost' | 'return';
  isMobile: boolean;
  mode?: 'single' | 'multi-dca' | 'multi-lumpsum';
  funds?: Array<{ id: string; code: string; name?: string }>;
  onZoomChange?: (startIndex: number, endIndex: number) => void;
  brushStartIndex?: number;
  brushEndIndex?: number;
  onToggleSeries?: (key: string) => void;
  externalSeriesVisibility?: any;
}

export default function InvestmentChart({
  data,
  chartView,
  isMobile,
  mode = 'single',
  funds = [],
  onZoomChange,
  brushStartIndex = 0,
  brushEndIndex = 0,
  onToggleSeries,
  externalSeriesVisibility,
}: InvestmentChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const selectionStateRef = useRef({ active: false, startX: 0, currentX: 0 });
  const [isChartReady, setIsChartReady] = useState(false);
  const [internalSeriesVisibility, setInternalSeriesVisibility] = useState(() => {
    if (mode === 'single') {
      return {
        cost: true,
        value: true,
        lumpSum: true,
        return: true,
        lumpSumReturn: true,
      };
    } else {
      // 多基金模式的初始状态
      const visibility: any = {};
      funds.forEach((fund, index) => {
        if (mode === 'multi-dca') {
          visibility[`fund${index + 1}_value`] = true;
          visibility[`fund${index + 1}_investment`] = true;
          visibility[`fund${index + 1}_return`] = true;
        } else if (mode === 'multi-lumpsum') {
          visibility[`fund${index + 1}_lumpSum`] = true;
          visibility[`fund${index + 1}_lumpSumReturn`] = true;
        }
      });
      return visibility;
    }
  });
  const [selectionOverlay, setSelectionOverlay] = useState({
    visible: false,
    left: 0,
    width: 0,
  });

  const seriesVisibility = externalSeriesVisibility ?? internalSeriesVisibility;
  const chartMinHeight = isMobile ? '300px' : '420px';
  const chartMaxHeight = isMobile ? '50vh' : '420px';

  // 系列配置
  const seriesConfig = {
    // 单基金模式配置
    cost: { name: '累计投入', color: '#00CED1' },
    value: { name: '当前价值', color: '#FFD700' },
    lumpSum: { name: '一次性投入', color: '#FF6BFF' },
    return: { name: '定投年化收益率', color: '#4ECDC4' },
    lumpSumReturn: { name: '一次性投入年化收益率', color: '#FF6BFF' },
  };

  // 获取多基金颜色配置
  const getFundColor = (index: number) => {
    const colors = ['#00CED1', '#FFD700', '#FF6BFF', '#4ECDC4', '#FF8C00', '#32CD32'];
    return colors[index % colors.length];
  };

  // 获取多基金系列配置
  const getMultiFundSeriesConfig = (fundIndex: number, type: string) => {
    const baseColor = getFundColor(fundIndex);
    const fundCode = funds[fundIndex]?.code || `基金${fundIndex + 1}`;

    switch (type) {
      case 'value':
        return { name: `${fundCode} 当前价值`, color: baseColor };
      case 'investment':
        return { name: `${fundCode} 累计投入`, color: baseColor, lineStyle: 'dashed' };
      case 'return':
        return { name: `${fundCode} 年化收益率`, color: baseColor };
      case 'lumpSum':
        return { name: `${fundCode} 一次性投入`, color: baseColor };
      case 'lumpSumReturn':
        return { name: `${fundCode} 一次性收益率`, color: baseColor };
      default:
        return { name: fundCode, color: baseColor };
    }
  };

  // 切换系列可见性
  const toggleSeriesVisibility = (seriesKey: keyof typeof internalSeriesVisibility) => {
    if (onToggleSeries) {
      onToggleSeries(seriesKey);
    } else {
      setInternalSeriesVisibility(prev => ({
        ...prev,
        [seriesKey]: !prev[seriesKey]
      }));
    }
  };

  const applySelectionRange = useCallback((startCoord: number, endCoord: number) => {
    if (!chartRef.current || !data || data.length === 0) return;

    const minX = Math.min(startCoord, endCoord);
    const maxX = Math.max(startCoord, endCoord);

    if (Math.abs(maxX - minX) < 10) return;

    const chart = chartRef.current;
    const timeScale = chart.timeScale();
    const fromTime = timeScale.coordinateToTime(minX);
    const toTime = timeScale.coordinateToTime(maxX);

    if (!fromTime || !toTime) return;

    const convertToDate = (time: any) => {
      if (!time) return null;
      if (time instanceof Date) return time;
      if (typeof time === 'string') return new Date(time);
      if (typeof time === 'number') {
        return new Date(time * 1000);
      }
      if (typeof time === 'object' && 'year' in time && 'month' in time && 'day' in time) {
        return new Date(time.year as number, (time.month as number) - 1, time.day as number);
      }
      return null;
    };

    const startDate = convertToDate(fromTime);
    const endDate = convertToDate(toTime);

    if (!startDate || !endDate || endDate <= startDate) return;

    const startIndex = data.findIndex(item => new Date(item.date) >= startDate);
    if (startIndex === -1) return;

    let endIndex = data.length - 1;
    for (let i = data.length - 1; i >= startIndex; i--) {
      if (new Date(data[i].date) <= endDate) {
        endIndex = i;
        break;
      }
    }

    if (endIndex <= startIndex) return;

    try {
      chart.timeScale().setVisibleRange({
        from: data[startIndex].date as any,
        to: data[endIndex].date as any,
      });
      if (onZoomChange) {
        onZoomChange(startIndex, endIndex);
      }
    } catch (error) {
      console.warn('应用选择范围失败:', error);
    }
  }, [data, onZoomChange]);

  // 处理缩放操作
  const handleZoom = useCallback((action: 'in' | 'out' | 'reset') => {
    if (!chartRef.current || !data || data.length === 0) return;

    const chart = chartRef.current;
    const visibleRange = chart.timeScale().getVisibleRange();

    if (!visibleRange) return;

    const startIndex = data.findIndex(item => item.date === visibleRange.from);
    const endIndex = data.findIndex(item => item.date === visibleRange.to);

    if (startIndex === -1 || endIndex === -1) return;

    const currentRange = endIndex - startIndex;
    const centerIndex = Math.floor((startIndex + endIndex) / 2);

    let newStartIndex: number;
    let newEndIndex: number;

    switch (action) {
      case 'in':
        // 放大：缩小显示范围
        const zoomInFactor = 0.8; // 每次缩小到80%
        const newRangeIn = Math.max(Math.floor(currentRange * zoomInFactor), 10); // 最小显示10个点
        newStartIndex = Math.max(0, centerIndex - Math.floor(newRangeIn / 2));
        newEndIndex = Math.min(data.length - 1, centerIndex + Math.floor(newRangeIn / 2));
        break;

      case 'out':
        // 缩小：扩大显示范围
        const zoomOutFactor = 1.25; // 每次扩大到125%
        const newRangeOut = Math.min(Math.floor(currentRange * zoomOutFactor), data.length - 1);
        newStartIndex = Math.max(0, centerIndex - Math.floor(newRangeOut / 2));
        newEndIndex = Math.min(data.length - 1, centerIndex + Math.floor(newRangeOut / 2));
        break;

      case 'reset':
        // 重置：显示全部数据
        newStartIndex = 0;
        newEndIndex = data.length - 1;
        break;

      default:
        return;
    }

    // 设置新的可见范围
    const newVisibleData = data.slice(newStartIndex, newEndIndex + 1);
    if (newVisibleData.length > 0 && onZoomChange) {
      onZoomChange(newStartIndex, newEndIndex);
      try {
        chart.timeScale().setVisibleRange({
          from: newVisibleData[0].date as any,
          to: newVisibleData[newVisibleData.length - 1].date as any,
        });
      } catch (error) {
        console.warn('缩放操作失败:', error);
      }
    }
  }, [data, onZoomChange]);

  // 转换数据为 lightweight-charts 格式
  const convertData = useCallback(() => {
    if (!data || data.length === 0) return { seriesData: {} };

    const seriesData: any = {};

    if (mode === 'single') {
      // 单基金模式的原有逻辑
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

      // 计算一次性投入的年化收益率数据
      const lumpSumReturnData = data.map((item, index) => {
        if (index === 0) {
          return { time: item.date as any, value: 0 };
        } else {
          const initialCumulativePrice = data[0].cumulativePrice || data[0].currentValue;
          const currentCumulativePrice = item.cumulativePrice || item.currentValue;
          const totalReturnRate = initialCumulativePrice > 0 ?
            ((currentCumulativePrice - initialCumulativePrice) / initialCumulativePrice) * 100 : 0;

          const totalDays = Math.floor((new Date(item.date).getTime() - new Date(data[0].date).getTime()) / (1000 * 60 * 60 * 24));
          const years = totalDays > 0 ? totalDays / 365.25 : 0;
          const annualizedReturn = years > 0 ? (Math.pow(1 + totalReturnRate / 100, 1 / years) - 1) * 100 : 0;

          return { time: item.date as any, value: Number(annualizedReturn.toFixed(2)) };
        }
      });

      // 计算一次性投入的数据
      const totalPeriods = data.length;
      const lumpSumInitialInvestment = data[data.length - 1]?.totalInvestment || data[0]?.totalInvestment || 0;

      const lumpSumData = data.map((item, index) => {
        if (index === 0) {
          return { time: item.date as any, value: lumpSumInitialInvestment };
        } else {
          const initialCumulativePrice = data[0].cumulativePrice || data[0].currentValue;
          const currentCumulativePrice = item.cumulativePrice || item.currentValue;
          const priceRatio = initialCumulativePrice > 0 ? (currentCumulativePrice / initialCumulativePrice) : 1;
          const lumpSumValue = lumpSumInitialInvestment * priceRatio;

          return { time: item.date as any, value: lumpSumValue };
        }
      });

      seriesData.cost = costData;
      seriesData.value = valueData;
      seriesData.return = returnData;
      seriesData.lumpSum = lumpSumData;
      seriesData.lumpSumReturn = lumpSumReturnData;
    } else {
      // 多基金模式
      funds.forEach((fund, fundIndex) => {
        const fundPrefix = `fund${fundIndex + 1}`;

        if (mode === 'multi-dca') {
          // 多基金定投模式
          seriesData[`${fundPrefix}_currentValue`] = data.map(item => ({
            time: item.date as any,
            value: item[`${fundPrefix}_currentValue`] || 0,
          }));

          seriesData[`${fundPrefix}_totalInvestment`] = data.map(item => ({
            time: item.date as any,
            value: item[`${fundPrefix}_totalInvestment`] || 0,
          }));

          seriesData[`${fundPrefix}_return`] = data.map(item => ({
            time: item.date as any,
            value: item[`${fundPrefix}_return`] || 0,
          }));
        } else if (mode === 'multi-lumpsum') {
          // 多基金一次性投入模式
          seriesData[`${fundPrefix}_lumpSum`] = data.map(item => ({
            time: item.date as any,
            value: item[`${fundPrefix}_lumpSum`] || 0,
          }));

          seriesData[`${fundPrefix}_lumpSumReturn`] = data.map(item => ({
            time: item.date as any,
            value: item[`${fundPrefix}_lumpSumReturn`] || 0,
          }));
        }
      });
    }

    return { seriesData };
  }, [data, mode, funds]);

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
        attributionLogo: false, // 去除TradingView水印
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
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${year}-${month}`;
          } catch (error) {
            return time;
          }
        },
      },
      handleScroll: false,
      handleScale: false,
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

      if (mode === 'single') {
        // 单基金模式的工具提示
        if (chartView === 'cost') {
          const currentReturnRate = ((item.currentValue - item.totalInvestment) / item.totalInvestment) * 100;
          const lumpSumInitial = data[data.length - 1]?.totalInvestment || data[0]?.totalInvestment || 0;
          const initialCumulativePrice = data[0].cumulativePrice || data[0].currentValue;
          const currentCumulativePrice = item.cumulativePrice || item.currentValue;
          const priceRatio = initialCumulativePrice > 0 ? (currentCumulativePrice / initialCumulativePrice) : 1;
          const lumpSumCurrent = lumpSumInitial * priceRatio;
          const lumpSumReturnRate = ((lumpSumCurrent - lumpSumInitial) / lumpSumInitial) * 100;

          tooltipContent = `
            <div style="margin-bottom: 4px; color: #00CED1; font-weight: 600;">
              累计投入: ¥${item.totalInvestment.toFixed(2)}
            </div>
            <div style="margin-bottom: 4px; color: #FFD700; font-weight: 600;">
              当前价值: ¥${item.currentValue.toFixed(2)}
            </div>
            <div style="margin-bottom: 4px; color: #FF6BFF; font-weight: 600;">
              一次性投入: ¥${lumpSumCurrent.toFixed(2)}
            </div>
            <div style="color: #4ECDC4; font-size: 11px;">
              定投收益率: ${currentReturnRate.toFixed(2)}% | 一次性收益率: ${lumpSumReturnRate.toFixed(2)}%
            </div>
          `;
        } else {
          const currentReturnRate = item.annualizedReturnRate;
          const lumpSumInitial = data[data.length - 1]?.totalInvestment || data[0]?.totalInvestment || 0;
          const initialCumulativePrice = data[0].cumulativePrice || data[0].currentValue;
          const currentCumulativePrice = item.cumulativePrice || item.currentValue;
          const priceRatio = initialCumulativePrice > 0 ? (currentCumulativePrice / initialCumulativePrice) : 1;
          const lumpSumCurrent = lumpSumInitial * priceRatio;
          const totalDays = Math.floor((new Date(item.date).getTime() - new Date(data[0].date).getTime()) / (1000 * 60 * 60 * 24));
          const years = totalDays > 0 ? totalDays / 365.25 : 0;
          const totalReturnRate = ((lumpSumCurrent - lumpSumInitial) / lumpSumInitial) * 100;
          const lumpSumAnnualizedReturn = years > 0 ? (Math.pow(1 + totalReturnRate / 100, 1 / years) - 1) * 100 : 0;

          tooltipContent = `
            <div style="margin-bottom: 4px; color: #4ECDC4; font-weight: 600;">
              定投年化收益率: ${currentReturnRate.toFixed(2)}%
            </div>
            <div style="margin-bottom: 4px; color: #FF6BFF; font-weight: 600;">
              一次性投入年化收益率: ${lumpSumAnnualizedReturn.toFixed(2)}%
            </div>
          `;
        }
      } else {
        // 多基金模式的工具提示
        funds.forEach((fund, fundIndex) => {
          const fundPrefix = `fund${fundIndex + 1}`;
          const fundColor = getFundColor(fundIndex);
          const fundCode = fund.code || `基金${fundIndex + 1}`;

          if (mode === 'multi-dca') {
            if (chartView === 'cost') {
              const currentValue = item[`${fundPrefix}_currentValue`] || 0;
              const totalInvestment = item[`${fundPrefix}_totalInvestment`] || 0;
              const returnRate = totalInvestment > 0 ? ((currentValue - totalInvestment) / totalInvestment) * 100 : 0;

              tooltipContent += `
                <div style="margin-bottom: 4px; color: ${fundColor}; font-weight: 600;">
                  ${fundCode}: ¥${currentValue.toFixed(2)} (${returnRate.toFixed(2)}%)
                </div>
              `;
            } else {
              const returnRate = item[`${fundPrefix}_return`] || 0;
              tooltipContent += `
                <div style="margin-bottom: 4px; color: ${fundColor}; font-weight: 600;">
                  ${fundCode} 年化收益率: ${returnRate.toFixed(2)}%
                </div>
              `;
            }
          } else if (mode === 'multi-lumpsum') {
            if (chartView === 'cost') {
              const lumpSumValue = item[`${fundPrefix}_lumpSum`] || 0;
              tooltipContent += `
                <div style="margin-bottom: 4px; color: ${fundColor}; font-weight: 600;">
                  ${fundCode} 一次性投入: ¥${lumpSumValue.toFixed(2)}
                </div>
              `;
            } else {
              const lumpSumReturn = item[`${fundPrefix}_lumpSumReturn`] || 0;
              tooltipContent += `
                <div style="margin-bottom: 4px; color: ${fundColor}; font-weight: 600;">
                  ${fundCode} 一次性收益率: ${lumpSumReturn.toFixed(2)}%
                </div>
              `;
            }
          }
        });
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

      let left = param.point.x - 215;
      let top = param.point.y - 40;

      // 防止工具提示超出图表边界
      const tooltipRect = tooltip.getBoundingClientRect();
      if (left < 0) {
        left = param.point.x + 15;
      }
      if (top < 0) {
        top = param.point.y + 15;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.display = 'block';
    });
  }, [data, chartView, mode, funds]);

  // 更新系列数据
  useEffect(() => {
    if (!chartRef.current || !isChartReady) return;

    const chart = chartRef.current;
    const { seriesData } = convertData();

    // 清除现有系列
    seriesRef.current.forEach(series => {
      chart.removeSeries(series);
    });
    seriesRef.current = [];

    if (mode === 'single') {
      // 单基金模式的原有逻辑
      if (chartView === 'cost') {
        // 成本视图 - 添加三条曲线对比
        if (seriesVisibility.cost) {
          const costSeries = chart.addSeries(LineSeries, {
            color: seriesConfig.cost.color,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: seriesConfig.cost.color,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBorderWidth: 2,
            priceLineVisible: false,
          } as LineSeriesOptions);
          costSeries.setData(seriesData.cost || []);
          seriesRef.current.push(costSeries);
        }

        if (seriesVisibility.value) {
          const valueSeries = chart.addSeries(LineSeries, {
            color: seriesConfig.value.color,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: seriesConfig.value.color,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBorderWidth: 2,
            priceLineVisible: false,
          } as LineSeriesOptions);
          valueSeries.setData(seriesData.value || []);
          seriesRef.current.push(valueSeries);
        }

        if (seriesVisibility.lumpSum) {
          const lumpSumSeries = chart.addSeries(LineSeries, {
            color: seriesConfig.lumpSum.color,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: seriesConfig.lumpSum.color,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBorderWidth: 2,
            priceLineVisible: false,
          } as LineSeriesOptions);
          lumpSumSeries.setData(seriesData.lumpSum || []);
          seriesRef.current.push(lumpSumSeries);
        }
      } else {
        // 收益率视图 - 添加定投和一次性投入的收益率曲线对比
        if (seriesVisibility.return) {
          const returnSeries = chart.addSeries(BaselineSeries, {
            baseValue: { type: 'price', price: 0 },
            topLineColor: seriesConfig.return.color,
            topFillColor1: 'rgba(78, 205, 196, 0.3)',
            topFillColor2: 'rgba(78, 205, 196, 0.05)',
            bottomLineColor: '#FF6B6B',
            bottomFillColor1: 'rgba(255, 107, 107, 0.3)',
            bottomFillColor2: 'rgba(255, 107, 107, 0.05)',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: seriesConfig.return.color,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBorderWidth: 2,
            priceLineVisible: false,
          } as any);
          returnSeries.setData(seriesData.return || []);
          seriesRef.current.push(returnSeries);
        }

        if (seriesVisibility.lumpSumReturn) {
          const lumpSumReturnSeries = chart.addSeries(LineSeries, {
            color: seriesConfig.lumpSumReturn.color,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: seriesConfig.lumpSumReturn.color,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBorderWidth: 2,
            priceLineVisible: false,
          } as LineSeriesOptions);
          lumpSumReturnSeries.setData(seriesData.lumpSumReturn || []);
          seriesRef.current.push(lumpSumReturnSeries);
        }
      }
    } else {
      // 多基金模式
      funds.forEach((fund, fundIndex) => {
        const fundPrefix = `fund${fundIndex + 1}`;

        if (mode === 'multi-dca') {
          // 多基金定投模式
          if (chartView === 'cost') {
            // 成本视图：显示当前价值和累计投入
            const valueConfig = getMultiFundSeriesConfig(fundIndex, 'value');
            if (seriesVisibility[`${fundPrefix}_value`]) {
              const valueSeries = chart.addSeries(LineSeries, {
                color: valueConfig.color,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBackgroundColor: valueConfig.color,
                crosshairMarkerBorderColor: '#ffffff',
                crosshairMarkerBorderWidth: 2,
                priceLineVisible: false,
              } as LineSeriesOptions);
              valueSeries.setData(seriesData[`${fundPrefix}_currentValue`] || []);
              seriesRef.current.push(valueSeries);
            }

            const investmentConfig = getMultiFundSeriesConfig(fundIndex, 'investment');
            if (seriesVisibility[`${fundPrefix}_investment`]) {
              const investmentSeries = chart.addSeries(LineSeries, {
                color: investmentConfig.color,
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBackgroundColor: investmentConfig.color,
                crosshairMarkerBorderColor: '#ffffff',
                crosshairMarkerBorderWidth: 2,
                priceLineVisible: false,
              } as LineSeriesOptions);
              investmentSeries.setData(seriesData[`${fundPrefix}_totalInvestment`] || []);
              seriesRef.current.push(investmentSeries);
            }
          } else {
            // 收益率视图
            const returnConfig = getMultiFundSeriesConfig(fundIndex, 'return');
            if (seriesVisibility[`${fundPrefix}_return`]) {
              const returnSeries = chart.addSeries(BaselineSeries, {
                baseValue: { type: 'price', price: 0 },
                topLineColor: returnConfig.color,
                topFillColor1: `${returnConfig.color}33`,
                topFillColor2: `${returnConfig.color}0D`,
                bottomLineColor: '#FF6B6B',
                bottomFillColor1: 'rgba(255, 107, 107, 0.3)',
                bottomFillColor2: 'rgba(255, 107, 107, 0.05)',
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBackgroundColor: returnConfig.color,
                crosshairMarkerBorderColor: '#ffffff',
                crosshairMarkerBorderWidth: 2,
                priceLineVisible: false,
              } as any);
              returnSeries.setData(seriesData[`${fundPrefix}_return`] || []);
              seriesRef.current.push(returnSeries);
            }
          }
        } else if (mode === 'multi-lumpsum') {
          // 多基金一次性投入模式
          if (chartView === 'cost') {
            const lumpSumConfig = getMultiFundSeriesConfig(fundIndex, 'lumpSum');
            if (seriesVisibility[`${fundPrefix}_lumpSum`]) {
              const lumpSumSeries = chart.addSeries(LineSeries, {
                color: lumpSumConfig.color,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBackgroundColor: lumpSumConfig.color,
                crosshairMarkerBorderColor: '#ffffff',
                crosshairMarkerBorderWidth: 2,
                priceLineVisible: false,
              } as LineSeriesOptions);
              lumpSumSeries.setData(seriesData[`${fundPrefix}_lumpSum`] || []);
              seriesRef.current.push(lumpSumSeries);
            }
          } else {
            const lumpSumReturnConfig = getMultiFundSeriesConfig(fundIndex, 'lumpSumReturn');
            if (seriesVisibility[`${fundPrefix}_lumpSumReturn`]) {
              const lumpSumReturnSeries = chart.addSeries(BaselineSeries, {
                baseValue: { type: 'price', price: 0 },
                topLineColor: lumpSumReturnConfig.color,
                topFillColor1: `${lumpSumReturnConfig.color}33`,
                topFillColor2: `${lumpSumReturnConfig.color}0D`,
                bottomLineColor: '#FF6B6B',
                bottomFillColor1: 'rgba(255, 107, 107, 0.3)',
                bottomFillColor2: 'rgba(255, 107, 107, 0.05)',
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBackgroundColor: lumpSumReturnConfig.color,
                crosshairMarkerBorderColor: '#ffffff',
                crosshairMarkerBorderWidth: 2,
                priceLineVisible: false,
              } as any);
              lumpSumReturnSeries.setData(seriesData[`${fundPrefix}_lumpSumReturn`] || []);
              seriesRef.current.push(lumpSumReturnSeries);
            }
          }
        }
      });
    }

    // 设置工具提示（只在有系列数据时设置）
    if (seriesRef.current.length > 0) {
      setupTooltip();
    }

    // 设置可见范围
    if (brushStartIndex >= 0 && brushEndIndex > 0 && seriesRef.current.length > 0) {
      const visibleData = data.slice(brushStartIndex, brushEndIndex + 1);
      if (visibleData.length > 0) {
        try {
          chart.timeScale().setVisibleRange({
            from: visibleData[0].date as any,
            to: visibleData[visibleData.length - 1].date as any,
          });
        } catch (error) {
          console.warn('设置可见范围失败:', error);
        }
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
  }, [chartView, isChartReady, convertData, data, onZoomChange, brushStartIndex, brushEndIndex, setupTooltip, seriesVisibility, mode, funds]);

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

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const getRelativeX = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      return Math.min(Math.max(relativeX, 0), rect.width);
    };

    const updateOverlay = () => {
      const { active, startX, currentX } = selectionStateRef.current;
      if (!active) {
        setSelectionOverlay(prev => (prev.visible ? { visible: false, left: 0, width: 0 } : prev));
        return;
      }

      setSelectionOverlay({
        visible: true,
        left: Math.min(startX, currentX),
        width: Math.abs(currentX - startX),
      });
    };

    const startSelection = (clientX: number) => {
      if (!chartRef.current) return;
      const coord = getRelativeX(clientX);
      selectionStateRef.current = {
        active: true,
        startX: coord,
        currentX: coord,
      };
      updateOverlay();
    };

    const moveSelection = (clientX: number) => {
      if (!selectionStateRef.current.active) return;
      const prev = selectionStateRef.current;
      selectionStateRef.current = {
        ...prev,
        currentX: getRelativeX(clientX),
      };
      updateOverlay();
    };

    const cancelSelection = () => {
      if (!selectionStateRef.current.active) return;
      selectionStateRef.current = { active: false, startX: 0, currentX: 0 };
      setSelectionOverlay(prev => (prev.visible ? { visible: false, left: 0, width: 0 } : prev));
    };

    const finishSelection = () => {
      if (!selectionStateRef.current.active) return;
      const { startX, currentX } = selectionStateRef.current;
      selectionStateRef.current = { active: false, startX: 0, currentX: 0 };
      setSelectionOverlay(prev => (prev.visible ? { visible: false, left: 0, width: 0 } : prev));
      applySelectionRange(startX, currentX);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startSelection(event.clientX);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!selectionStateRef.current.active) return;
      event.preventDefault();
      moveSelection(event.clientX);
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!selectionStateRef.current.active) return;
      event.preventDefault();
      finishSelection();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      event.preventDefault();
      startSelection(event.touches[0].clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!selectionStateRef.current.active || event.touches.length !== 1) return;
      event.preventDefault();
      moveSelection(event.touches[0].clientX);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!selectionStateRef.current.active) return;
      event.preventDefault();
      finishSelection();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      cancelSelection();
    };
  }, [applySelectionRange]);

  // 移动端滚动处理 - 防止图表拦截页面滚动
  useEffect(() => {
    if (!isMobile || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let startY = 0;
    let isScrolling = false;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isScrolling = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;

      // 如果垂直移动距离大于水平移动距离，认为是滚动操作
      if (Math.abs(deltaY) > 10 && !isScrolling) {
        isScrolling = true;
        // 允许页面滚动，不阻止默认行为
        return;
      }

      // 如果是图表内部的水平滑动（缩放/平移），则阻止默认行为
      if (!isScrolling && Math.abs(deltaY) < 10) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      isScrolling = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile]);

  return (
    <div
      className="w-full relative"
      style={{
        minHeight: chartMinHeight,
        maxHeight: chartMaxHeight,
        height: chartMaxHeight,
      }}
    >
      <div
        ref={chartContainerRef}
        className="w-full h-full"
        style={{
          minHeight: chartMinHeight,
          maxHeight: chartMaxHeight,
          height: '100%',
          touchAction: 'pan-y', // 允许垂直滚动
          WebkitOverflowScrolling: 'touch' // iOS平滑滚动
        }}
        onDoubleClick={() => {
          if (isChartReady) {
            handleZoom('reset');
          }
        }}
      />

      {selectionOverlay.visible && (
        <div
          className="absolute inset-y-0 z-10 pointer-events-none"
          style={{
            left: `${selectionOverlay.left}px`,
            width: `${selectionOverlay.width}px`,
            background: 'rgba(74, 158, 255, 0.15)',
            border: '1px solid rgba(74, 158, 255, 0.4)',
          }}
        />
      )}

      {/* 图例 - 简化版，仅在小屏幕上显示 */}
      {isChartReady && isMobile && (
        <div className="absolute bottom-2 left-2 bg-[rgba(26,26,26,0.9)] rounded p-1.5 z-10 backdrop-blur-sm border border-[#2a2a2a]"
          style={{
            fontSize: '10px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div className="space-y-2">
            {mode === 'single' ? (
              chartView === 'cost' ? (
                <>
                  <button
                    onClick={() => toggleSeriesVisibility('cost')}
                    className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                      seriesVisibility.cost ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div
                      className="w-3 h-0.5 rounded"
                      style={{ backgroundColor: seriesConfig.cost.color }}
                    />
                    <span className="text-gray-200">{seriesConfig.cost.name}</span>
                  </button>

                  <button
                    onClick={() => toggleSeriesVisibility('value')}
                    className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                      seriesVisibility.value ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div
                      className="w-3 h-0.5 rounded"
                      style={{ backgroundColor: seriesConfig.value.color }}
                    />
                    <span className="text-gray-200">{seriesConfig.value.name}</span>
                  </button>

                  <button
                    onClick={() => toggleSeriesVisibility('lumpSum')}
                    className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                      seriesVisibility.lumpSum ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div
                      className="w-3 h-0.5 rounded"
                      style={{ backgroundColor: seriesConfig.lumpSum.color }}
                    />
                    <span className="text-gray-200">{seriesConfig.lumpSum.name}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggleSeriesVisibility('return')}
                    className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                      seriesVisibility.return ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div
                      className="w-3 h-0.5 rounded"
                      style={{ backgroundColor: seriesConfig.return.color }}
                    />
                    <span className="text-gray-200">{seriesConfig.return.name}</span>
                  </button>

                  <button
                    onClick={() => toggleSeriesVisibility('lumpSumReturn')}
                    className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                      seriesVisibility.lumpSumReturn ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div
                      className="w-3 h-0.5 rounded"
                      style={{ backgroundColor: seriesConfig.lumpSumReturn.color }}
                    />
                    <span className="text-gray-200">{seriesConfig.lumpSumReturn.name}</span>
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
                    <div key={fundIndex} className="space-y-1">
                      <button
                        onClick={() => toggleSeriesVisibility(`${fundPrefix}_value` as any)}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                          seriesVisibility[`${fundPrefix}_value`] ? 'opacity-100' : 'opacity-50'
                        }`}
                      >
                        <div
                          className="w-3 h-0.5 rounded"
                          style={{ backgroundColor: fundColor }}
                        />
                        <span className="text-gray-200">{fundCode} 当前价值</span>
                      </button>

                      <button
                        onClick={() => toggleSeriesVisibility(`${fundPrefix}_investment` as any)}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                          seriesVisibility[`${fundPrefix}_investment`] ? 'opacity-100' : 'opacity-50'
                        }`}
                      >
                        <div
                          className="w-3 h-0.5 rounded"
                          style={{ backgroundColor: fundColor, borderStyle: 'dashed' }}
                        />
                        <span className="text-gray-200">{fundCode} 累计投入</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      key={fundIndex}
                      onClick={() => toggleSeriesVisibility(`${fundPrefix}_return` as any)}
                      className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                        seriesVisibility[`${fundPrefix}_return`] ? 'opacity-100' : 'opacity-50'
                      }`}
                    >
                      <div
                        className="w-3 h-0.5 rounded"
                        style={{ backgroundColor: fundColor }}
                      />
                      <span className="text-gray-200">{fundCode} 收益率</span>
                    </button>
                  );
                } else if (mode === 'multi-lumpsum') {
                  return chartView === 'cost' ? (
                    <button
                      key={fundIndex}
                      onClick={() => toggleSeriesVisibility(`${fundPrefix}_lumpSum` as any)}
                      className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                        seriesVisibility[`${fundPrefix}_lumpSum`] ? 'opacity-100' : 'opacity-50'
                      }`}
                    >
                      <div
                        className="w-3 h-0.5 rounded"
                        style={{ backgroundColor: fundColor }}
                      />
                      <span className="text-gray-200">{fundCode} 一次性</span>
                    </button>
                  ) : (
                    <button
                      key={fundIndex}
                      onClick={() => toggleSeriesVisibility(`${fundPrefix}_lumpSumReturn` as any)}
                      className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 hover:bg-gray-700 ${
                        seriesVisibility[`${fundPrefix}_lumpSumReturn`] ? 'opacity-100' : 'opacity-50'
                      }`}
                    >
                      <div
                        className="w-3 h-0.5 rounded"
                        style={{ backgroundColor: fundColor }}
                      />
                      <span className="text-gray-200">{fundCode} 收益率</span>
                    </button>
                  );
                }
                return null;
              })
            )}
          </div>
        </div>
      )}

      {/* 当没有曲线被选中时的空状态 */}
      {isChartReady && seriesRef.current.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#151515] rounded-xl">
          <div className="text-center text-[#666]">
            <div className="text-lg mb-2">📈</div>
            <div className="text-sm">请选择至少一条曲线来显示图表</div>
          </div>
        </div>
      )}

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