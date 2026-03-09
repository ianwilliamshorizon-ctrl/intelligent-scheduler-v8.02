import React, { useState, useMemo } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { SimpleLineChart } from './DirectorsDashboard/charts';
import AIAssistant from './DirectorsDashboard/AIAssistant';
import { subMonths, format, startOfMonth } from 'date-fns';
import { Job, Estimate, Invoice } from '../types';

const DirectorsDashboard: React.FC = () => {
    const { jobs, estimates, invoices } = useData();
    const { businessEntities } = useApp();
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');

    const getSafeDate = (item: any): Date => {
        const dateString = item.issueDate || item.createdAt || item.orderDate;
        return dateString ? new Date(dateString) : new Date('invalid');
    };

    const processedData = useMemo(() => {
        const last12Months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), i))).reverse();
        const monthLabels = last12Months.map(m => format(m, 'MMM yy'));

        const createMonthlyBuckets = () => new Map(monthLabels.map(m => [m, { count: 0, value: 0 }]));

        const allItems = {
            jobs: (jobs || []).filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId),
            estimates: (estimates || []).filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId),
            invoices: (invoices || []).filter(i => selectedEntityId === 'all' || i.entityId === selectedEntityId),
        };
        
        const jobBuckets = createMonthlyBuckets();
        allItems.jobs.forEach(job => {
            const date = getSafeDate(job);
            if (isNaN(date.getTime())) return;

            const month = format(date, 'MMM yy');
            if (jobBuckets.has(month)) {
                const bucket = jobBuckets.get(month)!;
                bucket.count += 1;
                
                const linkedInvoice = (invoices || []).find(inv => inv.jobId === job.id);
                if (linkedInvoice) {
                     bucket.value += linkedInvoice.grandTotal;
                } else {
                    const linkedEstimate = (estimates || []).find(est => est.jobId === job.id);
                    if (linkedEstimate) {
                        bucket.value += linkedEstimate.lineItems.reduce((acc, li) => acc + (li.unitPrice * li.quantity), 0);
                    }
                }
            }
        });

        const estimateBuckets = createMonthlyBuckets();
        allItems.estimates.forEach(est => {
            const date = getSafeDate(est);
            if (isNaN(date.getTime())) return;

            const month = format(date, 'MMM yy');
            if (estimateBuckets.has(month)) {
                const bucket = estimateBuckets.get(month)!;
                bucket.count += 1;
                bucket.value += est.lineItems.reduce((acc, li) => acc + (li.unitPrice * li.quantity), 0);
            }
        });

        const invoiceBuckets = createMonthlyBuckets();
        allItems.invoices.forEach(inv => {
            const date = getSafeDate(inv);
            if (isNaN(date.getTime())) return;

            const month = format(date, 'MMM yy');
            if (invoiceBuckets.has(month)) {
                const bucket = invoiceBuckets.get(month)!;
                bucket.count += 1;
                bucket.value += inv.grandTotal;
            }
        });
        
        const jobsChartData = monthLabels.map(m => ({ month: m, 'Number of Jobs': jobBuckets.get(m)!.count, 'Jobs Value': jobBuckets.get(m)!.value }));
        const estimatesChartData = monthLabels.map(m => ({ month: m, 'Number of Estimates': estimateBuckets.get(m)!.count, 'Estimates Value': estimateBuckets.get(m)!.value }));
        const invoicesChartData = monthLabels.map(m => ({ month: m, 'Number of Invoices': invoiceBuckets.get(m)!.count, 'Invoices Value': invoiceBuckets.get(m)!.value }));
        const avgJobValueChartData = monthLabels.map(m => ({ month: m, 'Average Job Value': jobBuckets.get(m)!.count > 0 ? (jobBuckets.get(m)!.value / jobBuckets.get(m)!.count) : 0}));

        return { jobsChartData, estimatesChartData, invoicesChartData, avgJobValueChartData };
    }, [jobs, estimates, invoices, selectedEntityId]);


    return (
        <div className="p-4 sm:p-6 bg-gray-50/50 min-h-full">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Directors Dashboard</h1>
                <div>
                     <select
                        value={selectedEntityId}
                        onChange={e => setSelectedEntityId(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">All Business Entities</option>
                        {(businessEntities || []).map(entity => (
                            <option key={entity.id} value={entity.id}>{entity.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <AIAssistant />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SimpleLineChart 
                    title="Jobs per Month"
                    data={processedData.jobsChartData}
                    lines={[
                        { key: 'Number of Jobs', color: '#3b82f6', name: 'Number of Jobs', yAxisId: 'left' },
                        { key: 'Jobs Value', color: '#10b981', name: 'Jobs Value (£)', yAxisId: 'right' }
                    ]}
                />
                 <SimpleLineChart
                    title="Average Job Value per Month"
                    data={processedData.avgJobValueChartData}
                    lines={[{ key: 'Average Job Value', color: '#8b5cf6', name: 'Avg. Value (£)' }]}
                />
                <SimpleLineChart
                    title="Estimates per Month"
                    data={processedData.estimatesChartData}
                    lines={[
                        { key: 'Number of Estimates', color: '#f97316', name: 'Number of Estimates', yAxisId: 'left' },
                        { key: 'Estimates Value', color: '#ef4444', name: 'Estimates Value (£)', yAxisId: 'right' }
                    ]}
                />
                 <SimpleLineChart
                    title="Invoices per Month"
                    data={processedData.invoicesChartData}
                    lines={[
                        { key: 'Number of Invoices', color: '#0ea5e9', name: 'Number of Invoices', yAxisId: 'left' },
                        { key: 'Invoices Value', color: '#6366f1', name: 'Invoices Value (£)', yAxisId: 'right' }
                    ]}
                />
            </div>
        </div>
    );
};

export default DirectorsDashboard;
