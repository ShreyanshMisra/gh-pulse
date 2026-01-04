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
      // Keep only the last MAX_DATA_POINTS
      if (updated.length > MAX_DATA_POINTS) {
        return updated.slice(-MAX_DATA_POINTS);
      }
      return updated;
    });
  }, [eventsPerMin, isConnected]);

  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-medium text-foreground">
          Event Activity Timeline
        </h3>
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {isConnected ? 'Collecting data...' : 'Waiting for connection...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Event Activity Timeline
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(222, 47%, 41%)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="hsl(222, 47%, 41%)"
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value} events/min`, 'Activity']}
          />
          <Area
            type="monotone"
            dataKey="events"
            stroke="hsl(222, 47%, 41%)"
            fillOpacity={1}
            fill="url(#colorEvents)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
