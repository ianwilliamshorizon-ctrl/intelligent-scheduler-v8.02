import React, { useState, useMemo } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';
import { FileText, Download, Printer, Filter, Building2, Calendar, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';

const AgedDebtorsReport: React.FC = () => {
    const { invoices, customers, businessEntities } = useData();
    const { selectedEntityId } = useApp();
    
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterEntityId, setFilterEntityId] = useState(selectedEntityId || 'all');
    const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

    const debtorsData = useMemo(() => {
        // Filter invoices that are not fully paid
        const unpaidInvoices = (invoices || []).filter(inv => {
            if (inv.status === 'Paid' || inv.status === 'Archived') return false;
            
            // Check dates
            const invDate = new Date(inv.issueDate);
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (invDate < start || invDate > end) return false;

            // Check entity
            if (filterEntityId !== 'all' && inv.entityId !== filterEntityId) return false;

            // Calculate balance
            const totalPaid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
            const totalAmount = inv.totalAmount || (inv.lineItems || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
            
            return totalPaid < totalAmount;
        });

        // Group by Business Entity
        const grouped: Record<string, { entityName: string, invoices: any[], totalDue: number }> = {};

        unpaidInvoices.forEach(inv => {
            const entity = businessEntities.find(e => e.id === inv.entityId);
            const entityId = inv.entityId || 'unknown';
            const entityName = entity?.name || 'Unknown Entity';

            if (!grouped[entityId]) {
                grouped[entityId] = { entityName, invoices: [], totalDue: 0 };
            }

            const totalPaid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
            const totalAmount = inv.totalAmount || (inv.lineItems || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
            const balance = totalAmount - totalPaid;

            grouped[entityId].invoices.push({
                ...inv,
                customerName: customers.find(c => c.id === inv.customerId)?.companyName || 
                              `${customers.find(c => c.id === inv.customerId)?.forename} ${customers.find(c => c.id === inv.customerId)?.surname}`,
                balance
            });
            grouped[entityId].totalDue += balance;
        });

        return Object.entries(grouped).map(([id, data]) => ({ id, ...data }));
    }, [invoices, businessEntities, customers, startDate, endDate, filterEntityId]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <FileText size={24} />
                        </div>
                        Aged Debtors Report
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Summary of outstanding balances by business entity</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handlePrint} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all border border-gray-200">
                        <Printer size={18} />
                        Print
                    </button>
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        <Download size={18} />
                        Export CSV
                    </button>
                </div>
            </header>

            {/* Filters */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                        <Building2 size={12} />
                        Business Entity
                    </label>
                    <select 
                        value={filterEntityId}
                        onChange={(e) => setFilterEntityId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                        <option value="all">Everywhere</option>
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
            <div className="space-y-4 print:space-y-0">
                {debtorsData.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                            <Filter size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No Debtors Found</h3>
                        <p className="text-gray-500 max-w-xs mt-2 font-medium">Try adjusting your filters or date range.</p>
                    </div>
                ) : (
                    debtorsData.map((group) => (
                        <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none">
                            <button 
                                onClick={() => setExpandedEntity(expandedEntity === group.id ? null : group.id)}
                                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-1.5 rounded-lg transition-colors ${expandedEntity === group.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                                        {expandedEntity === group.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{group.entityName}</h3>
                                        <p className="text-xs text-gray-500 font-bold">{group.invoices.length} outstanding invoices</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Total Outstanding</div>
                                    <div className="text-xl font-black text-indigo-700">{formatCurrency(group.totalDue)}</div>
                                </div>
                            </button>

                            {expandedEntity === group.id && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white">
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Invoice #</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Date</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Customer</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 text-right">Balance</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Status</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.invoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-gray-900 border-b border-gray-50">{inv.id}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 font-medium border-b border-gray-50">{inv.issueDate}</td>
                                                    <td className="px-6 py-4 font-bold text-gray-700 border-b border-gray-50">{inv.customerName}</td>
                                                    <td className="px-6 py-4 text-right font-black text-rose-600 border-b border-gray-50">{formatCurrency(inv.balance)}</td>
                                                    <td className="px-6 py-4 border-b border-gray-50">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                                            inv.status === 'Overdue' ? 'bg-rose-100 text-rose-700' :
                                                            inv.status === 'Part Paid' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 border-b border-gray-50">
                                                        {inv.notes || (inv.payments || []).find((p: any) => p.notes)?.notes ? (
                                                            <div className="flex items-start gap-2 max-w-xs">
                                                                <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                                                <span className="text-xs text-gray-600 font-medium italic">
                                                                    {inv.notes || (inv.payments || []).find((p: any) => p.notes)?.notes}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs italic">No notes</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AgedDebtorsReport;
