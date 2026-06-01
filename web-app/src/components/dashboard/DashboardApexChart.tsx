import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

type DashboardApexChartProps = {
  type: NonNullable<ApexOptions['chart']>['type']
  series: ApexAxisChartSeries | ApexNonAxisChartSeries
  options: ApexOptions
  height?: number | string
  emptyMessage?: string
  className?: string
  isEmpty?: boolean
}

function DashboardApexChart({
  type,
  series,
  options,
  height = 280,
  emptyMessage = 'No data for the selected range.',
  className,
  isEmpty = false,
}: DashboardApexChartProps) {
  if (isEmpty) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className={className}>
      <Chart type={type} series={series} options={options} height={height} width="100%" />
    </div>
  )
}

export default DashboardApexChart
