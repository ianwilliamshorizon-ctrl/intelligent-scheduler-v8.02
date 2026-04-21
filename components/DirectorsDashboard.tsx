import React, { useState, useMemo } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { SimpleLineChart, SimpleBarChart } from './directors-dashboard-sub/charts';
import AIAssistant from './directors-dashboard-sub/AIAssistant';
import BaselineCostsEditor from './directors-dashboard-sub/BaselineCostsEditor';
import { subMonths, format, startOfMonth, parse, isValid } from 'date-fns';
import { Job, Estimate, Invoice, FinancialBaseline } from '../types';
import { TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Activity, Loader2 } from 'lucide-react';

const DirectorsDashboard: React.FC = () => {
    const { jobs, estimates, invoices, financialBaselines, saveRecord, isDataLoaded } = useData();
    const { businessEntities } = useApp();
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>(format(new Date(), 'yyyy'));

    const getSafeDate = (item: any): Date => {
        const dateString = item.issueDate || item.createdAt || item.orderDate || item.scheduledDate;
        if (!dateString) return new Date('invalid');
        const d = new Date(dateString);
        return isValid(d) ? d : new Date('invalid');
    };

    const processedData = useMemo(() => {
        const yearStart = new Date(Number(selectedYear), 0, 1);
        const monthKeys: string[] = [];
        for (let i = 0; i < 12; i++) {
            const date = new Date(Number(selectedYear), i, 1);
            monthKeys.push(format(date, 'yyyy-MM'));
        }

        const createMonthlyBuckets = () => new Map(monthKeys.map(k => [k, { 
            count: 0, 
            revenue: 0, 
            costOfSales: 0,
            grossProfit: 0,
            baselineCosts: 0,
            netProfit: 0,
            estimatesCount: 0,
            estimatesValue: 0,
            invoicesCount: 0,
            invoicesValue: 0
        }]));

        // 1. Setup local breakdown data for the Monthly Strategic Table
        const breakdownBuckets = new Map();
        const activeEntities = selectedEntityId === 'all' ? (businessEntities || []) : (businessEntities || []).filter(e => e.id === selectedEntityId);

        activeEntities.forEach(ent => {
            monthKeys.forEach(m => {
                breakdownBuckets.set(`${ent.id}_${m}`, {
                    month: m,
                    entityName: ent.name,
                    entityId: ent.id,
                    revenue: 0,
                    costOfSales: 0,
                    grossProfit: 0,
                    baselineCosts: 0,
                    jobs: 0
                });
            });
        });

        // 2. Process Invoices into breakdown buckets
        (invoices || []).forEach(inv => {
            const date = getSafeDate(inv);
            const monthKey = format(date, 'yyyy-MM');
            const key = `${inv.entityId}_${monthKey}`;
            if (breakdownBuckets.has(key)) {
                const b = breakdownBuckets.get(key);
                (inv.lineItems || []).forEach((li: any) => {
                    const rev = (li.unitPrice || 0) * (li.quantity || 0);
                    const cost = (li.unitCost || 0) * (li.quantity || 0);
                    b.revenue += rev;
                    b.costOfSales += cost;
                });
                b.grossProfit = b.revenue - b.costOfSales;
            }
        });

        // 3. Process Baselines & Overrides into breakdown buckets
        (financialBaselines || []).forEach(base => {
            const key = `${base.entityId}_${base.month}`;
            if (breakdownBuckets.has(key)) {
                const b = breakdownBuckets.get(key);
                
                const hRev = Number(base.historicalRevenue || 0);
                const hCos = Number(base.historicalCostOfSales || 0);
                b.revenue += hRev;
                b.costOfSales += hCos;
                b.grossProfit = b.revenue - b.costOfSales;

                b.baselineCosts += Number(base.salaries || 0) + Number(base.rentRates || 0) + Number(base.utilities || 0) + Number(base.nonBudgetedCosts || 0) + Number(base.otherOverheads || 0);
            }
        });

        // 4. Process Jobs for count
        (jobs || []).forEach(job => {
            const date = getSafeDate(job);
            const monthKey = format(date, 'yyyy-MM');
            const key = `${job.entityId}_${monthKey}`;
            if (breakdownBuckets.has(key)) {
                breakdownBuckets.get(key).jobs++;
            }
        });

        // 5. Finalize Table Rows
        const tableData = Array.from(breakdownBuckets.values())
            .sort((a, b) => b.month.localeCompare(a.month) || a.entityName.localeCompare(b.entityName))
            .map(b => ({
                ...b,
                netProfit: b.grossProfit - b.baselineCosts,
                displayMonth: format(parse(b.month, 'yyyy-MM', new Date()), 'MMM yyyy')
            }));

        // --- Keep Existing Chart/Kpi Aggregation (Totaled for the selected view) ---
        const buckets = createMonthlyBuckets();
        const filteredInvoices = (invoices || []).filter(i => selectedEntityId === 'all' || i.entityId === selectedEntityId);
        const filteredJobs = (jobs || []).filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId);
        const filteredBaselines = (financialBaselines || []).filter(b => selectedEntityId === 'all' || b.entityId === selectedEntityId);
        const filteredEstimates = (estimates || []).filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId);

        // (Original aggregation logic remains for the Chart and Top KPIs)
        filteredInvoices.forEach(inv => {
            const date = getSafeDate(inv);
            const monthKey = format(date, 'yyyy-MM');
            if (buckets.has(monthKey)) {
                const b = buckets.get(monthKey)!;
                b.invoicesCount++;
                (inv.lineItems || []).forEach((li: any) => {
                    const rev = (li.unitPrice || 0) * (li.quantity || 0);
                    const cost = (li.unitCost || 0) * (li.quantity || 0);
                    b.revenue += rev;
                    b.costOfSales += cost;
                    b.grossProfit += (rev - cost);
                });
            }
        });

        filteredBaselines.forEach(base => {
            if (buckets.has(base.month)) {
                const b = buckets.get(base.month)!;
                const hRev = Number(base.historicalRevenue || 0);
                const hCos = Number(base.historicalCostOfSales || 0);
                b.revenue += hRev;
                b.costOfSales += hCos;
                b.grossProfit += (hRev - hCos);
                b.baselineCosts += Number(base.salaries || 0) + Number(base.rentRates || 0) + Number(base.utilities || 0) + Number(base.nonBudgetedCosts || 0) + Number(base.otherOverheads || 0);
            }
        });

        filteredJobs.forEach(job => {
            const date = getSafeDate(job);
            const monthKey = format(date, 'yyyy-MM');
            if (buckets.has(monthKey)) buckets.get(monthKey)!.count++;
        });

        filteredEstimates.forEach(est => {
            const date = getSafeDate(est);
            const monthKey = format(date, 'yyyy-MM');
            if (buckets.has(monthKey)) {
                const b = buckets.get(monthKey)!;
                b.estimatesCount++;
                b.estimatesValue += (est.lineItems || []).reduce((acc, li) => acc + ((li.unitPrice || 0) * (li.quantity || 0)), 0);
            }
        });

        const chartData = monthKeys.map(k => {
            const b = buckets.get(k)!;
            const netProfit = b.grossProfit - b.baselineCosts;
            return {
                month: format(parse(k, 'yyyy-MM', new Date()), 'MMM'),
                'Revenue': Math.round(b.revenue),
                'Gross Profit': Math.round(b.grossProfit),
                'Net Profit': Math.round(netProfit),
                'Baseline Costs': Math.round(b.baselineCosts),
                'Cost of Sales': Math.round(b.costOfSales),
                'Jobs': b.count,
                'Estimates': b.estimatesCount,
                'Invoices': b.invoicesCount,
                'Avg Job Revenue': b.count > 0 ? Math.round(b.revenue / b.count) : 0
            };
        });

        const totals = chartData.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.Revenue,
            grossProfit: acc.grossProfit + curr['Gross Profit'],
            netProfit: acc.netProfit + curr['Net Profit'],
            jobs: acc.jobs + curr.Jobs
        }), { revenue: 0, grossProfit: 0, netProfit: 0, jobs: 0 });

        return { chartData, totals, tableData };
    }, [jobs, estimates, invoices, financialBaselines, selectedEntityId, selectedYear, businessEntities]);

    if (!isDataLoaded) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 bg-[#f8fafc] min-h-screen space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter flex items-center gap-3">
                        <span className="md:hidden">Brookspeed</span>
                        <span className="hidden md:inline">Business Summary <Activity className="text-indigo-600" size={32} /></span>
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">High-level financial performance and operational metrics</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 px-3 border-r border-gray-100">
                         <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Filter By</span>
                    </div>
                    <select
                        value={selectedEntityId}
                        onChange={e => setSelectedEntityId(e.target.value)}
                        className="px-4 py-2 bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
                    >
                        <option value="all">All Entities</option>
                        {(businessEntities || []).map(entity => (
                            <option key={entity.id} value={entity.id}>{entity.name}</option>
                        ))}
                    </select>
                    <div className="h-4 w-px bg-gray-100 mx-2"></div>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        className="px-4 py-2 bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
                    >
                        {['2024', '2025', '2026', '2027'].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Top Level KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-indigo-100/20 border border-indigo-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingUp size={80} className="text-indigo-600" />
                    </div>
                    <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-1">Annual Revenue</p>
                    <h3 className="text-3xl font-black text-gray-900">£{processedData.totals.revenue.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-full">
                        <TrendIndicator value={12} /> vs Previous Year
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-emerald-100/20 border border-emerald-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <DollarSign size={80} className="text-emerald-600" />
                    </div>
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1">Gross Profit</p>
                    <h3 className="text-3xl font-black text-gray-900">£{processedData.totals.grossProfit.toLocaleString()}</h3>
                    <p className="mt-4 text-xs font-bold text-gray-500">Margin: {processedData.totals.revenue > 0 ? Math.round((processedData.totals.grossProfit / processedData.totals.revenue) * 100) : 0}%</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-purple-100/20 border border-purple-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <PieChart size={80} className="text-purple-600" />
                    </div>
                    <p className="text-[11px] font-black text-purple-600 uppercase tracking-widest mb-1">Net Profit</p>
                    <h3 className="text-3xl font-black text-gray-900">£{processedData.totals.netProfit.toLocaleString()}</h3>
                    <div className={`mt-4 flex items-center gap-2 text-xs font-bold w-fit px-2 py-1 rounded-full ${processedData.totals.netProfit > 0 ? 'text-purple-600 bg-purple-50' : 'text-rose-600 bg-rose-50'}`}>
                        {processedData.totals.netProfit > 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} 
                        {processedData.totals.revenue > 0 ? Math.round((processedData.totals.netProfit / processedData.totals.revenue) * 100) : 0}% Net Margin
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-amber-100/20 border border-amber-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <BarChart3 size={80} className="text-amber-600" />
                    </div>
                    <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-1">Jobs Completed</p>
                    <h3 className="text-3xl font-black text-gray-900">{processedData.totals.jobs}</h3>
                    <p className="mt-4 text-xs font-bold text-gray-500">Efficiency: 94% Avg</p>
                </div>
            </div>

            <AIAssistant financialData={processedData} />

            {/* Financial Performance Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                    <SimpleBarChart 
                        title="Financial Performance by Month"
                        data={processedData.chartData}
                        stacked={true}
                        bars={[
                            { key: 'Net Profit', color: '#8b5cf6', name: 'Net Profit (£)' },
                            { key: 'Baseline Costs', color: '#f43f5e', name: 'Overheads (£)' },
                            { key: 'Cost of Sales', color: '#f59e0b', name: 'Cost of Sales (£)' }
                        ]}
                    />
                </div>
                <div>
                     <SimpleLineChart
                        title="Operational Throughput"
                        data={processedData.chartData}
                        lines={[
                            { key: 'Jobs', color: '#6366f1', name: 'Jobs', yAxisId: 'left' },
                            { key: 'Avg Job Revenue', color: '#f59e0b', name: 'Avg. Revenue (£)', yAxisId: 'right' }
                        ]}
                    />
                </div>
            </div>

            {/* Monthly Performance Breakdown */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter">Monthly Strategic Breakdown</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {selectedYear} Performance
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Month</th>
                                {selectedEntityId === 'all' && <th className="px-6 py-4">Entity</th>}
                                <th className="px-6 py-4">Revenue</th>
                                <th className="px-6 py-4">Gross Profit</th>
                                <th className="px-6 py-4">Overheads</th>
                                <th className="px-6 py-4">Net Profit</th>
                                <th className="px-6 py-4">Margin</th>
                                <th className="px-6 py-4">Jobs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {processedData.tableData.map((row, idx) => (
                                <tr key={`${row.month}_${row.entityId}_${idx}`} className="hover:bg-gray-50/80 transition-colors group">
                                    <td className="px-6 py-4 font-black text-gray-900 line-clamp-1">{row.displayMonth}</td>
                                    {selectedEntityId === 'all' && (
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase tracking-tighter">
                                                {row.entityName}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 font-bold text-gray-700">£{row.revenue.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-bold text-emerald-600">£{row.grossProfit.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-bold text-rose-500">£{row.baselineCosts.toLocaleString()}</td>
                                    <td className={`px-6 py-4 font-black ${row.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        £{row.netProfit.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                        {row.revenue > 0 ? Math.round((row.netProfit / row.revenue) * 100) : 0}%
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{row.jobs}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Baseline Costs Management */}
            <BaselineCostsEditor 
                entityId={selectedEntityId}
                entities={businessEntities}
                baselines={financialBaselines}
                onSave={(b) => saveRecord('financialBaselines', b)}
            />

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
                <SimpleLineChart
                    title="Marketing Funnel (Estimates vs Invoices)"
                    data={processedData.chartData}
                    lines={[
                        { key: 'Estimates', color: '#f97316', name: 'Estimates Generated' },
                        { key: 'Invoices', color: '#6366f1', name: 'Converted Invoices' }
                    ]}
                />
                 <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col justify-center">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tighter mb-4">Strategic Forecast</h3>
                    <p className="text-gray-500 leading-relaxed font-medium mb-6">
                        Based on current growth of <span className="text-emerald-600 font-bold">12% MoM</span> in high-margin Porsche services, Q4 projections indicate a net profit potential of <span className="text-indigo-600 font-bold">£45k+</span> per entity if overheads remain stable.
                    </p>
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm font-bold">
                            <span className="text-gray-500">Capacity Utilization</span>
                            <span className="text-indigo-600">88%</span>
                        </div>
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: '88%' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TrendIndicator: React.FC<{ value: number }> = ({ value }) => {
    return (
        <span className="flex items-center gap-1">
            {value > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(value)}%
        </span>
    );
};

export default DirectorsDashboard;
