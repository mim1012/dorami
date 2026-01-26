import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    trend: string;
    trendUp: boolean;
    icon: LucideIcon;
    color?: 'pink' | 'blue' | 'green' | 'orange';
}

export default function StatCard({
    title,
    value,
    trend,
    trendUp,
    icon: Icon,
    color = 'pink'
}: StatCardProps) {

    const colorMap = {
        pink: 'text-hot-pink bg-hot-pink/10',
        blue: 'text-info bg-info/10',
        green: 'text-success bg-success/10',
        orange: 'text-warning bg-warning/10',
    };

    return (
        <div className="bg-content-bg border border-white/5 rounded-card p-6 hover:border-hot-pink/30 hover:shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${colorMap[color]} transition-transform group-hover:scale-110 duration-300`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${trendUp ? 'text-success' : 'text-error'}`}>
                    {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {trend}
                </div>
            </div>

            <div>
                <p className="text-secondary-text text-sm font-medium mb-1">{title}</p>
                <h3 className="text-display text-white font-bold tracking-tight">{value}</h3>
            </div>
        </div>
    );
}
