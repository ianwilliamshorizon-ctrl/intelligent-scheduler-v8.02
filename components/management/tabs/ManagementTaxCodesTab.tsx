
import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { TaxRate } from '../../../types';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import TaxCodeFormModal from '../../TaxCodeFormModal';
import { saveDocument, deleteDocument } from '../../../core/db';

interface ManagementTaxCodesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementTaxCodesTab: React.FC<ManagementTaxCodesTabProps> = ({ searchTerm, onShowStatus }) => {
    const { taxRates, setTaxRates } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTaxRate, setSelectedTaxRate] = useState<TaxRate | null>(null);

    useEffect(() => {
        if (!taxRates || taxRates.length === 0) {
            const seedData: TaxRate[] = [
                { id: 'tax_T0_initial', code: 'T0', name: 'Zero Rate', rate: 0 },
                { id: 'tax_T1_initial', code: 'T1', name: 'Standard VAT', rate: 20 },
            ];
            setTaxRates(seedData);
            Promise.all(seedData.map(tr => saveDocument('brooks_taxRates', tr)))
                .then(() => onShowStatus('Initial tax codes have been seeded.', 'success'));
        }
    }, [taxRates, setTaxRates, onShowStatus]);


    const handleSave = async (taxRate: TaxRate) => {
        try {
            await saveDocument('brooks_taxRates', taxRate);
            setTaxRates(prev => {
                const existing = prev.find(t => t.id === taxRate.id);
                return existing ? prev.map(t => t.id === taxRate.id ? taxRate : t) : [...prev, taxRate];
            });
            setIsModalOpen(false);
            onShowStatus('Tax code saved.', 'success');
        } catch (error) {
            onShowStatus('Failed to save tax code.', 'error');
        }
    };

    const handleDelete = async (taxRateId: string) => {
        if (window.confirm('Are you sure you want to delete this tax code?')) {
            try {
                await deleteDocument('brooks_taxRates', taxRateId);
                setTaxRates(prev => prev.filter(t => t.id !== taxRateId));
                onShowStatus('Tax code deleted.', 'success');
            } catch (error) {
                onShowStatus('Failed to delete tax code.', 'error');
            }
        }
    };

    const filteredTaxRates = (taxRates || []).filter(tr => 
        tr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        tr.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Manage Tax Codes</h2>
                <button 
                    onClick={() => { setSelectedTaxRate(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all"
                >
                    <PlusCircle size={18}/> Add Tax Code
                </button>
            </div>

            <div className="bg-white border rounded-lg shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-3 font-bold">Code</th>
                            <th className="p-3 font-bold">Name</th>
                            <th className="p-3 font-bold text-right">Rate (%)</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTaxRates.map(tr => (
                            <tr key={tr.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="p-3 font-mono">{tr.code}</td>
                                <td className="p-3">{tr.name}</td>
                                <td className="p-3 text-right">{tr.rate.toFixed(2)}%</td>
                                <td className="p-3 text-right">
                                    <button onClick={() => { setSelectedTaxRate(tr); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-1"><Edit size={16}/></button>
                                    <button onClick={() => handleDelete(tr.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <TaxCodeFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    taxRate={selectedTaxRate} 
                />
            )}
        </div>
    );
};
