'use client';

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
  annotationPlugin
);

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
  const chartRef = useRef<ChartJS<'line'>>(null);

  // 转换数据为Chart.js格式
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const labels = data.map(item => item.date);

    if (chartView === 'cost') {
      return {
        labels,
        datasets: [
          {
            label: '累计投入金额',
            data: data.map(item => item.totalInvestment),
            borderColor: '#00CED1',
            backgroundColor: 'rgba(0, 206, 209, 0.1)',
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#00CED1',
            pointBorderColor: '#00CED1',
            pointHoverBackgroundColor: '#00CED1',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5,
            borderCapStyle: 'round' as const,
            borderJoinStyle: 'round' as const,
          },
          {
            label: '当前份额价值',
            data: data.map(item => item.currentValue),
            borderColor: '#FFD700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#FFD700',
            pointBorderColor: '#FFD700',
            pointHoverBackgroundColor: '#FFD700',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5,
            borderCapStyle: 'round' as const,
            borderJoinStyle: 'round' as const,
          },
        ],
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: '定投年化收益率',
            data: data.map(item => item.annualizedReturnRate),
            borderColor: '#4ECDC4',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#4ECDC4';

              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(78, 205, 196, 0.3)');
              gradient.addColorStop(1, 'rgba(78, 205, 196, 0.05)');
              return gradient;
            },
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#4ECDC4',
            pointBorderColor: '#4ECDC4',
            pointHoverBackgroundColor: '#4ECDC4',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5,
            borderCapStyle: 'round' as const,
            borderJoinStyle: 'round' as const,
          },
        ],
      };
    }
  }, [data, chartView]);

  // 图表配置选项
  const options = React.useMemo(() => {
    const isReturnView = chartView === 'return';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      layout: {
        padding: {
          top: isMobile ? 5 : 10,
          right: isMobile ? 5 : (isReturnView ? 40 : 25),
          bottom: isMobile ? 30 : 50,
          left: isMobile ? 5 : (isReturnView ? 25 : 40),
        },
      },
      plugins: {
        title: {
          display: false,
        },
        legend: {
          display: true,
          position: isMobile ? 'top' as const : 'top' as const,
          labels: {
            color: '#e0e0e0',
            font: {
              size: isMobile ? 10 : 12,
              weight: 500,
            },
            padding: isMobile ? 8 : 15,
            usePointStyle: true,
            pointStyle: 'circle' as const,
            boxWidth: isMobile ? 6 : 8,
            boxHeight: isMobile ? 6 : 8,
          },
          align: 'end' as const,
          rtl: true,
        },
        tooltip: {
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          titleColor: '#4a9eff',
          bodyColor: '#e0e0e0',
          borderColor: '#4a9eff',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          padding: 12,
          titleFont: {
            size: isMobile ? 12 : 14,
            weight: 600,
          },
          bodyFont: {
            size: isMobile ? 11 : 13,
          },
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            title: (items: any[]) => {
              if (items.length > 0) {
                const index = items[0].dataIndex;
                const item = data[index];
                return item.date;
              }
              return '';
            },
            label: (context: any) => {
              const index = context.dataIndex;
              const item = data[index];

              if (isReturnView) {
                return `年化收益率: ${item.annualizedReturnRate.toFixed(2)}%`;
              } else {
                if (context.datasetIndex === 0) {
                  return `累计投入金额: ¥${item.totalInvestment.toFixed(2)}`;
                } else {
                  return `当前份额价值: ¥${item.currentValue.toFixed(2)}`;
                }
              }
            },
            afterLabel: (context: any) => {
              const index = context.dataIndex;
              const item = data[index];

              if (!isReturnView) {
                const currentReturnRate = ((item.currentValue - item.totalInvestment) / item.totalInvestment) * 100;
                return `当前收益率: ${currentReturnRate.toFixed(2)}%`;
              }
              return '';
            },
          },
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: 'ctrl' as const,
            },
            pinch: {
              enabled: true,
            },
            drag: {
              enabled: true,
              backgroundColor: 'rgba(74, 158, 255, 0.1)',
              borderColor: 'rgba(74, 158, 255, 0.3)',
              borderWidth: 1,
            },
            mode: 'x' as const,
          },
          pan: {
            enabled: true,
            mode: 'x' as const,
            modifierKey: 'shift' as const,
          },
          limits: {
            x: {
              min: 'original' as const,
              max: 'original' as const,
            },
          },
        },
        annotation: isReturnView ? {
          annotations: {
            zeroLine: {
              type: 'line' as const,
              yMin: 0,
              yMax: 0,
              borderColor: '#888',
              borderWidth: 1,
              borderDash: [4, 4],
              label: {
                display: true,
                content: '0% 基准线',
                position: 'end' as const,
                color: '#888',
                font: {
                  size: 10,
                  weight: 500,
                },
                backgroundColor: 'transparent',
                padding: 4,
              },
            },
          },
        } : {},
      },
      scales: {
        x: {
          type: 'category' as const,
          grid: {
            color: 'rgba(51, 51, 51, 0.2)',
            drawBorder: false,
            drawOnChartArea: true,
            drawTicks: false,
            tickLength: 0,
          },
          ticks: {
            color: '#999',
            font: {
              size: isMobile ? 9 : 11,
              weight: 'normal' as const,
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: isMobile ? 20 : 40,
            maxTicksLimit: isMobile ? 4 : 8,
            padding: 5,
            callback: function(this: any, value: any, index: number) {
              const label = this.getLabelForValue(value);
              if (!label) return '';

              try {
                const date = new Date(label);
                if (isNaN(date.getTime())) {
                  // 如果不是有效日期，按原格式处理
                  if (isMobile) {
                    const parts = label.split('-');
                    if (parts.length >= 2) {
                      return `${parts[1]}/${parts[2]}`; // MM/DD
                    }
                    return label;
                  }
                  return label;
                }

                // 格式化日期
                if (isMobile) {
                  return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                } else {
                  // 桌面端显示更完整的信息
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
                return label;
              }
            },
          },
          title: {
            display: true,
            text: '时间',
            color: '#999',
            font: {
              size: isMobile ? 10 : 12,
              weight: 500,
            },
            padding: {
              top: isMobile ? 10 : 15,
              bottom: 5,
            },
          },
        },
        y: {
          type: 'linear' as const,
          position: isReturnView ? 'right' as const : 'left' as const,
          grid: {
            color: 'rgba(51, 51, 51, 0.2)',
            drawBorder: false,
            drawOnChartArea: true,
            drawTicks: false,
            tickLength: 0,
          },
          ticks: {
            color: '#999',
            font: {
              size: isMobile ? 9 : 11,
              weight: 'normal' as const,
            },
            padding: 5,
            callback: function(this: any, value: any) {
              if (isReturnView) {
                return `${value.toFixed(1)}%`;
              }
              return `¥${value.toFixed(0)}`;
            },
          },
          title: {
            display: true,
            text: isReturnView ? '年化收益率（%）' : '金额（元）',
            color: '#999',
            font: {
              size: isMobile ? 10 : 12,
              weight: 500,
            },
            padding: {
              top: 5,
              bottom: isMobile ? 10 : 15,
            },
          },
        },
      },
    };
  }, [chartView, isMobile, data]);

  // 处理缩放变化
  useEffect(() => {
    if (onZoomChange && chartRef.current) {
      const chart = chartRef.current;
      const { min, max } = chart.scales.x;

      if (min !== undefined && max !== undefined) {
        const startIndex = Math.floor(min);
        const endIndex = Math.ceil(max);

        if (startIndex !== brushStartIndex || endIndex !== brushEndIndex) {
          onZoomChange(Math.max(0, startIndex), Math.min(data.length - 1, endIndex));
        }
      }
    }
  }, [onZoomChange, brushStartIndex, brushEndIndex, data.length]);

  // 应用缩放范围
  useEffect(() => {
    if (chartRef.current && brushStartIndex >= 0 && brushEndIndex > 0) {
      const chart = chartRef.current;
      const min = brushStartIndex;
      const max = brushEndIndex;

      chart.zoomScale('x', {min, max});
      chart.update('none');
    }
  }, [brushStartIndex, brushEndIndex]);

  return (
    <div className="w-full h-full relative">
      <Line
        ref={chartRef}
        data={chartData}
        options={options}
      />
    </div>
  );
}