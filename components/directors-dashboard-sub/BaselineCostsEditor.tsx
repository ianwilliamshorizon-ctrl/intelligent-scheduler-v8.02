import React, { useState } from 'react';
import { FinancialBaseline, BusinessEntity } from '../../types';
import { Save, Plus, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface BaselineCostsEditorProps {
    entityId: string;
    entities: BusinessEntity[];
    baselines: FinancialBaseline[];
    onSave: (baseline: FinancialBaseline) => void;
}

const BaselineCostsEditor: React.FC<BaselineCostsEditorProps> = ({ entityId, baselines, onSave }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editData, setEditData] = useState<Partial<FinancialBaseline>>({
        month: format(new Date(), 'yyyy-MM'),
        salaries: 0,
        rentRates: 0,
        utilities: 0,
        nonBudgetedCosts: 0,
        otherOverheads: 0,
        historicalRevenue: 0,
        historicalCostOfSales: 0
    });

    const filteredBaselines = baselines
        .filter(b => entityId === 'all' || b.entityId === entityId)
        .sort((a, b) => b.month.localeCompare(a.month));

    const handleSave = () => {
        if (!editData.month || (entityId === 'all' && !editData.entityId)) return;
        
        onSave({
            id: editData.id || `fb_${Date.now()}`,
            entityId: editData.entityId || entityId,
            month: editData.month,
            salaries: Number(editData.salaries || 0),
            rentRates: Number(editData.rentRates || 0),
            utilities: Number(editData.utilities || 0),
            nonBudgetedCosts: Number(editData.nonBudgetedCosts || 0),
            otherOverheads: Number(editData.otherOverheads || 0),
            historicalRevenue: Number(editData.historicalRevenue || 0),
            historicalCostOfSales: Number(editData.historicalCostOfSales || 0)
        } as FinancialBaseline);
        
        setIsAdding(false);
        setEditData({
            month: format(new Date(), 'yyyy-MM'),
            salaries: 0,
            rentRates: 0,
            utilities: 0,
            nonBudgetedCosts: 0,
            otherOverheads: 0,
            historicalRevenue: 0,
            historicalCostOfSales: 0
        });
    };

    const handleEdit = (baseline: FinancialBaseline) => {
        setEditData(baseline);
        setIsAdding(true);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter">Financial End-of-Month Baseline & Historical Overrides</h3>
                    <p className="text-sm text-gray-500 font-medium">Manage fixed costs, overheads, and pre-go-live historical data</p>
                </div>
                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Plus size={18} /> Add Entry
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="p-6 bg-indigo-50/30 border-b border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 px-1">Month</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={16} />
                                <input 
                                    type="month" 
                                    value={editData.month}
                                    onChange={e => setEditData({...editData, month: e.target.value})}
                                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Salaries (£)</label>
                            <input 
                                type="number" 
                                value={editData.salaries}
                                onChange={e => setEditData({...editData, salaries: Number(e.target.value)})}
                                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Rent/Rates (£)</label>
                            <input 
                                type="number" 
                                value={editData.rentRates}
                                onChange={e => setEditData({...editData, rentRates: Number(e.target.value)})}
                                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Utilities (£)</label>
                            <input 
                                type="number" 
                                value={editData.utilities}
                                onChange={e => setEditData({...editData, utilities: Number(e.target.value)})}
                                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-rose-500 px-1">Non-Budgeted (£)</label>
                            <input 
                                type="number" 
                                value={editData.nonBudgetedCosts}
                                onChange={e => setEditData({...editData, nonBudgetedCosts: Number(e.target.value)})}
                                className="w-full px-3 py-2.5 bg-white border border-rose-100 rounded-xl text-xs focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-bold text-rose-600"
                            />
                        </div>
                        <div className="space-y-1.5 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 px-1">Hist. Revenue (£)</label>
                            <input 
                                type="number" 
                                value={editData.historicalRevenue}
                                onChange={e => setEditData({...editData, historicalRevenue: Number(e.target.value)})}
                                className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-emerald-700"
                            />
                        </div>
                        <div className="space-y-1.5 bg-orange-50 p-2 rounded-xl border border-orange-100">
                            <label className="text-[10px] font-black uppercase tracking-widest text-orange-600 px-1">Hist. COS (£)</label>
                            <input 
                                type="number" 
                                value={editData.historicalCostOfSales}
                                onChange={e => setEditData({...editData, historicalCostOfSales: Number(e.target.value)})}
                                className="w-full px-3 py-2.5 bg-white border border-orange-200 rounded-xl text-xs focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-orange-700"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <button 
                                onClick={handleSave}
                                className="flex-grow flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                            >
                                <Save size={18} /> Save
                            </button>
                            <button 
                                onClick={() => setIsAdding(false)}
                                className="p-2.5 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 transition-all"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <tr>
                            <th className="px-6 py-4">Month</th>
                            <th className="px-6 py-4">Direct Overheads</th>
                            <th className="px-6 py-4">Hist. Revenue</th>
                            <th className="px-6 py-4">Hist. COS</th>
                            <th className="px-6 py-4">Total Overheads</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredBaselines.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No baseline or historical data recorded.</td>
                            </tr>
                        ) : (
                            filteredBaselines.map(baseline => {
                                const overheadsTotal = baseline.salaries + baseline.rentRates + baseline.utilities + baseline.nonBudgetedCosts + (baseline.otherOverheads || 0);
                                return (
                                    <tr key={baseline.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-black text-indigo-600">{format(new Date(baseline.month), 'MMMM yyyy')}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Baseline Records</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] text-gray-500 font-medium">Salaries: £{baseline.salaries.toLocaleString()}</div>
                                            <div className="text-[10px] text-gray-500 font-medium">Rent/Util: £{(baseline.rentRates + baseline.utilities).toLocaleString()}</div>
                                            <div className="text-[10px] text-rose-500 font-bold">Extra: £{baseline.nonBudgetedCosts.toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-4 text-emerald-600 font-black">
                                            £{(baseline.historicalRevenue || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-orange-600 font-black">
                                            £{(baseline.historicalCostOfSales || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-900 rounded-full font-black text-xs">
                                                £{overheadsTotal.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleEdit(baseline)}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Save size={16} /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BaselineCostsEditor;
