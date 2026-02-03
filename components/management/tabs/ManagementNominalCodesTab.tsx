import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { NominalCode, NominalCodeRule } from '../../../types';
import { PlusCircle } from 'lucide-react';
import NominalCodeFormModal from '../../NominalCodeFormModal';
import NominalCodeRuleFormModal from '../../NominalCodeRuleFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementNominalCodesTab = () => {
    const { 
        nominalCodes, setNominalCodes, 
        nominalCodeRules, setNominalCodeRules, 
        businessEntities, refreshActiveData 
    } = useData();

    // 1. LOCAL STATES: These ensure the UI updates the millisecond you hit save
    const [localCodes, setLocalCodes] = useState<NominalCode[]>(nominalCodes || []);
    const [localRules, setLocalRules] = useState<NominalCodeRule[]>(nominalCodeRules || []);

    // 2. SYNC: Keep local state aligned with background polling
    useEffect(() => {
        setLocalCodes(nominalCodes || []);
    }, [nominalCodes]);

    useEffect(() => {
        setLocalRules(nominalCodeRules || []);
    }, [nominalCodeRules]);

    // Helpers for deletion
    const codesTable = useManagementTable(nominalCodes, 'brooks_nominalCodes');
    const rulesTable = useManagementTable(nominalCodeRules, 'brooks_nominalCodeRules');

    const [selectedCode, setSelectedCode] = useState<NominalCode | null>(null);
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

    const [selectedRule, setSelectedRule] = useState<NominalCodeRule | null>(null);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

    /**
     * handleSaveCode
     */
    const handleSaveCode = async (updatedCode: NominalCode) => {
        try {
            await saveDocument('brooks_nominalCodes', updatedCode);
            
            const updateFn = (prev: NominalCode[]) => {
                const exists = prev.find(c => c.id === updatedCode.id);
                if (exists) return prev.map(c => c.id === updatedCode.id ? updatedCode : c);
                return [...prev, updatedCode];
            };

            setLocalCodes(updateFn);
            if (setNominalCodes) setNominalCodes(updateFn);
            await refreshActiveData(true);
            setIsCodeModalOpen(false);
        } catch (error) {
            console.error("Failed to save Nominal Code:", error);
        }
    };

    /**
     * handleSaveRule
     */
    const handleSaveRule = async (updatedRule: NominalCodeRule) => {
        try {
            await saveDocument('brooks_nominalCodeRules', updatedRule);
            
            const updateFn = (prev: NominalCodeRule[]) => {
                const exists = prev.find(r => r.id === updatedRule.id);
                if (exists) return prev.map(r => r.id === updatedRule.id ? updatedRule : r);
                return [...prev, updatedRule];
            };

            setLocalRules(updateFn);
            if (setNominalCodeRules) setNominalCodeRules(updateFn);
            await refreshActiveData(true);
            setIsRuleModalOpen(false);
        } catch (error) {
            console.error("Failed to save Nominal Rule:", error);
        }
    };

    return (
        <div className="space-y-6">
            {/* --- SECTION 1: NOMINAL CODES --- */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Financial Nominal Codes</h3>
                    <button 
                        onClick={() => { setSelectedCode(null); setIsCodeModalOpen(true); }} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-md"
                    >
                        <PlusCircle size={16}/> Add Code
                    </button>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-y-auto max-h-[30vh]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Code</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Name</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Secondary</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {localCodes.map(nc => (
                                    <tr key={nc.id} className="hover:bg-gray-50/50">
                                        <td className="p-4 font-mono font-bold text-indigo-600">{nc.code}</td>
                                        <td className="p-4 font-bold text-gray-900">{nc.name}</td>
                                        <td className="p-4 font-mono text-xs text-gray-500">{nc.secondaryCode || '-'}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => { setSelectedCode(nc); setIsCodeModalOpen(true); }} className="text-indigo-600 font-black text-xs uppercase mr-3">Edit</button>
                                            <button onClick={() => codesTable.deleteItem(nc.id)} className="text-gray-300 hover:text-red-600 font-black text-xs uppercase">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- SECTION 2: ASSIGNMENT RULES --- */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Assignment Rules</h3>
                    <button 
                        onClick={() => { setSelectedRule(null); setIsRuleModalOpen(true); }} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-md"
                    >
                        <PlusCircle size={16}/> Add Rule
                    </button>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-y-auto max-h-[35vh]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 w-16 text-center text-[10px] uppercase font-black text-gray-400">Pri</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Type</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Entity</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Include</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Assigned Code</th>
                                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[...localRules].sort((a, b) => b.priority - a.priority).map(rule => {
                                    const code = localCodes.find(c => c.id === rule.nominalCodeId);
                                    const entity = (businessEntities || []).find(e => e.id === rule.entityId);
                                    return (
                                        <tr key={rule.id} className="hover:bg-gray-50/50">
                                            <td className="p-4 text-center font-mono font-bold">{rule.priority}</td>
                                            <td className="p-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-[10px] font-black uppercase">{rule.itemType}</span></td>
                                            <td className="p-4 text-xs font-medium text-gray-600">{entity ? entity.name : (rule.entityId === 'all' ? 'Global' : 'Unknown')}</td>
                                            <td className="p-4 text-xs font-mono">{rule.keywords || '*'}</td>
                                            <td className="p-4 text-xs font-bold text-indigo-700">{code ? `${code.code} - ${code.name}` : 'Unknown Code'}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => { setSelectedRule(rule); setIsRuleModalOpen(true); }} className="text-indigo-600 font-black text-xs uppercase mr-3">Edit</button>
                                                <button onClick={() => rulesTable.deleteItem(rule.id)} className="text-gray-300 hover:text-red-600 font-black text-xs uppercase">Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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