"use client"

import { useState, useEffect } from "react"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import weekOfYear from "dayjs/plugin/weekOfYear"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

dayjs.extend(utc)
dayjs.extend(weekOfYear)

type Agency = {
  id: string
  displayName: string
}

type AgencyHistory = {
  id: string
  agencyId: string
  wordCount: number
  date: string
}

type ChartData = {
  date: string
  wordCount: number
}

type TimeFrame = "daily" | "weekly" | "monthly"

const AgencyHistoryChart = () => {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null)
  const [data, setData] = useState<AgencyHistory[]>([])
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("daily")
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        const response = await fetch("/api/agencies")
        const result = await response.json()
        setAgencies(result)
      } catch (error) {
        console.error("Error fetching agencies:", error)
      }
    }

    fetchAgencies()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const url = selectedAgency ? `/api/agency-history?agencyId=${selectedAgency}` : "/api/agency-history"
        const response = await fetch(url)
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedAgency])

  useEffect(() => {
    const processData = () => {
      const groupedData: { [key: string]: number } = {}
      const lookup: Record<string, number> = {}
      data.slice().reverse().forEach((item) => {

        const date = dayjs.utc(item.date);
        let key: string;

        switch (timeFrame) {
          case "daily":
            key = date.format("YYYY-MM-DD");
            break;
          case "weekly":
            key = date.startOf("week").format("YYYY-MM-DD");
            break;
          case "monthly":
            key = date.startOf("month").format("YYYY-MM-DD");
            break;
        }
        const lookupKey = `${item.agencyId}-${key}`;
        if (lookup[lookupKey]) return;
        lookup[lookupKey] = item.wordCount;

        groupedData[key] = (groupedData[key] || 0) + item.wordCount;
      })

      const sortedData = Object.entries(groupedData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, wordCount]) => ({ date, wordCount }))

      setChartData(sortedData)
    }

    processData()
  }, [data, timeFrame])

  const formatXAxis = (value: string) => {
    const date = dayjs.utc(value)
    switch (timeFrame) {
      case "daily":
        return date.format("MMM D")
      case "weekly":
        return `Week ${date.week()}`
      case "monthly":
        return date.format("MMM YYYY")
    }
  }

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`
    }
    return value.toLocaleString()
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Agency Regulations Word Count</CardTitle>
        <CardDescription>
          {selectedAgency
            ? "Word count for regulations over time for the selected agency"
            : "Total word count for regulations over time for all agencies"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-4 mb-4">
          <Select
            value={selectedAgency || "all"}
            onValueChange={(value) => setSelectedAgency(value === "all" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies ({agencies.length})</SelectItem>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeFrame} onValueChange={(value: TimeFrame) => setTimeFrame(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400} className="">
            <BarChart data={chartData}>
              <XAxis dataKey="date" tickFormatter={formatXAxis} interval="preserveStartEnd" minTickGap={30} />
              <YAxis tickFormatter={formatYAxis} width={80} />
              <Bar
                dataKey="wordCount"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                onMouseEnter={(data, index) => {
                  const bars = document.querySelectorAll(".recharts-bar-rectangle")
                  bars[index]?.classList.add("hovered")
                }}
                onMouseLeave={(data, index) => {
                  const bars = document.querySelectorAll(".recharts-bar-rectangle")
                  bars[index]?.classList.remove("hovered")
                }}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border border-border p-2 rounded-md shadow-md">
                        <p className="font-semibold">{formatXAxis(payload[0].payload.date)}</p>
                        <p>Word Count: {payload[0].value?.toLocaleString()}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex justify-center items-center h-[400px] border border-dashed border-muted-foreground rounded-md">
            <p className="text-muted-foreground">No data available for the selected criteria</p>
          </div>
        )}
      </CardContent>
      <style jsx global>{`
        .recharts-bar-rectangle.hovered {
          filter: brightness(0.9);
        }
      `}</style>
    </Card>
  )
}

export default AgencyHistoryChart
