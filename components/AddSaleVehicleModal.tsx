import React, { useState, useEffect } from 'react';
import { SaleVehicle, Vehicle, SaleVersion, Customer } from '../types';
import { X, Save, Car, Tag, DollarSign, Repeat, KeyRound, Search, ArrowLeft } from 'lucide-react';
import AddNewVehicleForm from './AddNewVehicleForm';
import { useAuditLogger } from '../core/hooks/useAuditLogger';
import { formatCurrency } from '../utils/formatUtils';

interface AddSaleVehicleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (saleVehicle: SaleVehicle) => void;
    entityId: string;
    vehicles: Vehicle[];
    customers: Customer[];
    onAddCustomerAndVehicle: (customer: Customer, vehicle: Vehicle) => void;
}

const AddSaleVehicleModal: React.FC<AddSaleVehicleModalProps> = ({ isOpen, onClose, onSave, entityId, vehicles, customers, onAddCustomerAndVehicle }) => {
    const [step, setStep] = useState<'lookup' | 'details'>('lookup');
    const [registration, setRegistration] = useState('');
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [isNewVehicleFlow, setIsNewVehicleFlow] = useState(false);
    const [error, setError] = useState('');
    const [saleType, setSaleType] = useState<'Sale or Return' | 'Stock'>('Sale or Return');
    const [listPrice, setListPrice] = useState<string>('');
    const [purchasePrice, setPurchasePrice] = useState<string>('');
    const [sorReturnPrice, setSorReturnPrice] = useState<string>('');
    const [keyNumber, setKeyNumber] = useState<string>('');
    const { logEvent } = useAuditLogger();

    useEffect(() => {
        if (!isOpen) {
            setStep('lookup');
            setRegistration('');
            setVehicle(null);
            setIsNewVehicleFlow(false);
            setError('');
            setSaleType('Sale or Return');
            setListPrice('');
            setPurchasePrice('');
            setSorReturnPrice('');
            setKeyNumber('');
        }
    }, [isOpen]);

    const handleLookup = () => {
        if (!registration.trim()) {
            setError('Please enter a vehicle registration.');
            return;
        }
        setError('');
        const found = vehicles.find(v => v.registration.toUpperCase().replace(/\s/g, '') === registration.toUpperCase().replace(/\s/g, ''));
        if (found) {
            setVehicle(found);
            setIsNewVehicleFlow(false);
        } else {
            setVehicle(null);
            setIsNewVehicleFlow(true);
        }
        setStep('details');
    };

    const handleBackToLookup = () => {
        setStep('lookup');
        setRegistration('');
        setVehicle(null);
        setIsNewVehicleFlow(false);
        setError('');
    };

    const handleNewVehicleSave = (customer: Customer, newVehicle: Vehicle) => {
        onAddCustomerAndVehicle(customer, newVehicle);
        setVehicle(newVehicle);
        setIsNewVehicleFlow(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicle || !listPrice) {
            alert('A vehicle must be selected and a list price entered.');
            return;
        }

        const versionId = crypto.randomUUID();
        const newSaleVehicle: SaleVehicle = {
            id: crypto.randomUUID(),
            entityId,
            vehicleId: vehicle.id,
            status: 'For Sale',
            saleType,
            purchasePrice: saleType === 'Stock' && purchasePrice ? parseFloat(purchasePrice) : undefined,
            prepCosts: [],
            overheads: [],
            upsells: [],
            nonRecoverableCosts: [],
            depositAmount: undefined,
            depositDate: null,
            invoiceId: null,
            keyNumber: keyNumber ? parseInt(keyNumber, 10) : undefined,
            versions: [
                {
                    versionId: versionId,
                    createdAt: new Date().toISOString(),
                    listPrice: parseFloat(listPrice),
                    sorReturnPrice: saleType === 'Sale or Return' && sorReturnPrice ? parseFloat(sorReturnPrice) : undefined,
                }
            ],
            activeVersionId: versionId,
        };
        
        onSave(newSaleVehicle);
        logEvent('CREATE', 'SaleVehicle', newSaleVehicle.id, `Listed ${vehicle.registration} for sale. Type: ${newSaleVehicle.saleType}, Price: ${formatCurrency(parseFloat(listPrice))}.`);
        onClose();
    };

    if (!isOpen) return null;

    const renderSaleDetails = () => (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="space-y-4 flex-grow">
                 <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-bold text-green-800">Vehicle Selected:</p>
                    <p className="text-sm text-gray-700">{vehicle?.make} {vehicle?.model} (<span className="font-mono">{vehicle?.registration}</span>)</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type</label>
                    <div className="flex gap-2 rounded-lg bg-gray-200 p-1">
                        <button type="button" onClick={() => setSaleType('Sale or Return')} className={`w-full py-2 rounded-md font-semibold text-sm transition ${saleType === 'Sale or Return' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}>Sale or Return</button>
                        <button type="button" onClick={() => setSaleType('Stock')} className={`w-full py-2 rounded-md font-semibold text-sm transition ${saleType === 'Stock' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}>Dealership Stock</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Tag size={14}/> List Price (£)</label>
                    <input type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="e.g. 25000" required />
                </div>
                {saleType === 'Sale or Return' && (
                     <div className="animate-fade-in">
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Repeat size={14}/> Return Price to Customer (£)</label>
                        <input type="number" value={sorReturnPrice} onChange={(e) => setSorReturnPrice(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Amount to pay back to vehicle owner" required />
                    </div>
                )}
                {saleType === 'Stock' && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><DollarSign size={14}/> Purchase Price (£)</label>
                        <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Cost of vehicle to dealership" required />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><KeyRound size={14}/> Key Number (1-50)</label>
                    <input type="number" value={keyNumber} onChange={(e) => setKeyNumber(e.target.value)} min="1" max="50" className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Optional" />
                </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t flex-shrink-0">
                <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                <button type="submit" className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                    <Save size={16} className="mr-2"/> Save & List Vehicle
                </button>
            </div>
        </form>
    );

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4 p-6 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {step === 'details' && (
                            <button type="button" onClick={handleBackToLookup} className="p-2 rounded-full hover:bg-gray-100">
                                <ArrowLeft size={20} className="text-gray-600"/>
                            </button>
                        )}
                        <h2 className="text-2xl font-bold text-indigo-700 flex items-center"><Car className="mr-2"/> Add Vehicle for Sale</h2>
                    </div>
                    <button type="button" onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                
                <div className="px-6 pb-6 flex-grow overflow-y-auto">
                    {step === 'lookup' && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <label htmlFor="reg-lookup" className="text-lg font-semibold text-gray-700 mb-2">Enter Vehicle Registration</label>
                            <div className="relative w-full max-w-sm">
                                <input
                                    id="reg-lookup"
                                    type="text"
                                    value={registration}
                                    onChange={(e) => { setRegistration(e.target.value); setError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                    className="w-full p-3 text-center text-xl font-mono tracking-widest uppercase border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g., REG123"
                                />
                                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                            </div>
                            <button onClick={handleLookup} className="mt-4 flex items-center justify-center py-3 px-6 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                                <Search size={20} className="mr-2"/> Find Vehicle
                            </button>
                        </div>
                    )}

                    {step === 'details' && (
                        isNewVehicleFlow ? (
                            <AddNewVehicleForm 
                                initialRegistration={registration}
                                onSave={handleNewVehicleSave}
                                onCancel={handleBackToLookup}
                                customers={customers}
                                saveButtonText="Save Vehicle & Continue"
                            />
                        ) : vehicle ? (
                            renderSaleDetails()
                        ) : null
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddSaleVehicleModal;