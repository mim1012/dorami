import { LucideIcon } from 'lucide-react';
import { KPICard } from './KPICard';

interface StatItem {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  color?: 'pink' | 'blue' | 'green' | 'orange';
  subtitle?: string;
}

interface StatsSectionProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
}

const colsMap = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function StatsSection({ stats, columns = 4 }: StatsSectionProps) {
  return (
    <div className={`grid gap-4 ${colsMap[columns]}`}>
      {stats.map((stat) => (
        <KPICard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          trend={stat.trend}
          trendUp={stat.trendUp}
          icon={stat.icon}
          color={stat.color}
          subtitle={stat.subtitle}
        />
      ))}
    </div>
  );
}

export default StatsSection;
