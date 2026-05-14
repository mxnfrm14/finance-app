"use client"

import React from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

type Row = { date: string; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null }

function formatTick(dateString: string, period?: string, interval?: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  if (interval === "1wk" || period === "5y") {
    return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(date)
  }

  if (period === "1y") {
    return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(date)
  }

  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date)
}

function formatTooltipDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatYAxisValue(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function StockChart({
  data,
  period,
  interval,
  currency = "EUR",
}: {
  data: Row[]
  period?: string
  interval?: string
  currency?: string
}) {
  const formatted = data.map((d) => ({ ...d, date: d.date }))

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            minTickGap={28}
            tickFormatter={(value) => formatTick(String(value), period, interval)}
          />
          <YAxis
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 11 }}
            width={64}
            tickFormatter={(value) => {
              if (typeof value !== "number") return String(value)
              return formatYAxisValue(value)
            }}
          />
          <Tooltip
            labelFormatter={(value) => formatTooltipDate(String(value))}
            formatter={(value) => {
              if (typeof value !== "number") return [value, "Clôture"]
              return [
                new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value),
                "Clôture",
              ]
            }}
          />
          <Line type="monotone" dataKey="close" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
