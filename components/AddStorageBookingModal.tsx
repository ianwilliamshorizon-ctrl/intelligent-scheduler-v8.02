import React, { useState, useEffect } from 'react';
import { StorageBooking, Vehicle, Customer } from '../types';
import { X, Save, Car, User, Calendar, DollarSign, KeyRound, Search, ArrowLeft } from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import AddNewVehicleForm from './AddNewVehicleForm';
import { useAuditLogger } from '../core/hooks/useAuditLogger';

interface AddStorageBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (booking: StorageBooking) => void;
    locationId: string;
    slotIdentifier: string;
    vehicles: Vehicle[];
    customers: Customer[];
    defaultWeeklyRate: number;
    onAddCustomerAndVehicle: (customer: Customer, vehicle: Vehicle) => void;
}

const AddStorageBookingModal: React.FC<AddStorageBookingModalProps> = ({ isOpen, onClose, onSave, locationId, slotIdentifier, vehicles, customers, defaultWeeklyRate, onAddCustomerAndVehicle }) => {
    const [step, setStep] = useState<'lookup' | 'details' | 'newVehicle'>('lookup');
    const [registration, setRegistration] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [error, setError] = useState('');
    const { logEvent } = useAuditLogger();

    const [bookingData, setBookingData] = useState({
        startDate: formatDate(new Date()),
        endDate: '',
        weeklyRate: defaultWeeklyRate,
        notes: '',
        keyNumber: '',
    });

    useEffect(() => {
        if (!isOpen) {
            setStep('lookup');
            setRegistration('');
            setSelectedVehicle(null);
            setError('');
            setBookingData({
                startDate: formatDate(new Date()),
                endDate: '',
                weeklyRate: defaultWeeklyRate,
                notes: '',
                keyNumber: '',
            });
        }
    }, [isOpen, defaultWeeklyRate]);

    const handleLookup = () => {
        if (!registration.trim()) {
            setError('Please enter a vehicle registration.');
            return;
        }
        setError('');
        const found = vehicles.find(v => v.registration.toUpperCase().replace(/\s/g, '') === registration.toUpperCase().replace(/\s/g, ''));
        if (found) {
            setSelectedVehicle(found);
            setStep('details');
        } else {
            setStep('newVehicle');
        }
    };
    
    const handleBackToLookup = () => {
        setStep('lookup');
        setRegistration('');
        setSelectedVehicle(null);
        setError('');
    };

    const handleNewVehicleSave = (customer: Customer, newVehicle: Vehicle) => {
        onAddCustomerAndVehicle(customer, newVehicle);
        // A slight delay might be needed if the parent state update isn't immediate
        setTimeout(() => {
            setSelectedVehicle(newVehicle);
            setStep('details');
        }, 100);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle) {
            alert('A vehicle must be selected.');
            return;
        }

        const newBooking: StorageBooking = {
            id: crypto.randomUUID(),
            entityId: 'ent_storage',
            vehicleId: selectedVehicle.id,
            customerId: selectedVehicle.customerId,
            locationId,
            slotIdentifier,
            startDate: bookingData.startDate,
            endDate: bookingData.endDate || null,
            weeklyRate: bookingData.weeklyRate,
            notes: bookingData.notes,
            keyNumber: bookingData.keyNumber ? parseInt(bookingData.keyNumber, 10) : undefined,
        };
        onSave(newBooking);
        logEvent('CREATE', 'StorageBooking', newBooking.id, `Created storage booking for ${selectedVehicle.registration} in slot ${slotIdentifier}.`);
        onClose();
    };
    
    if (!isOpen) return null;

    const customer = selectedVehicle ? customers.find(c => c.id === selectedVehicle.customerId) : null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-2">
                        {step !== 'lookup' && (
                            <button type="button" onClick={handleBackToLookup} className="p-2 rounded-full hover:bg-gray-100">
                                <ArrowLeft size={20} className="text-gray-600"/>
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-indigo-700">Book into Slot {slotIdentifier}</h2>
                    </div>
                    <button type="button" onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-6">
                    {step === 'lookup' && (
                         <div className="flex flex-col items-center justify-center h-full text-center py-8">
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
                                    autoFocus
                                />
                                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                            </div>
                            <button onClick={handleLookup} className="mt-4 flex items-center justify-center py-3 px-6 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                                <Search size={20} className="mr-2"/> Find Vehicle
                            </button>
                        </div>
                    )}

                    {step === 'newVehicle' && (
                        <AddNewVehicleForm
                            initialRegistration={registration}
                            onSave={handleNewVehicleSave}
                            onCancel={handleBackToLookup}
                            customers={customers}
                            saveButtonText="Save & Continue to Booking"
                        />
                    )}

                    {step === 'details' && selectedVehicle && (
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                 <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                                    <p><strong className="w-20 inline-block">Vehicle:</strong> {selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.registration})</p>
                                    <p><strong className="w-20 inline-block">Owner:</strong> {customer?.forename} {customer?.surname}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Calendar size={14} /> Start Date</label>
                                        <input type="date" value={bookingData.startDate} onChange={e => setBookingData({...bookingData, startDate: e.target.value})} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><DollarSign size={14} /> Weekly Rate (£)</label>
                                        <input type="number" value={bookingData.weeklyRate} onChange={e => setBookingData({...bookingData, weeklyRate: Number(e.target.value)})} className="w-full p-2 border rounded" required />
                                    </div>
                                </div>
                                 <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><KeyRound size={14} /> Key Number (1-50)</label>
                                    <input type="number" value={bookingData.keyNumber} onChange={e => setBookingData({...bookingData, keyNumber: e.target.value})} min="1" max="50" className="w-full p-2 border rounded" placeholder="Optional" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1">Notes</label>
                                    <textarea value={bookingData.notes} onChange={e => setBookingData({...bookingData, notes: e.target.value})} rows={2} className="w-full p-2 border rounded" />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                                <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                                <button type="submit" className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
                                    <Save size={16} className="mr-2" /> Create Booking
                                </button>
                            </div>
                        </form>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AddStorageBookingModal;