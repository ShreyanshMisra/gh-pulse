'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Activity, Wifi, WifiOff } from 'lucide-react';

interface ActivityTimelineProps {
  eventsPerMin: number;
  isConnected: boolean;
}

interface DataPoint {
  time: string;
  timestamp: number;
  events: number;
}

const MAX_DATA_POINTS = 30;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-lg">
      <p className="font-mono text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-primary">
        {payload[0].value} <span className="text-xs text-muted-foreground">events/min</span>
      </p>
    </div>
  );
};

export default function ActivityTimeline({
  eventsPerMin,
  isConnected,
}: ActivityTimelineProps) {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    if (!isConnected) return;

    const now = Date.now();
    const newPoint: DataPoint = {
      time: format(now, 'HH:mm:ss'),
      timestamp: now,
      events: eventsPerMin,
    };

    setData((prev) => {
      const updated = [...prev, newPoint];
      if (updated.length > MAX_DATA_POINTS) {
        return updated.slice(-MAX_DATA_POINTS);
      }
      return updated;
    });
  }, [eventsPerMin, isConnected]);

  const avgEvents = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.events, 0) / data.length)
    : 0;

  const maxEvents = data.length > 0
    ? Math.max(...data.map(d => d.events))
    : 0;

  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-2/10">
              <Activity className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Activity Timeline</h3>
              <p className="text-[10px] text-muted-foreground">Events per minute over time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-danger" />
            )}
          </div>
        </div>
        <div className="flex h-[240px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-pulse rounded-full bg-primary/20" />
            <p className="text-sm text-muted-foreground">
              {isConnected ? 'Collecting data...' : 'Waiting for connection...'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Timeline will appear after a few data points
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-2/10">
            <Activity className="h-4 w-4 text-chart-2" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Activity Timeline</h3>
            <p className="text-[10px] text-muted-foreground">Events per minute over time</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">AVG</span>
              <span className="font-mono font-medium text-foreground">{avgEvents}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">MAX</span>
              <span className="font-mono font-medium text-foreground">{maxEvents}</span>
            </div>
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
            isConnected ? 'bg-success/10' : 'bg-danger/10'
          }`}>
            <span className={`status-dot ${isConnected ? 'live' : 'error'}`} />
            <span className={`text-[10px] font-medium ${
              isConnected ? 'text-success' : 'text-danger'
            }`}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="events"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fill="url(#activityGradient)"
            dot={false}
            activeDot={{
              r: 4,
              stroke: 'hsl(var(--chart-2))',
              strokeWidth: 2,
              fill: 'hsl(var(--card))',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
