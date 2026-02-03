import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { NominalCode, NominalCodeRule } from '../../../types';
import { PlusCircle, Calculator, Zap, ShieldCheck, Tag, Fingerprint, SearchX } from 'lucide-react';
import NominalCodeFormModal from '../../NominalCodeFormModal';
import NominalCodeRuleFormModal from '../../NominalCodeRuleFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementNominalCodesTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { 
        nominalCodes = [], 
        setNominalCodes, 
        nominalCodeRules = [], 
        setNominalCodeRules, 
        businessEntities = [], 
        refreshActiveData 
    } = useData();

    // Local state for snappy UI updates
    const [localCodes, setLocalCodes] = useState<NominalCode[]>(Array.isArray(nominalCodes) ? nominalCodes : []);
    const [localRules, setLocalRules] = useState<NominalCodeRule[]>(Array.isArray(nominalCodeRules) ? nominalCodeRules : []);

    useEffect(() => { setLocalCodes(Array.isArray(nominalCodes) ? nominalCodes : []); }, [nominalCodes]);
    useEffect(() => { setLocalRules(Array.isArray(nominalCodeRules) ? nominalCodeRules : []); }, [nominalCodeRules]);

    const codesTable = useManagementTable(localCodes, 'brooks_nominalCodes');
    const rulesTable = useManagementTable(localRules, 'brooks_nominalCodeRules');

    const [selectedCode, setSelectedCode] = useState<NominalCode | null>(null);
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
    const [selectedRule, setSelectedRule] = useState<NominalCodeRule | null>(null);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

    // Filter logic for the primary Nominal Codes
    const filteredCodes = localCodes.filter(c => 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    /**
     * handleSaveCode - Updates master ledger categories
     */
    const handleSaveCode = async (updatedCode: NominalCode) => {
        try {
            await saveDocument('brooks_nominalCodes', updatedCode);
            const updateFn = (prev: NominalCode[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(c => c.id === updatedCode.id);
                return exists ? current.map(c => c.id === updatedCode.id ? updatedCode : c) : [...current, updatedCode];
            };
            
            setLocalCodes(updateFn);
            if (setNominalCodes) setNominalCodes(updateFn);
            
            setIsCodeModalOpen(false);
            
            if (refreshActiveData) {
                setTimeout(async () => {
                    await refreshActiveData(true);
                }, 800);
            }
            
            onShowStatus('Nominal code updated.', 'success');
        } catch (error) {
            onShowStatus('Failed to save nominal code.', 'error');
        }
    };

    /**
     * handleSaveRule - Updates automation logic
     */
    const handleSaveRule = async (updatedRule: NominalCodeRule) => {
        try {
            await saveDocument('brooks_nominalCodeRules', updatedRule);
            const updateFn = (prev: NominalCodeRule[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(r => r.id === updatedRule.id);
                return exists ? current.map(r => r.id === updatedRule.id ? updatedRule : r) : [...current, updatedRule];
            };
            
            setLocalRules(updateFn);
            if (setNominalCodeRules) setNominalCodeRules(updateFn);
            
            setIsRuleModalOpen(false);

            if (refreshActiveData) {
                setTimeout(async () => {
                    await refreshActiveData(true);
                }, 800);
            }

            onShowStatus('Assignment rule updated.', 'success');
        } catch (error) {
            onShowStatus('Failed to save assignment rule.', 'error');
        }
    };

    return (
        <div className="space-y-10 p-1">
            {/* --- SECTION 1: NOMINAL CODES --- */}
            <section>
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Calculator className="text-indigo-600" size={20} />
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Financial Nominal Codes</h3>
                        </div>
                        <p className="text-xs text-slate-500 font-medium italic">Define the ledger categories for bookkeeping</p>
                    </div>
                    <button 
                        onClick={() => { setSelectedCode(null); setIsCodeModalOpen(true); }} 
                        className="bg-white border-2 border-indigo-600 text-indigo-600 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all active:scale-95"
                    >
                        <PlusCircle size={16}/> Add Code
                    </button>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-y-auto max-h-[35vh]">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Master Code</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Account Name</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Secondary Ref</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCodes.length > 0 ? (
                                    filteredCodes.map(nc => (
                                        <tr key={nc.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Fingerprint size={14} className="text-indigo-300" />
                                                    <span className="font-mono font-black text-indigo-600 text-sm">{nc.code}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">{nc.name}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-[11px] bg-slate-100 px-2 py-1 rounded text-slate-500">
                                                    {nc.secondaryCode || '---'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => { setSelectedCode(nc); setIsCodeModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mr-4 hover:underline">Edit</button>
                                                <button onClick={() => { if(window.confirm('Delete code?')) codesTable.deleteItem(nc.id); }} className="text-slate-300 hover:text-red-600 font-black text-[10px] uppercase tracking-widest transition-colors">Delete</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400 uppercase text-[10px] font-black tracking-widest">No nominal codes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* --- SECTION 2: ASSIGNMENT RULES --- */}
            <section>
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="text-amber-500" size={20} />
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Automation Rules</h3>
                        </div>
                        <p className="text-xs text-slate-500 font-medium italic">Priority-based logic for auto-assigning nominal codes</p>
                    </div>
                    <button 
                        onClick={() => { setSelectedRule(null); setIsRuleModalOpen(true); }} 
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all active:scale-95"
                    >
                        <PlusCircle size={16}/> Create Rule
                    </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-y-auto max-h-[40vh]">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-900 border-b border-black sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 w-20 text-center text-[10px] uppercase font-black text-slate-400">Pri</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Rule Scope</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Matching Keyword</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Assigned Mapping</th>
                                    <th className="px-6 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {localRules.length > 0 ? (
                                    [...localRules].sort((a, b) => (b.priority || 0) - (a.priority || 0)).map(rule => {
                                        const code = localCodes.find(c => c.id === rule.nominalCodeId);
                                        const entity = (businessEntities || []).find(e => e.id === rule.entityId);
                                        return (
                                            <tr key={rule.id} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-block w-8 py-1 bg-slate-100 rounded-md font-mono font-black text-slate-600 text-xs border border-slate-200">
                                                        {rule.priority}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase">
                                                            <Tag size={10}/> {rule.itemType}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                                                            {entity ? entity.name : (rule.entityId === 'all' ? '🌍 Global' : 'Unknown')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 inline-block">
                                                        {rule.keywords || '* (All)'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 group">
                                                        <ShieldCheck size={14} className="text-emerald-500" />
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">
                                                                {code ? code.name : 'Invalid Mapping'}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-400">{code?.code}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => { setSelectedRule(rule); setIsRuleModalOpen(true); }} className="text-slate-900 font-black text-[10px] uppercase tracking-widest mr-4 hover:underline">Edit</button>
                                                    <button onClick={() => { if(window.confirm('Remove rule?')) rulesTable.deleteItem(rule.id); }} className="text-slate-300 hover:text-red-600 font-black text-[10px] uppercase tracking-widest transition-colors">Delete</button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-20">
                                                <SearchX size={48} strokeWidth={1} />
                                                <span className="font-black uppercase tracking-widest text-xs">No automation rules set</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Modals */}
            {isCodeModalOpen && (
                <NominalCodeFormModal 
                    isOpen={isCodeModalOpen} 
                    onClose={() => setIsCodeModalOpen(false)} 
                    onSave={handleSaveCode} 
                    nominalCode={selectedCode} 
                />
            )}

            {isRuleModalOpen && (
                <NominalCodeRuleFormModal 
                    isOpen={isRuleModalOpen} 
                    onClose={() => setIsRuleModalOpen(false)} 
                    onSave={handleSaveRule} 
                    rule={selectedRule} 
                    nominalCodes={localCodes} 
                    businessEntities={businessEntities || []} 
                />
            )}
        </div>
    );
};