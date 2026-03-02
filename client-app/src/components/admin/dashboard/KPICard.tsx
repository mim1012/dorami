import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  color?: 'pink' | 'blue' | 'green' | 'orange';
  subtitle?: string;
}

const colorMap = {
  pink: { icon: 'text-pink-500 bg-pink-50', border: 'hover:border-pink-200' },
  blue: { icon: 'text-blue-500 bg-blue-50', border: 'hover:border-blue-200' },
  green: { icon: 'text-green-500 bg-green-50', border: 'hover:border-green-200' },
  orange: { icon: 'text-orange-500 bg-orange-50', border: 'hover:border-orange-200' },
};

export function KPICard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  color = 'pink',
  subtitle,
}: KPICardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-6 transition-all duration-200 hover:shadow-md ${colors.border} group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`p-3 rounded-lg ${colors.icon} transition-transform group-hover:scale-110 duration-200`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && trendUp !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${
              trendUp ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {trendUp ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {trend}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export default KPICard;
