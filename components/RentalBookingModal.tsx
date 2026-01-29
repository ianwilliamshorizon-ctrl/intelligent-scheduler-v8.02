import React, { useState, useEffect, useMemo } from 'react';
import { RentalBooking, Vehicle, RentalVehicle, Customer, Job, BusinessEntity } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { formatDate, addDays, daysBetween } from '../core/utils/dateUtils';
import { generateRentalBookingId } from '../core/utils/numberGenerators';
import { Trash2 } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface RentalBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (booking: RentalBooking) => void;
    booking: Partial<RentalBooking> | null;
    vehicles: Vehicle[];
    rentalVehicles: RentalVehicle[];
    customers: Customer[];
    jobs: Job[];
    rentalEntities: BusinessEntity[];
}

const RentalBookingModal: React.FC<RentalBookingModalProps> = ({ isOpen, onClose, onSave, booking, vehicles, rentalVehicles, customers, jobs, rentalEntities }) => {
    const [formData, setFormData] = useState<Partial<RentalBooking>>({});
    const [additionalCharges, setAdditionalCharges] = useState<{ id: string; description: string; amount: number; }[]>([]);

    useEffect(() => {
        if (isOpen) {
            setFormData(booking ? { ...booking } : {
                entityId: rentalEntities[0]?.id,
                startDate: formatDate(new Date()) + 'T09:00',
                endDate: formatDate(addDays(new Date(), 3)) + 'T17:00',
                bookingType: 'Courtesy Car',
                status: 'Active',
            });
            setAdditionalCharges(booking?.additionalCharges || []);
        }
    }, [isOpen, booking, rentalEntities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    };

    const handleAddCharge = () => setAdditionalCharges(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }]);
    const handleChargeChange = (id: string, field: 'description' | 'amount', value: string | number) => setAdditionalCharges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    const handleRemoveCharge = (id: string) => setAdditionalCharges(prev => prev.filter(c => c.id !== id));

    const selectedRentalVehicle = useMemo(() => rentalVehicles.find(rv => rv.id === formData.rentalVehicleId), [rentalVehicles, formData.rentalVehicleId]);
    const vehicle = useMemo(() => selectedRentalVehicle ? vehicles.find(v => v.id === selectedRentalVehicle.id) : null, [selectedRentalVehicle, vehicles]);

    const totalCost = useMemo(() => {
        if (!formData.startDate || !formData.endDate || !selectedRentalVehicle) return 0;
        
        // Calculate rental cost only if type is 'Rental'
        let rentalCost = 0;
        if (formData.bookingType === 'Rental') {
            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);
            const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            
            const weeks = Math.floor(days / 7);
            const remainingDays = days % 7;
            
            rentalCost = (weeks * selectedRentalVehicle.weeklyRate) + (remainingDays * selectedRentalVehicle.dailyRate);
        }

        const chargesTotal = additionalCharges.reduce((sum, c) => sum + c.amount, 0);
        
        return rentalCost + chargesTotal;
    }, [formData.startDate, formData.endDate, selectedRentalVehicle, formData.bookingType, additionalCharges]);

    const handleSave = () => {
        if (!formData.rentalVehicleId || !formData.customerId || !formData.startDate || !formData.endDate) {
            alert('Vehicle, Customer, Start Date, and End Date are required.');
            return;
        }

        const bookingToSave: RentalBooking = {
            id: formData.id || generateRentalBookingId([]), // In a real scenario, pass all bookings to generate ID
            totalCost: totalCost,
            additionalCharges: additionalCharges,
            ...formData,
        } as RentalBooking;
        
        onSave(bookingToSave);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={booking?.id ? 'Edit Booking' : 'New Booking'} maxWidth="max-w-2xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle*</label>
                        <SearchableSelect
                            options={rentalVehicles.map(rv => {
                                const v = vehicles.find(vh => vh.id === rv.id);
                                return { id: rv.id, label: `${v?.registration} - ${v?.make} ${v?.model}` };
                            })}
                            value={formData.rentalVehicleId || null}
                            onChange={(value) => setFormData(p => ({ ...p, rentalVehicleId: value || '' }))}
                            placeholder="Select rental vehicle..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer*</label>
                        <SearchableSelect
                            options={customers.map(c => ({ id: c.id, label: getCustomerDisplayName(c) }))}
                            value={formData.customerId || null}
                            onChange={(value) => setFormData(p => ({ ...p, customerId: value || '' }))}
                            placeholder="Select customer..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time*</label>
                        <input name="startDate" type="datetime-local" value={formData.startDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date/Time*</label>
                        <input name="endDate" type="datetime-local" value={formData.endDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Booking Type</label>
                        <select name="bookingType" value={formData.bookingType || 'Courtesy Car'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option value="Courtesy Car">Courtesy Car</option>
                            <option value="Rental">Paid Rental</option>
                        </select>
                    </div>
                    {formData.bookingType === 'Courtesy Car' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Linked Job</label>
                            <SearchableSelect
                                options={jobs.filter(j => j.customerId === formData.customerId).map(j => ({ id: j.id, label: `${j.id} - ${j.description}` }))}
                                value={formData.jobId || null}
                                onChange={(value) => setFormData(p => ({ ...p, jobId: value || '' }))}
                                placeholder="Link to a job..."
                                disabled={!formData.customerId}
                            />
                        </div>
                    )}
                </div>

                <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Charges</label>
                    <div className="space-y-2">
                        {additionalCharges.map(charge => (
                            <div key={charge.id} className="flex gap-2 items-center">
                                <input type="text" value={charge.description} onChange={e => handleChargeChange(charge.id, 'description', e.target.value)} placeholder="Description" className="flex-grow p-2 border rounded text-sm"/>
                                <input type="number" value={charge.amount} onChange={e => handleChargeChange(charge.id, 'amount', parseFloat(e.target.value))} placeholder="Amount" className="w-24 p-2 border rounded text-sm"/>
                                <button onClick={() => handleRemoveCharge(charge.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        <button onClick={handleAddCharge} className="text-xs text-indigo-600 font-semibold">+ Add Charge</button>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Estimated Total Cost:</p>
                            <p className="text-xl font-bold text-gray-800">{`£${totalCost.toFixed(2)}`}</p>
                        </div>
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default RentalBookingModal;