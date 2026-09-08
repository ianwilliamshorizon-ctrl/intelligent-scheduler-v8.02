import React, { useMemo } from 'react';
import { Job, Estimate, Invoice, PurchaseOrder, BusinessEntity } from '../../types';
import { format, parse, isValid } from 'date-fns';
import { SimpleBarChart, SimpleLineChart } from './charts';
import { 
    Download, TrendingUp, TrendingDown, DollarSign, 
    FileText, ShoppingBag, Layers, Percent, ArrowUpRight, BarChart3
} from 'lucide-react';

interface MonthlyKpiTabProps {
    jobs: Job[];
    estimates: Estimate[];
    invoices: Invoice[];
    purchaseOrders: PurchaseOrder[];
    selectedEntityId: string;
    selectedYear: string;
    businessEntities: BusinessEntity[];
}

interface MonthMetrics {
    monthKey: string;
    monthName: string;
    displayMonth: string;
    // Estimates
    estimatesCount: number;
    estimatesValue: number;
    convertedEstimatesCount: number;
    convertedEstimatesValue: number;
    conversionRate: number;
    // Bookings (Jobs)
    bookingsCount: number;
    bookingsValue: number;
    bookingsCost: number;
    bookingsMargin: number;
    bookingsMarginPercent: number;
    avgBookingValue: number;
    // Purchase Orders
    poCount: number;
    poValue: number;
    poRatioToBookings: number;
    // Invoices
    invoicesCount: number;
    invoicedValue: number;
    invoicedRealization: number;
}

export const MonthlyKpiTab: React.FC<MonthlyKpiTabProps> = ({
    jobs = [],
    estimates = [],
    invoices = [],
    purchaseOrders = [],
    selectedEntityId,
    selectedYear,
    businessEntities = []
}) => {
    const getSafeDate = (item: any): Date | null => {
        const dateString = item.orderDate || item.issueDate || item.createdAt || item.scheduledDate;
        if (!dateString) return null;
        const d = new Date(dateString);
        return isValid(d) ? d : null;
    };

    // Calculate job financials
    const getJobFinancials = (job: Job, allEstimates: Estimate[], allInvoices: Invoice[]) => {
        let items = (job.lineItems && job.lineItems.length > 0) ? job.lineItems : null;
        if (!items && job.estimateId) {
            const est = allEstimates.find(e => e.id === job.estimateId);
            if (est && est.lineItems?.length) items = est.lineItems;
        }
        if (!items && job.invoiceId) {
            const inv = allInvoices.find(i => i.id === job.invoiceId);
            if (inv && inv.lineItems?.length) items = inv.lineItems;
        }
        const safeItems = items || [];
        const revenue = safeItems.reduce((sum: number, li: any) => sum + (li.isOptional ? 0 : ((li.unitPrice || 0) * (li.quantity || 1))), 0);
        const cost = safeItems.reduce((sum: number, li: any) => sum + ((li.unitCost || 0) * (li.quantity || 1)), 0);
        const margin = revenue - cost;
        return { revenue, cost, margin };
    };

    const monthlyData = useMemo(() => {
        const yearInt = parseInt(selectedYear, 10) || new Date().getFullYear();
        const months: MonthMetrics[] = [];

        // Pre-filter by entity
        const entFilteredJobs = jobs.filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId);
        const entFilteredEstimates = estimates.filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId);
        const entFilteredInvoices = invoices.filter(i => selectedEntityId === 'all' || i.entityId === selectedEntityId);
        const entFilteredPOs = purchaseOrders.filter(p => selectedEntityId === 'all' || p.entityId === selectedEntityId);

        for (let i = 0; i < 12; i++) {
            const monthDate = new Date(yearInt, i, 1);
            const monthKey = format(monthDate, 'yyyy-MM');
            const monthName = format(monthDate, 'MMMM yyyy');
            const displayMonth = format(monthDate, 'MMM');

            // 1. Estimates in this month
            let estimatesCount = 0;
            let estimatesValue = 0;
            let convertedEstimatesCount = 0;
            let convertedEstimatesValue = 0;

            entFilteredEstimates.forEach(est => {
                const d = getSafeDate(est);
                if (!d || format(d, 'yyyy-MM') !== monthKey) return;
                estimatesCount++;
                const val = (est.lineItems || []).reduce((acc, li) => acc + (li.isOptional ? 0 : ((li.unitPrice || 0) * (li.quantity || 1))), 0);
                estimatesValue += val;

                const isConverted = est.status === 'Converted to Job' || !!est.jobId || est.status === 'Approved';
                if (isConverted) {
                    convertedEstimatesCount++;
                    convertedEstimatesValue += val;
                }
            });

            const conversionRate = estimatesCount > 0 ? (convertedEstimatesCount / estimatesCount) * 100 : 0;

            // 2. Bookings (Jobs) in this month
            let bookingsCount = 0;
            let bookingsValue = 0;
            let bookingsCost = 0;

            entFilteredJobs.forEach(job => {
                const d = getSafeDate(job);
                if (!d || format(d, 'yyyy-MM') !== monthKey) return;
                bookingsCount++;
                const { revenue, cost } = getJobFinancials(job, estimates, invoices);
                bookingsValue += revenue;
                bookingsCost += cost;
            });

            const bookingsMargin = bookingsValue - bookingsCost;
            const bookingsMarginPercent = bookingsValue > 0 ? (bookingsMargin / bookingsValue) * 100 : 0;
            const avgBookingValue = bookingsCount > 0 ? bookingsValue / bookingsCount : 0;

            // 3. Purchase Orders in this month
            let poCount = 0;
            let poValue = 0;

            entFilteredPOs.forEach(po => {
                const d = getSafeDate(po);
                if (!d || format(d, 'yyyy-MM') !== monthKey) return;
                poCount++;
                const cost = (po.lineItems || []).reduce((acc, li) => acc + ((li.unitPrice || 0) * (li.quantity || 1)), 0);
                poValue += cost;
            });

            const poRatioToBookings = bookingsValue > 0 ? (poValue / bookingsValue) * 100 : 0;

            // 4. Invoices in this month
            let invoicesCount = 0;
            let invoicedValue = 0;

            entFilteredInvoices.forEach(inv => {
                const d = getSafeDate(inv);
                if (!d || format(d, 'yyyy-MM') !== monthKey) return;
                invoicesCount++;
                const val = inv.totalAmount || (inv.lineItems || []).reduce((acc: number, li: any) => acc + ((li.unitPrice || 0) * (li.quantity || 1)), 0);
                invoicedValue += val;
            });

            const invoicedRealization = bookingsValue > 0 ? (invoicedValue / bookingsValue) * 100 : 0;

            months.push({
                monthKey,
                monthName,
                displayMonth,
                estimatesCount,
                estimatesValue: Math.round(estimatesValue),
                convertedEstimatesCount,
                convertedEstimatesValue: Math.round(convertedEstimatesValue),
                conversionRate: Math.round(conversionRate * 10) / 10,
                bookingsCount,
                bookingsValue: Math.round(bookingsValue),
                bookingsCost: Math.round(bookingsCost),
                bookingsMargin: Math.round(bookingsMargin),
                bookingsMarginPercent: Math.round(bookingsMarginPercent * 10) / 10,
                avgBookingValue: Math.round(avgBookingValue),
                poCount,
                poValue: Math.round(poValue),
                poRatioToBookings: Math.round(poRatioToBookings * 10) / 10,
                invoicesCount,
                invoicedValue: Math.round(invoicedValue),
                invoicedRealization: Math.round(invoicedRealization * 10) / 10,
            });
        }

        return months;
    }, [jobs, estimates, invoices, purchaseOrders, selectedEntityId, selectedYear]);

    // Full Year Totals and Averages
    const yearTotals = useMemo(() => {
        const initial = {
            estimatesCount: 0,
            estimatesValue: 0,
            convertedEstimatesCount: 0,
            convertedEstimatesValue: 0,
            bookingsCount: 0,
            bookingsValue: 0,
            bookingsCost: 0,
            bookingsMargin: 0,
            poCount: 0,
            poValue: 0,
            invoicesCount: 0,
            invoicedValue: 0,
        };

        const sums = monthlyData.reduce((acc, m) => {
            acc.estimatesCount += m.estimatesCount;
            acc.estimatesValue += m.estimatesValue;
            acc.convertedEstimatesCount += m.convertedEstimatesCount;
            acc.convertedEstimatesValue += m.convertedEstimatesValue;
            acc.bookingsCount += m.bookingsCount;
            acc.bookingsValue += m.bookingsValue;
            acc.bookingsCost += m.bookingsCost;
            acc.bookingsMargin += m.bookingsMargin;
            acc.poCount += m.poCount;
            acc.poValue += m.poValue;
            acc.invoicesCount += m.invoicesCount;
            acc.invoicedValue += m.invoicedValue;
            return acc;
        }, initial);

        const conversionRate = sums.estimatesCount > 0 ? (sums.convertedEstimatesCount / sums.estimatesCount) * 100 : 0;
        const bookingsMarginPercent = sums.bookingsValue > 0 ? (sums.bookingsMargin / sums.bookingsValue) * 100 : 0;
        const avgBookingValue = sums.bookingsCount > 0 ? sums.bookingsValue / sums.bookingsCount : 0;
        const poRatioToBookings = sums.bookingsValue > 0 ? (sums.poValue / sums.bookingsValue) * 100 : 0;
        const invoicedRealization = sums.bookingsValue > 0 ? (sums.invoicedValue / sums.bookingsValue) * 100 : 0;

        return {
            ...sums,
            conversionRate: Math.round(conversionRate * 10) / 10,
            bookingsMarginPercent: Math.round(bookingsMarginPercent * 10) / 10,
            avgBookingValue: Math.round(avgBookingValue),
            poRatioToBookings: Math.round(poRatioToBookings * 10) / 10,
            invoicedRealization: Math.round(invoicedRealization * 10) / 10,
        };
    }, [monthlyData]);

    // Chart formatted data
    const chartData = useMemo(() => {
        return monthlyData.map(m => ({
            month: m.displayMonth,
            'Estimates Quoted': m.estimatesCount,
            'Bookings Created': m.bookingsCount,
            'Invoices Issued': m.invoicesCount,
            'Booking Value': m.bookingsValue,
            'Booking Margin': m.bookingsMargin,
            'PO Parts Spend': m.poValue,
        }));
    }, [monthlyData]);

    // Export to CSV
    const exportCsv = () => {
        const entityLabel = selectedEntityId === 'all' 
            ? 'All_Entities' 
            : (businessEntities.find(e => e.id === selectedEntityId)?.name || 'Entity').replace(/\s+/g, '_');
        
        const headers = [
            'Month',
            'Estimates Count',
            'Estimates Quoted Value (£)',
            'Converted Estimates Count',
            'Conversion Rate (%)',
            'Bookings Count',
            'Bookings Total Value (£)',
            'Bookings Direct Cost (£)',
            'Bookings Margin Value (£)',
            'Bookings Margin (%)',
            'Avg Booking Value (£)',
            'Purchase Orders Count',
            'PO Total Spend (£)',
            'PO Ratio to Bookings (%)',
            'Invoices Count',
            'Invoiced Total Value (£)',
            'Invoiced Realization (%)'
        ];

        const rows = monthlyData.map(m => [
            `"${m.monthName}"`,
            m.estimatesCount,
            m.estimatesValue,
            m.convertedEstimatesCount,
            `${m.conversionRate}%`,
            m.bookingsCount,
            m.bookingsValue,
            m.bookingsCost,
            m.bookingsMargin,
            `${m.bookingsMarginPercent}%`,
            m.avgBookingValue,
            m.poCount,
            m.poValue,
            `${m.poRatioToBookings}%`,
            m.invoicesCount,
            m.invoicedValue,
            `${m.invoicedRealization}%`
        ]);

        // Add summary row
        rows.push([
            `"FULL YEAR ${selectedYear} TOTAL/AVG"`,
            yearTotals.estimatesCount,
            yearTotals.estimatesValue,
            yearTotals.convertedEstimatesCount,
            `${yearTotals.conversionRate}%`,
            yearTotals.bookingsCount,
            yearTotals.bookingsValue,
            yearTotals.bookingsCost,
            yearTotals.bookingsMargin,
            `${yearTotals.bookingsMarginPercent}%`,
            yearTotals.avgBookingValue,
            yearTotals.poCount,
            yearTotals.poValue,
            `${yearTotals.poRatioToBookings}%`,
            yearTotals.invoicesCount,
            yearTotals.invoicedValue,
            `${yearTotals.invoicedRealization}%`
        ]);

        const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Monthly_KPIs_${selectedYear}_${entityLabel}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            {/* Top Year Summary Hero Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Estimates Card */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-amber-100/20 border border-amber-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <FileText size={80} className="text-amber-600" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Estimates Quoted</p>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {yearTotals.estimatesCount} quotes
                        </span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">£{yearTotals.estimatesValue.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Conversion Rate</span>
                        <span className={`px-2 py-0.5 rounded-full font-black ${yearTotals.conversionRate >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {yearTotals.conversionRate}% ({yearTotals.convertedEstimatesCount} booked)
                        </span>
                    </div>
                </div>

                {/* Bookings Card */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-indigo-100/20 border border-indigo-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <Layers size={80} className="text-indigo-600" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Bookings (Jobs)</p>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            {yearTotals.bookingsCount} jobs
                        </span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">£{yearTotals.bookingsValue.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Avg Booking Value</span>
                        <span className="text-indigo-600 font-black">£{yearTotals.avgBookingValue.toLocaleString()}</span>
                    </div>
                </div>

                {/* Margin Card */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-emerald-100/20 border border-emerald-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <DollarSign size={80} className="text-emerald-600" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Bookings Margin</p>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            {yearTotals.bookingsMarginPercent}% margin
                        </span>
                    </div>
                    <h3 className="text-3xl font-black text-emerald-600">£{yearTotals.bookingsMargin.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Direct Job Costs</span>
                        <span className="text-gray-500 font-black">£{yearTotals.bookingsCost.toLocaleString()}</span>
                    </div>
                </div>

                {/* POs / Procurement Card */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-purple-100/20 border border-purple-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <ShoppingBag size={80} className="text-purple-600" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-black text-purple-600 uppercase tracking-widest">Purchase Orders</p>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                            {yearTotals.poCount} orders
                        </span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">£{yearTotals.poValue.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>PO / Booking Ratio</span>
                        <span className="text-purple-600 font-black">{yearTotals.poRatioToBookings}%</span>
                    </div>
                </div>
            </div>

            {/* Visual Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                    <SimpleBarChart
                        title="Monthly Activity Funnel (Estimates vs Bookings vs Invoices)"
                        data={chartData}
                        bars={[
                            { key: 'Estimates Quoted', color: '#f59e0b', name: 'Estimates Quoted' },
                            { key: 'Bookings Created', color: '#6366f1', name: 'Bookings Created' },
                            { key: 'Invoices Issued', color: '#10b981', name: 'Invoices Issued' },
                        ]}
                    />
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                    <SimpleLineChart
                        title="Booking Financials & Procurement by Month"
                        data={chartData}
                        lines={[
                            { key: 'Booking Value', color: '#6366f1', name: 'Booking Value (£)', yAxisId: 'left' },
                            { key: 'Booking Margin', color: '#10b981', name: 'Margin (£)', yAxisId: 'left' },
                            { key: 'PO Parts Spend', color: '#ec4899', name: 'PO Spend (£)', yAxisId: 'left' },
                        ]}
                    />
                </div>
            </div>

            {/* Detailed Monthly KPI Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tighter">Month-by-Month Business KPIs</h3>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                            Comprehensive operational and commercial metrics for {selectedYear}
                        </p>
                    </div>
                    <button
                        onClick={exportCsv}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        <Download size={15} />
                        Export Monthly KPIs (CSV)
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3.5 sticky left-0 bg-gray-50 z-10">Month</th>
                                <th className="px-4 py-3.5 text-center bg-amber-50/40 text-amber-800" colSpan={3}>
                                    Estimates Quoted
                                </th>
                                <th className="px-4 py-3.5 text-center bg-indigo-50/40 text-indigo-800" colSpan={4}>
                                    Bookings & Performance
                                </th>
                                <th className="px-4 py-3.5 text-center bg-emerald-50/40 text-emerald-800" colSpan={2}>
                                    Margin
                                </th>
                                <th className="px-4 py-3.5 text-center bg-purple-50/40 text-purple-800" colSpan={2}>
                                    Purchase Orders
                                </th>
                                <th className="px-4 py-3.5 text-center bg-slate-50 text-slate-700" colSpan={2}>
                                    Invoicing
                                </th>
                            </tr>
                            <tr className="border-b border-gray-100 text-[9px] text-gray-500 bg-white">
                                <th className="px-5 py-2 sticky left-0 bg-white z-10">Period</th>
                                {/* Estimates */}
                                <th className="px-3 py-2 text-right">Count</th>
                                <th className="px-3 py-2 text-right">Value (£)</th>
                                <th className="px-3 py-2 text-center">Conv. Rate</th>
                                {/* Bookings */}
                                <th className="px-3 py-2 text-right">Count</th>
                                <th className="px-3 py-2 text-right">Value (£)</th>
                                <th className="px-3 py-2 text-right">Cost (£)</th>
                                <th className="px-3 py-2 text-right">Avg Val (£)</th>
                                {/* Margin */}
                                <th className="px-3 py-2 text-right">Margin (£)</th>
                                <th className="px-3 py-2 text-center">Margin %</th>
                                {/* POs */}
                                <th className="px-3 py-2 text-right">Count</th>
                                <th className="px-3 py-2 text-right">Spend (£)</th>
                                {/* Invoicing */}
                                <th className="px-3 py-2 text-right">Count</th>
                                <th className="px-3 py-2 text-right">Invoiced (£)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {monthlyData.map((row) => (
                                <tr key={row.monthKey} className="hover:bg-indigo-50/20 transition-colors">
                                    <td className="px-5 py-3 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100 whitespace-nowrap">
                                        {row.monthName}
                                    </td>
                                    {/* Estimates */}
                                    <td className="px-3 py-3 text-right font-medium text-gray-600">{row.estimatesCount}</td>
                                    <td className="px-3 py-3 text-right font-bold text-gray-800">£{row.estimatesValue.toLocaleString()}</td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            row.estimatesCount === 0 
                                                ? 'bg-gray-100 text-gray-400' 
                                                : row.conversionRate >= 60 
                                                    ? 'bg-emerald-50 text-emerald-700' 
                                                    : row.conversionRate >= 35 
                                                        ? 'bg-amber-50 text-amber-700' 
                                                        : 'bg-rose-50 text-rose-700'
                                        }`}>
                                            {row.conversionRate}%
                                        </span>
                                    </td>
                                    {/* Bookings */}
                                    <td className="px-3 py-3 text-right font-black text-indigo-600">{row.bookingsCount}</td>
                                    <td className="px-3 py-3 text-right font-bold text-gray-900">£{row.bookingsValue.toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-medium text-gray-500">£{row.bookingsCost.toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-medium text-gray-700">£{row.avgBookingValue.toLocaleString()}</td>
                                    {/* Margin */}
                                    <td className={`px-3 py-3 text-right font-black ${row.bookingsMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        £{row.bookingsMargin.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            row.bookingsCount === 0 
                                                ? 'bg-gray-100 text-gray-400' 
                                                : row.bookingsMarginPercent >= 45 
                                                    ? 'bg-emerald-50 text-emerald-700' 
                                                    : row.bookingsMarginPercent >= 25 
                                                        ? 'bg-amber-50 text-amber-700' 
                                                        : 'bg-rose-50 text-rose-700'
                                        }`}>
                                            {row.bookingsMarginPercent}%
                                        </span>
                                    </td>
                                    {/* POs */}
                                    <td className="px-3 py-3 text-right font-medium text-purple-700">{row.poCount}</td>
                                    <td className="px-3 py-3 text-right font-bold text-purple-900">£{row.poValue.toLocaleString()}</td>
                                    {/* Invoicing */}
                                    <td className="px-3 py-3 text-right font-medium text-gray-600">{row.invoicesCount}</td>
                                    <td className="px-3 py-3 text-right font-bold text-gray-900">£{row.invoicedValue.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        {/* Summary Total Row */}
                        <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-200">
                            <tr>
                                <td className="px-5 py-4 sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                                    YEAR {selectedYear} TOTAL / AVG
                                </td>
                                {/* Estimates Total */}
                                <td className="px-3 py-4 text-right">{yearTotals.estimatesCount}</td>
                                <td className="px-3 py-4 text-right">£{yearTotals.estimatesValue.toLocaleString()}</td>
                                <td className="px-3 py-4 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-black">
                                        {yearTotals.conversionRate}%
                                    </span>
                                </td>
                                {/* Bookings Total */}
                                <td className="px-3 py-4 text-right text-indigo-700">{yearTotals.bookingsCount}</td>
                                <td className="px-3 py-4 text-right">£{yearTotals.bookingsValue.toLocaleString()}</td>
                                <td className="px-3 py-4 text-right">£{yearTotals.bookingsCost.toLocaleString()}</td>
                                <td className="px-3 py-4 text-right">£{yearTotals.avgBookingValue.toLocaleString()}</td>
                                {/* Margin Total */}
                                <td className="px-3 py-4 text-right text-emerald-700">£{yearTotals.bookingsMargin.toLocaleString()}</td>
                                <td className="px-3 py-4 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-black">
                                        {yearTotals.bookingsMarginPercent}%
                                    </span>
                                </td>
                                {/* POs Total */}
                                <td className="px-3 py-4 text-right text-purple-800">{yearTotals.poCount}</td>
                                <td className="px-3 py-4 text-right">£{yearTotals.poValue.toLocaleString()}</td>
                                {/* Invoicing Total */}
                                <td className="px-3 py-4 text-right">{yearTotals.invoicesCount}</td>
                                <td className="px-3 py-4 text-right">£{yearTotals.invoicedValue.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MonthlyKpiTab;
