import React, { useState, useEffect, useMemo } from 'react';
import { Purchase, Supplier, Job, Vehicle, TaxRate, BusinessEntity } from '../types';
import { formatDate } from '../core/utils/dateUtils';
import { X, Save } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { generatePurchaseId } from '../core/utils/numberGenerators';

// --- Helper Components ---
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  saveText?: string;
  saveIcon?: React.ElementType;
}

const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, title, children, onSave, saveText = "Save", saveIcon: SaveIcon = Save }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col animate-fade-in-up">
        <div className="flex justify-between items-center border-b p-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-indigo-700">{title}</h2>
          <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
        </div>
        <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
          {children}
        </div>
        {onSave && (
          <div className="flex justify-end p-4 border-t bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition mr-2">Cancel</button>
            <button onClick={onSave} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
              <SaveIcon size={16} className="mr-2"/> {saveText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


const PurchaseFormModal = ({ isOpen, onClose, onSave, purchase, suppliers, jobs, vehicles, taxRates, selectedEntityId, purchases, businessEntities }: { isOpen: boolean, onClose: () => void, onSave: (p: Purchase) => void, purchase: Purchase | null, suppliers: Supplier[], jobs: Job[], vehicles: Vehicle[], taxRates: TaxRate[], selectedEntityId: string, purchases: Purchase[], businessEntities: BusinessEntity[] }) => {
    const [formData, setFormData] = useState<Partial<Purchase>>({});
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v.registration])), [vehicles]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    useEffect(() => { setFormData(purchase || { name: '', purchasePrice: 0, markupPercent: 25, jobId: null, supplierId: suppliers[0]?.id || null, taxCodeId: standardTaxRateId }); }, [purchase, isOpen, suppliers, standardTaxRateId]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numValue = (name === 'purchasePrice' || name === 'markupPercent') ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: numValue }));
    };

    const calculatedSalePrice = useMemo(() => {
        const cost = parseFloat(String(formData.purchasePrice)) || 0;
        const markup = parseFloat(String(formData.markupPercent)) || 0;
        if (cost > 0) {
            return cost * (1 + markup / 100);
        }
        return 0;
    }, [formData.purchasePrice, formData.markupPercent]);

    const handleSave = () => {
        if (!formData.name || formData.purchasePrice! <= 0) return alert('Item name and a valid purchase price are required.');
        let entityId = formData.entityId;
        if (!entityId) {
             if (selectedEntityId !== 'all') { entityId = selectedEntityId;
             } else if (formData.jobId) { const job = jobs.find(j => j.id === formData.jobId); entityId = job?.entityId; }
        }
        if (!entityId) return alert("Could not determine business entity. Please select a specific entity or assign to a job.");
        
        const entity = businessEntities.find(e => e.id === entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        
        onSave({ id: formData.id || generatePurchaseId(purchases, entityShortCode), purchaseDate: formData.purchaseDate || formatDate(new Date()), entityId, ...formData } as Purchase);
    };
    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={purchase ? 'Edit Purchase' : 'Add Purchase'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Item Name*" className="p-2 border rounded md:col-span-2" required />
                <input name="purchasePrice" type="number" step="0.01" value={formData.purchasePrice || ''} onChange={handleChange} placeholder="Cost Price (Net £)*" className="p-2 border rounded" required />
                <input name="markupPercent" type="number" value={formData.markupPercent || ''} onChange={handleChange} placeholder="Markup %" className="p-2 border rounded" />
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calculated Sale Price (Net £)</label>
                    <input
                        type="text"
                        value={formatCurrency(calculatedSalePrice)}
                        className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed"
                        readOnly
                        tabIndex={-1}
                    />
                </div>

                <select name="supplierId" value={formData.supplierId || ''} onChange={handleChange} className="p-2 border rounded bg-white"><option value="">-- Select Supplier --</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select name="jobId" value={formData.jobId || ''} onChange={handleChange} className="p-2 border rounded bg-white"><option value="">Workshop Stock (Unassigned)</option>{jobs.filter(j => !j.invoiceId).map(j => (<option key={j.id} value={j.id}>{vehicleMap.get(j.vehicleId)} - {j.description}</option>))}</select>
                
                <select name="taxCodeId" value={formData.taxCodeId || ''} className="p-2 border rounded bg-gray-100" disabled>
                    {taxRates.map(t => <option key={t.id} value={t.id}>{t.code} ({t.rate}%)</option>)}
                </select>

                <input name="supplierReference" value={formData.supplierReference || ''} onChange={handleChange} placeholder="Supplier Reference / Invoice #" className="p-2 border rounded" />
            </div>
        </FormModal>
    );
};

export default PurchaseFormModal;