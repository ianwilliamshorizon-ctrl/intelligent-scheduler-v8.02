import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" tickFormatter={formatValue} />
                    {hasRightAxis && <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `£${formatValue(val)}`} />}
                    <Tooltip formatter={(value: number, name: string) => name.includes('£') ? `£${value.toLocaleString()}`: value} />
                    <Legend />
                    {lines.map(line => (
                        <Line key={line.key} yAxisId={line.yAxisId || 'left'} type="monotone" dataKey={line.key} stroke={line.color} name={line.name} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
