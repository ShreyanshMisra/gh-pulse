'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Code } from 'lucide-react';

interface LanguageData {
  language: string;
  repo_count: number;
  total_stars_gained: number;
  event_count: number;
  avg_velocity?: number;
}

interface LanguageDistributionProps {
  data: LanguageData[];
  maxItems?: number;
}

// Language-specific colors
const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Scala: '#c22d40',
  Dart: '#00B4AB',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Lua: '#000080',
  R: '#198CE7',
  Julia: '#9558B2',
  Zig: '#F7A41D',
  Others: '#6b7280',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-medium text-foreground">{data.name}</span>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Events</span>
          <span className="font-mono text-foreground">{data.value.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Repos</span>
          <span className="font-mono text-foreground">{data.repos.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Stars Gained</span>
          <span className="font-mono text-success">+{data.stars.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

const CustomLegend = ({ payload }: any) => {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[11px] text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function LanguageDistribution({
  data,
  maxItems = 8,
}: LanguageDistributionProps) {
  const chartData = data.slice(0, maxItems).map((lang) => ({
    name: lang.language,
    value: lang.event_count,
    repos: lang.repo_count,
    stars: lang.total_stars_gained,
    color: languageColors[lang.language] || '#6b7280',
  }));

  // Calculate "Others" if there are more languages
  if (data.length > maxItems) {
    const othersEvents = data
      .slice(maxItems)
      .reduce((sum, lang) => sum + lang.event_count, 0);
    const othersRepos = data
      .slice(maxItems)
      .reduce((sum, lang) => sum + lang.repo_count, 0);
    const othersStars = data
      .slice(maxItems)
      .reduce((sum, lang) => sum + lang.total_stars_gained, 0);

    chartData.push({
      name: 'Others',
      value: othersEvents,
      repos: othersRepos,
      stars: othersStars,
      color: languageColors.Others,
    });
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-[350px] flex-col items-center justify-center rounded-lg border border-border bg-card">
        <Code className="h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No language data available</p>
      </div>
    );
  }

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-3/10">
          <Code className="h-4 w-4 text-chart-3" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground">Language Distribution</h3>
          <p className="text-[10px] text-muted-foreground">
            {total.toLocaleString()} total events
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                style={{ filter: 'brightness(1.1)' }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            content={<CustomLegend />}
            verticalAlign="bottom"
            height={36}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
