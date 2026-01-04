'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface LanguageData {
  language: string;
  repo_count: number;
  total_stars: number;
  event_count: number;
}

interface LanguageDistributionProps {
  data: LanguageData[];
  maxItems?: number;
}

const COLORS = [
  '#3178c6', // TypeScript blue
  '#f1e05a', // JavaScript yellow
  '#3572A5', // Python blue
  '#dea584', // Rust orange
  '#00ADD8', // Go cyan
  '#b07219', // Java brown
  '#178600', // C# green
  '#e34c26', // HTML red
  '#563d7c', // CSS purple
  '#4F5D95', // PHP purple
];

export default function LanguageDistribution({
  data,
  maxItems = 8,
}: LanguageDistributionProps) {
  const chartData = data.slice(0, maxItems).map((lang, index) => ({
    name: lang.language,
    value: lang.event_count,
    repos: lang.repo_count,
    stars: lang.total_stars,
    color: COLORS[index % COLORS.length],
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
      .reduce((sum, lang) => sum + lang.total_stars, 0);

    chartData.push({
      name: 'Others',
      value: othersEvents,
      repos: othersRepos,
      stars: othersStars,
      color: '#6b7280',
    });
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Language Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string, props: any) => [
              <>
                <div>{value.toLocaleString()} events</div>
                <div className="text-muted-foreground">
                  {props.payload.repos} repos, {props.payload.stars.toLocaleString()} stars
                </div>
              </>,
              props.payload.name,
            ]}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            formatter={(value: string) => (
              <span className="text-xs text-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
