import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';
import { FileText, Download, Printer, ListFilter, Wallet, Group, Building2, Calendar, Filter, ChevronDown, ChevronRight, CreditCard } from 'lucide-react';
import Papa from 'papaparse';
import { useReactToPrint } from 'react-to-print';

const FinancialReporting: React.FC = () => {
    const { invoices, customers, businessEntities } = useData();
    const { selectedEntityId, currentUser } = useApp();
    const componentRef = useRef<HTMLDivElement>(null);
    
    const triggerPrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Financial_Report_${new Date().toISOString().split('T')[0]}`,
    });
    
    const [reportMode, setReportMode] = useState<'aged' | 'all'>('aged');
    const [groupBy, setGroupBy] = useState<'entity' | 'method'>('entity');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterEntityId, setFilterEntityId] = useState(selectedEntityId || 'all');
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => 
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const reportData = useMemo(() => {
        // Filter invoices based on criteria
        const filteredInvoices = (invoices || []).filter(inv => {
            // Check entity
            if (filterEntityId !== 'all' && inv.entityId !== filterEntityId) return false;

            // Date filtering
            const invDate = new Date(inv.issueDate);
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (invDate < start || invDate > end) return false;

            // Mode filtering
            if (reportMode === 'aged') {
                if (inv.status === 'Paid' || inv.status === 'Archived') return false;
                const totalPaid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
                const totalAmount = inv.totalAmount || (inv.lineItems || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
                return totalPaid < totalAmount;
            }

            return true;
        });

        const grouped: Record<string, { groupName: string, items: any[], totalValue: number, totalDue?: number }> = {};

        if (groupBy === 'entity') {
            filteredInvoices.forEach(inv => {
                const entity = businessEntities.find(e => e.id === inv.entityId);
                const gId = inv.entityId || 'unknown';
                const groupName = entity?.name || 'Unknown Entity';

                if (!grouped[gId]) {
                    grouped[gId] = { groupName, items: [], totalValue: 0, totalDue: 0 };
                }

                const totalPaid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
                const totalAmount = inv.totalAmount || (inv.lineItems || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
                const balance = totalAmount - totalPaid;

                grouped[gId].items.push({
                    ...inv,
                    customerName: customers.find(c => c.id === inv.customerId)?.companyName || 
                                   `${customers.find(c => c.id === inv.customerId)?.forename} ${customers.find(c => c.id === inv.customerId)?.surname}`,
                    balance,
                    totalAmount,
                    primaryMethod: inv.payments?.[0]?.method || 'N/A'
                });
                grouped[gId].totalValue += totalAmount;
                if (grouped[gId].totalDue !== undefined) grouped[gId].totalDue += balance;
            });
        } else {
            // Group by primary payment method
            filteredInvoices.forEach(inv => {
                const method = inv.payments?.[0]?.method || 'Unpaid/Other';
                const gId = method;
                const groupName = method;

                if (!grouped[gId]) {
                    grouped[gId] = { groupName, items: [], totalValue: 0, totalDue: 0 };
                }

                const totalPaid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
                const totalAmount = inv.totalAmount || (inv.lineItems || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
                const balance = totalAmount - totalPaid;

                grouped[gId].items.push({
                    ...inv,
                    customerName: customers.find(c => c.id === inv.customerId)?.companyName || 
                                   `${customers.find(c => c.id === inv.customerId)?.forename} ${customers.find(c => c.id === inv.customerId)?.surname}`,
                    balance,
                    totalAmount,
                    entityName: businessEntities.find(e => e.id === inv.entityId)?.name || 'Unknown'
                });
                grouped[gId].totalValue += totalAmount;
                if (grouped[gId].totalDue !== undefined) grouped[gId].totalDue += balance;
            });
        }

        // Sort groups alphabetically by name
        return Object.entries(grouped)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => a.groupName.localeCompare(b.groupName));
    }, [invoices, businessEntities, customers, startDate, endDate, filterEntityId, reportMode, groupBy]);

    const handlePrint = () => {
        triggerPrint();
    };

    const handleExport = () => {
        const flatData = reportData.flatMap(group => 
            group.items.map(inv => ({
                Group: group.groupName,
                ID: inv.id,
                Date: inv.issueDate,
                Customer: inv.customerName,
                Status: inv.status,
                Method: inv.primaryMethod || (groupBy === 'method' ? group.groupName : 'N/A'),
                Total: inv.totalAmount,
                Balance: inv.balance || 0,
                FinanceNotes: inv.financeNotes || ''
            }))
        );

        const csv = Papa.unparse(flatData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Brookspeed_Financial_Report_${formatDate(new Date())}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100 flex-shrink-0">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-none">
                            Financial Reporting
                        </h1>
                        <p className="text-[10px] md:text-sm text-gray-500 font-bold mt-1 uppercase tracking-wider">
                            {reportMode === 'aged' ? 'Outstanding Balances Only' : 'Transaction Revenue Analysis'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200 w-full lg:w-auto overflow-x-auto">
                    <button 
                        onClick={() => setReportMode('aged')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all whitespace-nowrap ${reportMode === 'aged' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Wallet size={16} />
                        Aged Debtors
                    </button>
                    <button 
                        onClick={() => setReportMode('all')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all whitespace-nowrap ${reportMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <ListFilter size={16} />
                        All Transactions
                    </button>
                </div>

                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto">
                    <button onClick={() => setGroupBy(groupBy === 'entity' ? 'method' : 'entity')} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all border border-gray-200 whitespace-nowrap">
                        <Group size={18} className="text-indigo-600" />
                        Group by {groupBy === 'entity' ? 'Method' : 'Entity'}
                    </button>
                    <button onClick={() => handlePrint()} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all border border-gray-200 whitespace-nowrap">
                        <Printer size={18} />
                        Print
                    </button>
                    <button onClick={handleExport} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 whitespace-nowrap">
                        <Download size={18} />
                        Export
                    </button>
                </div>
            </header>

            {/* Filters */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                        <Building2 size={12} />
                        Entity Visibility
                    </label>
                    <select 
                        value={filterEntityId}
                        onChange={(e) => setFilterEntityId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                        <option value="all">Consolidated View (All Entities)</option>
                        {businessEntities.map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                        <Calendar size={12} />
                        From Date
                    </label>
                    <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                        <Calendar size={12} />
                        To Date
                    </label>
                    <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>
            </section>

            {/* Report Content */}
            <div ref={componentRef} className="rebuild-print-container space-y-4 print:p-0 print:m-0">
                <div className="hidden print:flex flex-col mb-8 border-b-4 border-gray-900 pb-4">
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">
                        Financial Reporting - {reportMode === 'aged' ? 'Aged Debtors' : 'Transaction Analysis'}
                    </h1>
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                {filterEntityId === 'all' ? 'CONSOLIDATED' : businessEntities.find(e => e.id === filterEntityId)?.name}
                            </span>
                            <span className="text-xs font-bold text-gray-500">PERIOD: {startDate} TO {endDate}</span>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page 1 of report</span>
                    </div>
                </div>

                {reportData.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center no-print">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                            <Filter size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No data for selected period</h3>
                        <p className="text-gray-500 max-w-xs mt-2 font-medium">Try broadening your date range or entity selection.</p>
                    </div>
                ) : (
                    reportData.map((group) => {
                        const isExpanded = expandedGroups.includes(group.id) || typeof window === 'undefined';
                        return (
                            <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none print:break-inside-avoid print:mb-8">
                                <button 
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full px-6 py-5 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100 group no-print"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl transition-all shadow-sm ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tighter text-lg flex items-center gap-2">
                                                {groupBy === 'method' && <CreditCard size={18} className="text-indigo-500" />}
                                                {group.groupName}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{group.items.length} records</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-8">
                                        <div className="text-right">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Sub-Total</div>
                                            <div className="text-lg font-black text-gray-900">{formatCurrency(group.totalValue)}</div>
                                        </div>
                                        {reportMode === 'aged' && (
                                            <div className="text-right border-l border-gray-200 pl-8">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Balance Due</div>
                                                <div className="text-lg font-black text-rose-600">{formatCurrency(group.totalDue || 0)}</div>
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* Print Header */}
                                <div className="hidden print:flex justify-between items-end border-b-2 border-gray-200 pb-2 mb-4">
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                                        {groupBy === 'method' && <CreditCard size={18} />}
                                        {group.groupName}
                                    </h2>
                                    <div className="flex gap-6 text-sm">
                                        <div><span className="font-bold text-gray-400 mr-2 uppercase text-[10px]">Ttl:</span> <span className="font-black">{formatCurrency(group.totalValue)}</span></div>
                                        {reportMode === 'aged' && <div><span className="font-bold text-gray-400 mr-2 uppercase text-[10px]">Due:</span> <span className="font-black text-rose-600">{formatCurrency(group.totalDue || 0)}</span></div>}
                                    </div>
                                </div>

                                <div className={`overflow-x-auto ${isExpanded ? 'block' : 'hidden print:block'}`}>
                                    <table className="w-full text-left border-collapse print:border-2 print:border-gray-800">
                                        <thead className="print:table-header-group">
                                            <tr className="bg-white">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Date</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Ref #</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Customer</th>
                                                {groupBy === 'method' && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Entity</th>}
                                                {groupBy === 'entity' && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Method</th>}
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 text-right print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Amount</th>
                                                {reportMode === 'aged' && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 text-right print:py-2 print:text-black print:px-2 print:border-b-2 print:border-gray-800">Balance</th>}
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 print:py-2 text-center print:text-black print:px-2 print:border-b-2 print:border-gray-800">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 print:table-row-group">
                                            {group.items.map((inv) => (
                                                <React.Fragment key={inv.id}>
                                                    <tr className="hover:bg-gray-50/50 transition-colors print:hover:bg-transparent print:border-b-2 print:border-gray-300">
                                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 border-b border-gray-50 print:py-2 print:text-black print:px-2">{inv.issueDate}</td>
                                                        <td className="px-6 py-4 font-bold text-gray-900 border-b border-gray-50 print:py-2 print:px-2">{inv.id}</td>
                                                        <td className="px-6 py-4 font-bold text-gray-700 border-b border-gray-50 truncate max-w-[150px] print:py-2 print:px-2">{inv.customerName}</td>
                                                        {groupBy === 'method' && <td className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase border-b border-gray-50 print:py-2 print:px-2">{inv.entityName}</td>}
                                                        {groupBy === 'entity' && <td className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase border-b border-gray-50 print:py-2 print:px-2">{inv.primaryMethod}</td>}
                                                        <td className="px-6 py-4 text-right font-black text-gray-900 border-b border-gray-50 print:py-2 print:px-2">{formatCurrency(inv.totalAmount)}</td>
                                                        {reportMode === 'aged' && (
                                                            <td className="px-6 py-4 text-right font-black text-rose-600 border-b border-gray-50 print:py-2">{formatCurrency(inv.balance)}</td>
                                                        )}
                                                        <td className="px-6 py-4 border-b border-gray-50 print:py-2 text-center print:px-2">
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight print:border print:border-gray-800 print:text-black ${
                                                                inv.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                                                inv.status === 'Overdue' ? 'bg-rose-100 text-rose-700' :
                                                                inv.status === 'Part Paid' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {inv.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {inv.financeNotes && (
                                                        <tr className="bg-indigo-50/20">
                                                            <td colSpan={groupBy === 'method' || groupBy === 'entity' ? 7 : 6} className="px-10 py-2 text-[10px] font-bold text-indigo-700 border-b border-indigo-100/50">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1 h-1 bg-indigo-400 rounded-full" />
                                                                    <span className="uppercase tracking-widest opacity-70">Finance Note:</span>
                                                                    {inv.financeNotes}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}

                <div className="hidden print:block pt-8 border-t-4 border-gray-900 mt-12">
                    <div className="flex justify-between items-start">
                        <div className="max-w-md">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes / Reconciliation</h4>
                            <p className="text-[10px] text-gray-500 italic">
                                This report contains confidential financial data for the period {startDate} to {endDate}. 
                                All figures are inclusive of VAT where applicable. 
                                Payment methods listed are primary methods associated with the final transaction status.
                            </p>
                        </div>
                        <div className="text-right space-y-3 min-w-[250px]">
                             <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
                                <span className="text-xs font-black text-gray-500 uppercase">Period Total:</span>
                                <span className="text-xl font-black text-gray-900">{formatCurrency(reportData.reduce((sum, g) => sum + g.totalValue, 0))}</span>
                             </div>
                             {reportMode === 'aged' && (
                                <div className="flex justify-between items-center bg-rose-50 px-4 py-2 rounded-lg">
                                    <span className="text-xs font-black text-rose-600 uppercase tracking-tighter">Total Arrears:</span>
                                    <span className="text-xl font-black text-rose-700">{formatCurrency(reportData.reduce((sum, g) => sum + (g.totalDue || 0), 0))}</span>
                                </div>
                             )}
                        </div>
                    </div>
                    <div className="mt-8 text-center text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">
                        Brookspeed Intelligent Scheduling - Internal Financial Audit
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialReporting;
