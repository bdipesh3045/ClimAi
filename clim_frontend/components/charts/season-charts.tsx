"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const comparisonConfig = {
  previous: { label: "Earlier season", color: "var(--chart-2)" },
  current: { label: "Later season", color: "var(--chart-1)" },
} satisfies ChartConfig

type ComparisonDatum = { month: string; previous: number; current: number }

export function TemperatureComparisonChart({ data }: { data: ComparisonDatum[] }) {
  return (
    <ChartContainer config={comparisonConfig} className="h-[250px] w-full">
      <LineChart accessibilityLayer data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} width={38} tickFormatter={(value) => `${value}°`} />
        <Tooltip content={<ChartTooltipContent indicator="line" />} />
        <Line type="monotone" dataKey="previous" stroke="var(--color-previous)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="current" stroke="var(--color-current)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

export function RainfallComparisonChart({ data }: { data: ComparisonDatum[] }) {
  return (
    <ChartContainer config={comparisonConfig} className="h-[250px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} width={38} tickFormatter={(value) => `${value}`} />
        <Tooltip content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="previous" fill="var(--color-previous)" radius={[4, 4, 0, 0]} maxBarSize={14} />
        <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ChartContainer>
  )
}
