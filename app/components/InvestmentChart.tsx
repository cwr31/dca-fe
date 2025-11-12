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
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
          {
            label: '当前份额价值',
            data: data.map(item => item.currentValue),
            borderColor: '#FFD700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
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
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
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
      plugins: {
        title: {
          display: false,
        },
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#e0e0e0',
            font: {
              size: isMobile ? 12 : 14,
            },
            padding: 15,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 20, 0.98)',
          titleColor: '#e0e0e0',
          bodyColor: '#e0e0e0',
          borderColor: '#444',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          padding: 12,
          titleFont: {
            size: isMobile ? 12 : 14,
          },
          bodyFont: {
            size: isMobile ? 11 : 13,
          },
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
            },
            pinch: {
              enabled: true,
            },
            mode: 'x' as const,
          },
          pan: {
            enabled: true,
            mode: 'x' as const,
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
                content: '0%',
                position: 'end' as const,
                color: '#888',
                font: {
                  size: 12,
                },
              },
            },
          },
        } : {},
      },
      scales: {
        x: {
          type: 'category' as const,
          grid: {
            color: 'rgba(51, 51, 51, 0.3)',
            drawBorder: false,
          },
          ticks: {
            color: '#999',
            font: {
              size: isMobile ? 10 : 12,
            },
            maxRotation: isMobile ? -60 : -45,
            minRotation: isMobile ? -60 : -45,
            autoSkip: true,
            maxTicksLimit: isMobile ? 5 : 10,
            callback: function(this: any, value: any, index: number) {
              const label = this.getLabelForValue(value);
              if (isMobile) {
                return label.split('-').slice(1).join('/'); // MM/DD格式
              }
              return label;
            },
          },
        },
        y: {
          type: 'linear' as const,
          position: isReturnView ? 'right' as const : 'left' as const,
          grid: {
            color: 'rgba(51, 51, 51, 0.3)',
            drawBorder: false,
          },
          ticks: {
            color: '#999',
            font: {
              size: isMobile ? 10 : 12,
            },
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
              size: isMobile ? 11 : 12,
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