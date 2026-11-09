"use client"

import React, { useId } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts"
import { useLanguage } from "@/lib/i18n/context"

type Row = {
  date: string
  close: number | null
}

function formatTick(dateString: string, period?: string, interval?: string, locale = "fr-FR") {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  if (interval === "1wk" || period === "5y") {
    return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(date)
  }

  if (period === "1y") {
    return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(date)
  }

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(date)
}

function formatTooltipDate(dateString: string, locale: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date)
}

function formatYAxisValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

export default function StockChart({
  data,
  period,
  interval,
  currency = "EUR",
  valueLabel
}: {
  data: Row[]
  period?: string
  interval?: string
  currency?: string
  valueLabel?: string
}) {
  const gradientId = useId().replace(/:/g, "")
  const { language } = useLanguage()
  const locale = language === "fr" ? "fr-FR" : "en-GB"

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.005} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            minTickGap={28}
            tickFormatter={(value) => formatTick(String(value), period, interval, locale)}
          />
          <YAxis
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={64}
            tickFormatter={(value) => {
              if (typeof value !== "number") return String(value)
              return formatYAxisValue(value, locale)
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
              boxShadow: "0 4px 20px rgb(25 28 55 / 6%)",
              fontSize: 12
            }}
            labelStyle={{ color: "var(--muted-foreground)", fontSize: 10, marginBottom: 6 }}
            cursor={{ stroke: "var(--chart-1)", strokeDasharray: "4 4" }}
            labelFormatter={(value) => formatTooltipDate(String(value), locale)}
            formatter={(value) => {
              const label = valueLabel ?? (language === "fr" ? "Clôture" : "Close")
              if (typeof value !== "number") return [value, label]
              return [
                new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency,
                  maximumFractionDigits: 2
                }).format(value),
                label
              ]
            }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="var(--chart-1)"
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
