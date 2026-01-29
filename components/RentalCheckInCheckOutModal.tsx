import React, { useState, useEffect, useMemo } from 'react';
import { RentalBooking, Vehicle, RentalVehicle, DamagePoint } from '../types';
import FormModal from './FormModal';
import VehicleDamageReport from './VehicleDamageReport';
import { Milestone, Fuel, FilePenLine, Car, Trash2 } from 'lucide-react';

interface RentalCheckInCheckOutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedBooking: RentalBooking) => void;
    booking: RentalBooking;
    mode: 'checkOut' | 'checkIn';
    rentalVehicle: RentalVehicle;
    vehicle: Vehicle;
}

const RentalCheckInCheckOutModal: React.FC<RentalCheckInCheckOutModalProps> = ({ isOpen, onClose, onSave, booking, mode, rentalVehicle, vehicle }) => {
    const [mileage, setMileage] = useState('');
    const [fuelLevel, setFuelLevel] = useState(50);
    const [conditionNotes, setConditionNotes] = useState('');
    const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([]);
    const [additionalCharges, setAdditionalCharges] = useState<{ id: string; description: string; amount: number; }[]>([]);

    useEffect(() => {
        if (isOpen) {
            const details = mode === 'checkOut' ? booking.checkOutDetails : booking.checkInDetails;
            setMileage(details?.mileage?.toString() || '');
            setFuelLevel(details?.fuelLevel || 50);
            setConditionNotes(details?.conditionNotes || '');
            setDamagePoints(details?.damagePoints || (mode === 'checkIn' ? (booking.checkInDetails?.damagePoints || []) : booking.checkOutDetails?.damagePoints || []));
            setAdditionalCharges(booking.additionalCharges || []);
        }
    }, [isOpen, booking, mode]);

    const handleSave = () => {
        const updatedDetails = {
            mileage: parseInt(mileage, 10),
            fuelLevel,
            conditionNotes,
            timestamp: new Date().toISOString(),
            damagePoints
        };

        const updatedBooking = { ...booking };
        if (mode === 'checkOut') {
            updatedBooking.checkOutDetails = updatedDetails;
            updatedBooking.status = 'Active';
        } else {
            updatedBooking.checkInDetails = updatedDetails;
            updatedBooking.status = 'Completed';
            updatedBooking.additionalCharges = additionalCharges;
        }
        onSave(updatedBooking);
    };

    const handleAddCharge = () => setAdditionalCharges(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }]);
    const handleChargeChange = (id: string, field: 'description' | 'amount', value: string | number) => setAdditionalCharges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    const handleRemoveCharge = (id: string) => setAdditionalCharges(prev => prev.filter(c => c.id !== id));

    const diagramImageId = useMemo(() => {
        if (vehicle && Array.isArray(vehicle.images)) {
            const primaryVehicleImage = vehicle.images.find(img => img.isPrimaryDiagram);
            if (primaryVehicleImage) {
                return primaryVehicleImage.id;
            }
        }
        return rentalVehicle.damageCheckImageId || null;
    }, [vehicle, rentalVehicle]);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={`${mode === 'checkOut' ? 'Check Out' : 'Check In'} Vehicle: ${vehicle.registration}`} maxWidth="max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Milestone size={16}/> Mileage</label>
                        <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} className="w-full p-2 border rounded" placeholder="Enter current mileage" />
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Fuel size={16}/> Fuel Level: {fuelLevel}%</label>
                        <input type="range" min="0" max="100" step="5" value={fuelLevel} onChange={e => setFuelLevel(parseInt(e.target.value))} className="w-full" />
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><FilePenLine size={16}/> Condition Notes</label>
                        <textarea value={conditionNotes} onChange={e => setConditionNotes(e.target.value)} rows={3} className="w-full p-2 border rounded" placeholder="e.g., small scratch on driver door" />
                    </div>
                     {mode === 'checkIn' && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">Additional Charges</label>
                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                {additionalCharges.map(charge => (
                                    <div key={charge.id} className="flex items-center gap-2">
                                        <input type="text" value={charge.description} onChange={e => handleChargeChange(charge.id, 'description', e.target.value)} className="flex-grow p-1 border rounded text-sm" placeholder="Charge description" />
                                        <input type="number" value={charge.amount} onChange={e => handleChargeChange(charge.id, 'amount', parseFloat(e.target.value))} className="w-24 p-1 border rounded text-sm" placeholder="Amount" />
                                        <button onClick={() => handleRemoveCharge(charge.id)}><Trash2 size={16} className="text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddCharge} className="text-xs text-indigo-600 font-semibold mt-2">+ Add Charge</button>
                        </div>
                    )}
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Car size={16}/> Damage Report</label>
                    <p className="text-xs text-gray-500 mb-2">
                        {mode === 'checkOut' 
                            ? 'Click on the diagram to mark any existing damage.' 
                            : 'Check-out damage is marked in blue. Click to add new damage points in red.'
                        }
                    </p>
                    <VehicleDamageReport
                        activePoints={damagePoints}
                        onUpdate={setDamagePoints}
                        isReadOnly={false}
                        vehicleModel={vehicle.model}
                        imageId={diagramImageId}
                        activeColorClass={`bg-[${rentalVehicle.damageMarkerColors[mode]}]`}
                        referencePoints={mode === 'checkIn' && booking.checkOutDetails ? {
                            points: booking.checkOutDetails.damagePoints,
                            colorClass: `bg-[${rentalVehicle.damageMarkerColors.checkOut}]`
                        } : undefined}
                    />
                </div>
            </div>
        </FormModal>
    );
};

export default RentalCheckInCheckOutModal;