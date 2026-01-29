

import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../core/state/DataContext';
import { StorageBooking, Vehicle, Customer, BusinessEntity, StorageLocation, BatteryCharger, ChargingEvent, Invoice, TaxRate } from '../types';
import { Warehouse, PlusCircle, Car, MoreHorizontal, Save, Trash2, BatteryCharging, FileText, Calendar, Check, ChevronDown, ChevronUp, User, Clock, DollarSign, LogOut, KeyRound, Search, X, CheckSquare } from 'lucide-react';
import { formatDate, dateStringToDate, daysBetween, addDays } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import AddStorageBookingModal from './AddStorageBookingModal';
import { generateInvoiceId } from '../core/utils/numberGenerators';

// --- MODALS ---

const ManageStorageBookingModal = ({ isOpen, onClose, onSave, onGenerateInvoice, onBookOutVehicle, onViewInvoice, booking, vehicle, customer, batteryChargers, invoices }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (booking: StorageBooking) => void;
    onGenerateInvoice: (booking: StorageBooking) => void;
    onBookOutVehicle: (bookingId: string) => void;
    onViewInvoice: (invoiceId: string) => void;
    booking: StorageBooking;
    vehicle: Vehicle | null;
    customer: Customer | null;
    batteryChargers: BatteryCharger[];
    invoices: Invoice[];
}) => {
    const [formData, setFormData] = useState<StorageBooking>(booking);
    const [isCharging, setIsCharging] = useState(false);
    const [selectedChargerId, setSelectedChargerId] = useState('');

    useEffect(() => {
        setFormData(booking);
        setIsCharging(false);
        setSelectedChargerId('');
    }, [booking, isOpen]);

    const isClosed = !!formData.endDate;

    const activeChargingEvent = useMemo(() => {
        return (formData.chargingHistory || []).find(event => event.endDate === null);
    }, [formData.chargingHistory]);

    const handleSaveAndClose = () => {
        onSave(formData);
        onClose();
    };
    
    const handleBookOut = () => {
        onBookOutVehicle(formData.id);
        onClose();
    };

    const handleStartCharging = () => {
        if (!selectedChargerId) return;
        const newEvent: ChargingEvent = {
            id: crypto.randomUUID(),
            chargerId: selectedChargerId,
            startDate: new Date().toISOString(),
            endDate: null
        };
        setFormData(prev => ({
            ...prev,
            chargingHistory: [...(prev.chargingHistory || []), newEvent]
        }));
        setIsCharging(false);
    };

    const handleStopCharging = () => {
        setFormData(prev => ({
            ...prev,
            chargingHistory: (prev.chargingHistory || []).map(event => 
                event.id === activeChargingEvent!.id ? { ...event, endDate: new Date().toISOString() } : event
            )
        }));
    };
    
    const chargerMap = useMemo(() => new Map(batteryChargers.map(c => [c.id, `${c.name} (${c.locationDescription || 'N/A'})`])), [batteryChargers]);
    const entityChargers = useMemo(() => {
        return batteryChargers.filter(c => c.entityId === formData.entityId);
    }, [batteryChargers, formData.entityId]);

    const calculateTotalAccrued = () => {
        const billingStartDate = formData.lastBilledDate ? addDays(dateStringToDate(formData.lastBilledDate), 1) : dateStringToDate(formData.startDate);
        const billingEndDate = formData.endDate ? dateStringToDate(formData.endDate) : new Date();

        if (billingEndDate.getTime() < billingStartDate.getTime()) {
            return 0;
        }

        const daysToBill = daysBetween(billingStartDate, billingEndDate) + 1;
        const durationWeeks = Math.ceil(daysToBill / 7);
        return durationWeeks * formData.weeklyRate;
    };
    
    if (!isOpen) return null;

    const invoiceList: string[] = formData.invoiceIds || [];

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">{vehicle?.registration} - Storage Details</h2>
                </header>
                <main className="flex-grow overflow-y-auto p-6 space-y-4">
                    <Section title="Booking Details" icon={Calendar} defaultOpen>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><label className="font-semibold">Start Date</label><input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-2 border rounded mt-1" disabled={isClosed}/></div>
                            <div><label className="font-semibold">End Date</label><input type="date" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full p-2 border rounded mt-1" disabled={isClosed}/></div>
                            <div><label className="font-semibold">Weekly Rate (£)</label><input type="number" value={formData.weeklyRate} onChange={e => setFormData({...formData, weeklyRate: Number(e.target.value)})} className="w-full p-2 border rounded mt-1" disabled={isClosed}/></div>
                            <div>
                                <label className="font-semibold">Key Number</label>
                                <input 
                                    type="number" 
                                    value={formData.keyNumber || ''} 
                                    onChange={e => setFormData({...formData, keyNumber: e.target.value ? parseInt(e.target.value, 10) : undefined})} 
                                    className="w-full p-2 border rounded mt-1"
                                    placeholder="1-50"
                                    min="1"
                                    max="50"
                                    disabled={isClosed}
                                />
                            </div>
                            <div className="col-span-2"><label className="font-semibold">Notes</label><textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} className="w-full p-2 border rounded mt-1" disabled={isClosed}/></div>
                        </div>
                    </Section>

                    <Section title="Battery Charging Log" icon={BatteryCharging}>
                        <div className={`space-y-2 text-sm max-h-40 overflow-y-auto pr-2 ${isClosed ? 'opacity-60' : ''}`}>
                             {(formData.chargingHistory || []).map(event => (
                                <div key={event.id} className="p-2 bg-gray-50 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{chargerMap.get(event.chargerId) || 'Unknown Charger'}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(event.startDate).toLocaleString()} - {event.endDate ? new Date(event.endDate).toLocaleString() : 'Ongoing'}
                                        </p>
                                    </div>
                                    {event.endDate === null && (
                                        <button onClick={handleStopCharging} disabled={isClosed} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded disabled:opacity-50">Stop</button>
                                    )}
                                </div>
                            ))}
                            {(formData.chargingHistory || []).length === 0 && <p className="text-xs text-gray-500 text-center">No charging history.</p>}
                        </div>
                         <div className="mt-2 pt-2 border-t">
                            {!activeChargingEvent && !isCharging && !isClosed && (
                                <button onClick={() => setIsCharging(true)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={14} className="mr-1"/> Add Charging Event</button>
                            )}
                            {isCharging && (
                                <div className="flex gap-2 items-center">
                                    <select value={selectedChargerId} onChange={e => setSelectedChargerId(e.target.value)} className="w-full p-1.5 border rounded text-sm"><option value="">-- Select Charger --</option>{entityChargers.map(c => <option key={c.id} value={c.id}>{c.name}{c.locationDescription ? ` (${c.locationDescription})` : ''}</option>)}</select>
                                    <button onClick={handleStartCharging} className="px-3 py-1.5 bg-green-500 text-white rounded">Start</button>
                                </div>
                            )}
                        </div>
                    </Section>
                    
                     <Section title="Billing" icon={FileText}>
                         {isClosed && (
                            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-center text-sm font-semibold mb-2">
                                This booking is closed. No further billing actions are available.
                            </div>
                        )}
                        <div className={`space-y-2 text-sm ${isClosed ? 'opacity-50' : ''}`}>
                            <div className="p-3 bg-gray-100 rounded-lg space-y-1">
                                <div className="flex justify-between"><span>Last Billed Until:</span><span className="font-semibold">{formData.lastBilledDate || 'Never'}</span></div>
                                <div className="flex justify-between font-bold text-base"><span>Accrued Since:</span><span>{formatCurrency(calculateTotalAccrued())}</span></div>
                            </div>
                             <div className="mt-2">
                                <h4 className="font-semibold mb-1">Generated Invoices:</h4>
                                <ul className="list-disc list-inside space-y-1">
                                    {invoiceList.length > 0 ? invoiceList.map((id: string) => {
                                        const inv = invoices.find(i => i.id === id);
                                        if (!inv) {
                                            return <li key={id}>{id} - Status unknown</li>;
                                        }
                                        const statusStyles: { [key in Invoice['status']]: string } = {
                                            Draft: 'bg-gray-200 text-gray-800',
                                            Sent: 'bg-blue-200 text-blue-800',
                                            'Part Paid': 'bg-amber-200 text-amber-800',
                                            Paid: 'bg-green-200 text-green-800',
                                            Overdue: 'bg-red-200 text-red-800',
                                        };
                                        return (
                                            <li key={id} className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => onViewInvoice(id)}
                                                    type="button"
                                                    className="text-xs text-blue-600 underline hover:text-blue-800"
                                                >
                                                    {id}
                                                </button>
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusStyles[inv.status]}`}>{inv.status}</span>
                                            </li>
                                        );
                                    }) : <li>None</li>}
                                </ul>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <button type="button" onClick={() => onGenerateInvoice(booking)} disabled={isClosed} className="w-full flex justify-center items-center py-2 px-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <FileText size={16} className="mr-2" /> Generate 4-Week Interim Invoice
                                </button>
                            </div>
                        </div>
                    </Section>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center gap-2 p-4 border-t bg-gray-50">
                    <div>
                        {!isClosed && (
                            <button
                                type="button"
                                onClick={handleBookOut}
                                className="flex items-center py-2 px-4 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700"
                            >
                                <LogOut size={16} className="mr-2" /> Book Out & Finalize Bill
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                        <button type="button" onClick={handleSaveAndClose} disabled={isClosed} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Save size={16} className="mr-2" /> Save Changes
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

const Section = ({ title, children, defaultOpen = true, icon: Icon }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
                {isOpen ? <ChevronUp size={20} className="text-gray-600"/> : <ChevronDown size={20} className="text-gray-600"/>}
            </h3>
            {isOpen && <div className="p-3">{children}</div>}
        </div>
    );
};


// --- MAIN VIEW ---
interface StorageViewProps {
    entity: BusinessEntity;
    onSaveBooking: (booking: StorageBooking) => void;
    onBookOutVehicle: (bookingId: string) => void;
    onViewInvoice: (invoiceId: string) => void;
    onAddCustomerAndVehicle: (customer: Customer, vehicle: Vehicle) => void;
    onSaveInvoice: (invoice: Invoice) => void;
    setConfirmation: (confirmation: { isOpen: boolean; title: string; message: React.ReactNode; type?: 'success' | 'warning' }) => void;
    setViewedInvoice: (invoice: Invoice | null) => void;
}

const StorageView: React.FC<StorageViewProps> = ({ entity, onSaveBooking, onBookOutVehicle, onViewInvoice, onAddCustomerAndVehicle, onSaveInvoice, setConfirmation, setViewedInvoice }) => {
    const { storageLocations, batteryChargers, storageBookings, vehicles, customers, invoices, taxRates } = useData();
    const [selectedLocationId, setSelectedLocationId] = useState<string>(storageLocations?.[0]?.id || '');
    const [manageModal, setManageModal] = useState<{isOpen: boolean; booking: StorageBooking | null }>({isOpen: false, booking: null });
    const [addModal, setAddModal] = useState<{isOpen: boolean; locationId: string; slotIdentifier: string; }>({isOpen: false, locationId: '', slotIdentifier: ''});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const currentBookingForModal = useMemo(() => {
        if (!manageModal.booking) return null;
        return storageBookings.find(b => b.id === manageModal.booking!.id);
    }, [storageBookings, manageModal.booking]);

    const selectedLocation = useMemo(() => storageLocations.find(l => l.id === selectedLocationId), [selectedLocationId, storageLocations]);
    
    const locationPrefix = useMemo(() => {
        return selectedLocation?.name.substring(0,2).toUpperCase() || 'ST';
    }, [selectedLocation]);

    const bookingsForLocation = useMemo(() => {
        let bookings = storageBookings.filter(b => b.locationId === selectedLocationId);
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            bookings = bookings.filter(booking => {
                const vehicle = vehiclesById.get(booking.vehicleId);
                const customer = customersById.get(booking.customerId);
                return (
                    (vehicle && vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerSearch.replace(/\s/g, ''))) ||
                    (customer && `${String(customer.forename)} ${String(customer.surname)}`.toLowerCase().includes(lowerSearch))
                );
            });
        }
        return bookings;
    }, [storageBookings, selectedLocationId, searchTerm, vehiclesById, customersById]);

    const slots = useMemo(() => {
        if (!selectedLocation) return [];
        const slotArray = Array.from({ length: selectedLocation.capacity }, (_, i) => {
            const slotIdentifier = `${locationPrefix}-${String(i + 1).padStart(2, '0')}`;
            const booking = bookingsForLocation.find(b => b.slotIdentifier === slotIdentifier && !b.endDate);
            return {
                identifier: slotIdentifier,
                booking: booking || null,
            };
        });
        return slotArray;
    }, [selectedLocation, locationPrefix, bookingsForLocation]);

    const activeBookings = useMemo(() => {
        return slots.map(s => s.booking).filter((b): b is StorageBooking => !!b && !b.endDate);
    }, [slots]);
    
    const usageCount = activeBookings.length;
    const capacity = selectedLocation?.capacity || 0;
    const utilizationPercentage = capacity > 0 ? Math.min(100, (usageCount / capacity) * 100) : 0;


    const handleSelect = (bookingId: string) => {
        setSelectedBookingIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(bookingId)) {
                newSet.delete(bookingId);
            } else {
                newSet.add(bookingId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedBookingIds.size === activeBookings.length) {
            setSelectedBookingIds(new Set());
        } else {
            setSelectedBookingIds(new Set(activeBookings.map(b => b.id)));
        }
    };
    
    const handleBulkGenerateInvoices = () => {
        let invoicesGenerated = 0;
        let tempInvoices = [...invoices];
    
        const bookingsToUpdate: StorageBooking[] = [];
    
        selectedBookingIds.forEach(bookingId => {
            const booking = storageBookings.find(b => b.id === bookingId);
            if (!booking || booking.endDate) return;
    
            const billingStartDate = booking.lastBilledDate ? addDays(dateStringToDate(booking.lastBilledDate), 1) : dateStringToDate(booking.startDate);
            const daysToBill = 28;
            const billingEndDate = addDays(billingStartDate, daysToBill - 1);
            const durationWeeks = Math.ceil(daysToBill / 7);
            const totalCost = durationWeeks * booking.weeklyRate;
            const vehicle = vehicles.find(v => v.id === booking.vehicleId);
    
            const newInvoiceId = generateInvoiceId(tempInvoices, entity.shortCode || 'BSS');
            const newInvoice: Invoice = {
                id: newInvoiceId,
                entityId: booking.entityId,
                storageBookingId: booking.id,
                customerId: booking.customerId,
                issueDate: formatDate(new Date()),
                dueDate: formatDate(addDays(new Date(), 14)),
                status: 'Draft',
                lineItems: [{ id: crypto.randomUUID(), description: `Vehicle Storage for ${vehicle?.registration} (${formatDate(billingStartDate)} to ${formatDate(billingEndDate)})`, quantity: durationWeeks, unitPrice: booking.weeklyRate, isLabor: false, taxCodeId: taxRates.find(t=>t.code==='T1')?.id, isStorageCharge: true }],
                vehicleId: booking.vehicleId,
            };
            
            onSaveInvoice(newInvoice);
            tempInvoices.push(newInvoice);
            invoicesGenerated++;
    
            const updatedBooking = { 
                ...booking, 
                lastBilledDate: formatDate(billingEndDate), 
                invoiceIds: [...(booking.invoiceIds || []), newInvoiceId] 
            };
            bookingsToUpdate.push(updatedBooking);
        });
        
        bookingsToUpdate.forEach(onSaveBooking);
        
        setSelectedBookingIds(new Set());
        setConfirmation({
            isOpen: true,
            title: 'Bulk Invoicing Complete',
            message: `${invoicesGenerated} invoice(s) have been generated and saved as drafts.`,
            type: 'success',
        });
    };

    const isAllSelected = activeBookings.length > 0 && selectedBookingIds.size === activeBookings.length;
    const isSomeSelected = selectedBookingIds.size > 0 && !isAllSelected;

    return (
        <div className="w-full h-full flex flex-col p-6">
            <header className="flex justify-between items-center mb-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Vehicle Storage</h2>
                    <div className="flex flex-col">
                        <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)} className="p-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                            {storageLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                        </select>
                        {selectedLocation && (
                            <div className="flex items-center justify-between mt-1 px-1">
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2">
                                    <div 
                                        className={`h-1.5 rounded-full transition-all duration-500 ${utilizationPercentage > 90 ? 'bg-red-500' : utilizationPercentage > 75 ? 'bg-amber-500' : 'bg-green-500'}`} 
                                        style={{ width: `${utilizationPercentage}%` }}
                                    ></div>
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">{usageCount}/{capacity}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by reg or customer..."
                        className="w-64 p-2 pl-9 border rounded-lg"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={16}/>
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-shrink-0 mb-4">
                {selectedBookingIds.size > 0 ? (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center animate-fade-in">
                        <div className="flex items-center gap-4">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                ref={el => { if (el) { el.indeterminate = isSomeSelected; } }}
                                onChange={handleSelectAll}
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-indigo-800">{selectedBookingIds.size} booking(s) selected</span>
                        </div>
                        <button
                            onClick={handleBulkGenerateInvoices}
                            className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700"
                        >
                            <DollarSign size={16}/> Bill Selected (4 Weeks)
                        </button>
                    </div>
                ) : (
                    <div className="p-3 bg-gray-100 border rounded-lg flex items-center">
                        <input
                            type="checkbox"
                            checked={false}
                            onChange={handleSelectAll}
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="ml-4 font-semibold text-sm cursor-pointer" onClick={handleSelectAll}>
                            Select All Active Bookings
                        </label>
                    </div>
                )}
            </div>

            <main className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {slots.map(({ identifier, booking }) => {
                        const vehicle = booking ? vehiclesById.get(booking.vehicleId) : null;
                        const customer = booking ? customersById.get(booking.customerId) : null;
                        const hasActiveCharge = (booking?.chargingHistory || []).some(c => c.endDate === null);
                        const isSelected = booking ? selectedBookingIds.has(booking.id) : false;

                        return (
                            <div key={identifier} className={`border-2 rounded-lg p-3 flex flex-col transition-all duration-200 ${booking ? (isSelected ? 'bg-indigo-50 border-indigo-400' : 'bg-white hover:shadow-lg') : 'bg-gray-100'}`}>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {booking && (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelect(booking.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        )}
                                        <h3 className="font-bold text-gray-800">{identifier}</h3>
                                    </div>
                                    {booking && <span className={`text-xs font-bold px-2 py-1 rounded-full ${hasActiveCharge ? 'bg-yellow-100 text-yellow-800 animate-pulse' : 'bg-green-100 text-green-800'}`}>{hasActiveCharge ? 'Charging' : 'Stored'}</span>}
                                </div>
                                {booking ? (
                                    <div className="flex-grow flex flex-col justify-between mt-2 text-sm text-gray-700 space-y-2">
                                        <div>
                                            <p className="font-semibold">{vehicle?.make} {vehicle?.model}</p>
                                            <p className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-600 inline-block">{vehicle?.registration}</p>
                                            <p className="text-xs mt-1">Owner: {customer?.forename} {customer?.surname}</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                             {booking.keyNumber && (
                                                <div className="flex items-center gap-1 font-bold text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full text-xs">
                                                    <KeyRound size={12} />
                                                    <span>{booking.keyNumber}</span>
                                                </div>
                                            )}
                                            <button onClick={() => setManageModal({ isOpen: true, booking })} className="flex items-center justify-center gap-1.5 text-xs py-1 px-2 bg-indigo-100 text-indigo-800 font-semibold rounded-lg hover:bg-indigo-200">
                                                <MoreHorizontal size={14}/> Manage
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-grow flex items-center justify-center">
                                        <button onClick={() => setAddModal({ isOpen: true, locationId: selectedLocationId, slotIdentifier: identifier })} className="flex flex-col items-center text-gray-500 hover:text-indigo-600">
                                            <PlusCircle size={24}/>
                                            <span className="text-xs mt-1">Book In</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
            
            {addModal.isOpen && (
                <AddStorageBookingModal 
                    isOpen={addModal.isOpen} 
                    onClose={() => setAddModal({isOpen: false, locationId: '', slotIdentifier: ''})}
                    onSave={(newBooking) => {
                        onSaveBooking(newBooking);
                        setAddModal({isOpen: false, locationId: '', slotIdentifier: ''});
                    }}
                    locationId={addModal.locationId}
                    slotIdentifier={addModal.slotIdentifier}
                    vehicles={vehicles}
                    customers={customers}
                    defaultWeeklyRate={entity.defaultWeeklyStorageRate || 0}
                    onAddCustomerAndVehicle={onAddCustomerAndVehicle}
                />
            )}
            
            {manageModal.isOpen && currentBookingForModal && (
                <ManageStorageBookingModal
                    isOpen={manageModal.isOpen}
                    onClose={() => setManageModal({isOpen: false, booking: null})}
                    onSave={onSaveBooking}
                    onBookOutVehicle={onBookOutVehicle}
                    onGenerateInvoice={(booking) => {
                        const billingStartDate = booking.lastBilledDate ? addDays(dateStringToDate(booking.lastBilledDate), 1) : dateStringToDate(booking.startDate);
                        const daysToBill = 28;
                        const billingEndDate = addDays(billingStartDate, daysToBill - 1);
                        const durationWeeks = Math.ceil(daysToBill / 7);

                        const newInvoiceId = generateInvoiceId(invoices, entity.shortCode || 'BSS');
                        const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                        const newInvoice: Invoice = {
                            id: newInvoiceId,
                            entityId: booking.entityId,
                            storageBookingId: booking.id,
                            customerId: booking.customerId,
                            issueDate: formatDate(new Date()),
                            dueDate: formatDate(addDays(new Date(), 14)),
                            status: 'Draft',
                            lineItems: [{ id: crypto.randomUUID(), description: `Vehicle Storage for ${vehicle?.registration} (${formatDate(billingStartDate)} to ${formatDate(billingEndDate)})`, quantity: durationWeeks, unitPrice: booking.weeklyRate, isLabor: false, taxCodeId: taxRates.find(t=>t.code==='T1')?.id, isStorageCharge: true }],
                            notes: `Interim storage invoice.`,
                            vehicleId: booking.vehicleId,
                        };
                        onSaveInvoice(newInvoice);
                        onSaveBooking({ ...booking, lastBilledDate: formatDate(billingEndDate), invoiceIds: [...(booking.invoiceIds || []), newInvoiceId] });
                        setViewedInvoice(newInvoice);
                    }}
                    onViewInvoice={onViewInvoice}
                    booking={currentBookingForModal}
                    vehicle={vehiclesById.get(currentBookingForModal.vehicleId) || null}
                    customer={customersById.get(currentBookingForModal.customerId) || null}
                    batteryChargers={batteryChargers}
                    invoices={invoices}
                />
            )}
        </div>
    );
};
export default StorageView;