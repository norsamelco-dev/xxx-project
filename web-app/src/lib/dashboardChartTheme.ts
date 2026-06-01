import type { ApexOptions } from 'apexcharts'
import type { ThemeColors } from '../themes/types'
import { formatTooltipMoney, toMoney } from './dashboardXUtils'

export const DASHBOARD_CHART_PALETTE = [
  '#0ea5e9',
  '#f97316',
  '#22c55e',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#eab308',
  '#6366f1',
]

export function buildDashboardChartPalette(colors: ThemeColors) {
  return [colors.accent, colors.primary, colors.good, colors.bad, '#8b5cf6', '#14b8a6', '#eab308', colors.secondary]
}

type BaseChartOptionsParams = {
  colors: ThemeColors
  height?: number
  enableZoom?: boolean
}

export function buildBaseChartOptions({ colors, height = 280, enableZoom = false }: BaseChartOptionsParams): ApexOptions {
  const palette = buildDashboardChartPalette(colors)

  return {
    chart: {
      type: 'line',
      height,
      fontFamily: 'inherit',
      toolbar: {
        show: enableZoom,
        tools: {
          download: false,
          selection: enableZoom,
          zoom: enableZoom,
          zoomin: enableZoom,
          zoomout: enableZoom,
          pan: enableZoom,
          reset: enableZoom,
        },
      },
      zoom: {
        enabled: enableZoom,
      },
      animations: {
        enabled: true,
        speed: 450,
      },
    },
    colors: palette,
    grid: {
      borderColor: colors.line,
      strokeDashArray: 4,
      padding: {
        left: 8,
        right: 12,
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2.5,
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: {
        colors: colors.textMuted,
      },
      fontWeight: 600,
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: (value) => formatTooltipMoney(value),
      },
    },
    xaxis: {
      labels: {
        style: {
          colors: colors.textMuted,
          fontSize: '11px',
        },
      },
      axisBorder: {
        color: colors.line,
      },
      axisTicks: {
        color: colors.line,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: colors.textMuted,
          fontSize: '11px',
        },
        formatter: (value) => {
          if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(1)}k`
          }
          return String(Math.round(value))
        },
      },
    },
  }
}

export function buildAreaTrendOptions(
  colors: ThemeColors,
  categories: string[],
  options?: { height?: number; enableZoom?: boolean; dualAxis?: boolean },
): ApexOptions {
  const base = buildBaseChartOptions({
    colors,
    height: options?.height ?? 280,
    enableZoom: options?.enableZoom ?? false,
  })

  return {
    ...base,
    chart: {
      ...base.chart,
      type: 'line',
      stacked: false,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.35,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    xaxis: {
      ...base.xaxis,
      categories,
    },
    yaxis: options?.dualAxis
      ? [
          {
            ...base.yaxis,
            seriesName: 'Total Sales',
            labels: {
              ...(Array.isArray(base.yaxis) ? {} : base.yaxis?.labels),
              style: { colors: colors.textMuted, fontSize: '11px' },
              formatter: (value: number) => {
                if (Math.abs(value) >= 1000) {
                  return `${(value / 1000).toFixed(1)}k`
                }
                return String(Math.round(value))
              },
            },
            title: {
              text: 'Sales',
              style: { color: colors.textMuted, fontSize: '11px' },
            },
          },
          {
            opposite: true,
            seriesName: 'Transactions',
            labels: {
              style: { colors: colors.textMuted, fontSize: '11px' },
              formatter: (value: number) => String(Math.round(value)),
            },
            title: {
              text: 'Transactions',
              style: { color: colors.textMuted, fontSize: '11px' },
            },
          },
        ]
      : base.yaxis,
    tooltip: {
      ...base.tooltip,
      shared: true,
      intersect: false,
      y: [
        {
          formatter: (value) => formatTooltipMoney(value),
        },
        {
          formatter: (value) => String(Math.round(Number(value || 0))),
        },
      ],
    },
  }
}

export function buildHorizontalBarOptions(
  colors: ThemeColors,
  categories: string[],
  options?: { height?: number; money?: boolean; dataLabels?: boolean },
): ApexOptions {
  const base = buildBaseChartOptions({ colors, height: options?.height ?? 280 })

  return {
    ...base,
    chart: {
      ...base.chart,
      type: 'bar',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '68%',
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: options?.dataLabels ?? true,
      offsetX: 24,
      style: {
        fontSize: '11px',
        fontWeight: 600,
        colors: [colors.text],
      },
      formatter: (value) => {
        if (options?.money) {
          return toMoney(Number(value))
        }
        return String(Math.round(Number(value || 0)))
      },
    },
    xaxis: {
      categories,
      labels: {
        style: {
          colors: colors.textMuted,
          fontSize: '11px',
        },
        formatter: options?.money
          ? (value) => {
              const num = Number(value)
              if (Math.abs(num) >= 1000) {
                return `${(num / 1000).toFixed(0)}k`
              }
              return String(Math.round(num))
            }
          : undefined,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: colors.text,
          fontSize: '11px',
          fontWeight: 500,
        },
        maxWidth: 200,
      },
    },
    tooltip: {
      ...base.tooltip,
      y: {
        formatter: (value) => (options?.money ? formatTooltipMoney(value) : String(Math.round(Number(value || 0)))),
      },
    },
    grid: {
      ...base.grid,
      padding: {
        left: 4,
        right: 16,
      },
    },
  }
}

export function buildColumnOptions(
  colors: ThemeColors,
  categories: string[],
  options?: { height?: number; money?: boolean },
): ApexOptions {
  const base = buildBaseChartOptions({ colors, height: options?.height ?? 260 })

  return {
    ...base,
    chart: {
      ...base.chart,
      type: 'bar',
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '55%',
      },
    },
    xaxis: {
      ...base.xaxis,
      categories,
    },
    tooltip: {
      ...base.tooltip,
      y: {
        formatter: (value) => (options?.money ? formatTooltipMoney(value) : String(Math.round(Number(value || 0)))),
      },
    },
  }
}

export function buildDonutOptions(
  colors: ThemeColors,
  labels: string[],
  options?: { height?: number },
): ApexOptions {
  const palette = buildDashboardChartPalette(colors)

  return {
    chart: {
      type: 'donut',
      height: options?.height ?? 260,
      fontFamily: 'inherit',
      toolbar: { show: false },
    },
    colors: palette,
    labels,
    legend: {
      position: 'bottom',
      labels: {
        colors: colors.textMuted,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (value) => `${Math.round(Number(value))}%`,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '62%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              color: colors.textMuted,
              formatter: (w) => {
                const sum = w.globals.seriesTotals.reduce((acc: number, v: number) => acc + v, 0)
                return formatTooltipMoney(sum)
              },
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (value) => formatTooltipMoney(value),
      },
    },
  }
}

export function buildLineOptions(
  colors: ThemeColors,
  categories: string[],
  options?: { height?: number },
): ApexOptions {
  const base = buildBaseChartOptions({ colors, height: options?.height ?? 260 })

  return {
    ...base,
    chart: {
      ...base.chart,
      type: 'line',
    },
    xaxis: {
      ...base.xaxis,
      categories,
    },
    tooltip: {
      ...base.tooltip,
      shared: true,
      intersect: false,
      y: {
        formatter: (value) => String(Math.round(Number(value || 0))),
      },
    },
  }
}
