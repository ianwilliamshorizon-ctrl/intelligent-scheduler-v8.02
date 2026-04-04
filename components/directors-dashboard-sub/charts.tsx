import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyData {
    month: string;
    [key: string]: number | string;
}

interface SimpleLineChartProps {
    data: MonthlyData[];
    lines: { key: string; color: string; name: string; yAxisId?: 'left' | 'right' }[];
    title: string;
}

const formatValue = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
};

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, lines, title }) => {
    const hasRightAxis = lines.some(line => line.yAxisId === 'right');

    return (
        <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4 tracking-tight">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatValue} />
                    {hasRightAxis && <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `£${formatValue(val)}`} />}
                    <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number, name: string) => name.includes('£') ? `£${value.toLocaleString()}` : value} 
                    />
                    <Legend iconType="circle" />
                    {lines.map(line => (
                        <Line key={line.key} yAxisId={line.yAxisId || 'left'} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} name={line.name} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

interface SimpleBarChartProps {
    data: MonthlyData[];
    bars: { key: string; color: string; name: string }[];
    title: string;
    stacked?: boolean;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, bars, title, stacked }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
            <h3 className="text-xl font-black mb-6 tracking-tighter text-gray-900">{title}</h3>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `£${formatValue(val)}`} />
                    <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => `£${value.toLocaleString()}`} 
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    {bars.map((bar, index) => (
                        <Bar 
                            key={bar.key} 
                            dataKey={bar.key} 
                            fill={bar.color} 
                            name={bar.name} 
                            radius={stacked ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                            maxBarSize={40}
                            stackId={stacked ? 'a' : undefined}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
