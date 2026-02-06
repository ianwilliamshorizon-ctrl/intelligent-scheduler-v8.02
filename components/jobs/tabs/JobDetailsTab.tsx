import React, { useState } from 'react';
import { Job, Vehicle, Customer, RentalBooking } from '../../../types';
import { Car, CarFront, Wrench, ChevronUp, ChevronDown, User, ExternalLink } from 'lucide-react';

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50/70 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
                {isOpen ? <ChevronUp size={20} className="text-gray-600"/> : <ChevronDown size={20} className="text-gray-600"/>}
            </h3>
            {isOpen && <div className="p-4">{children}</div>}
        </div>
    );
};

interface JobDetailsTabProps {
    editableJob: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    isReadOnly: boolean;
    linkedBooking?: RentalBooking;
    rentalVehicleRegistration?: string;
    onBookCourtesyCar: () => void;
    onOpenRentalBooking: (booking: RentalBooking) => void;
    onOpenConditionReport: (booking: RentalBooking, mode: 'checkOut' | 'checkIn') => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewVehicle?: (vehicleId: string) => void;
}

export const JobDetailsTab: React.FC<JobDetailsTabProps> = ({ 
    editableJob, vehicle, customer, isReadOnly, linkedBooking, rentalVehicleRegistration,
    onBookCourtesyCar, onOpenRentalBooking, onOpenConditionReport, onChange, onViewCustomer, onViewVehicle 
}) => {
    return (
        <div className="space-y-4">
            <Section title="Customer & Vehicle" icon={Car}>
                <div className="text-sm space-y-3">
                    {/* Customer Section */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-600">Customer:</span>
                            {customer && onViewCustomer && (
                                <button 
                                    onClick={() => onViewCustomer(customer.id)}
                                    className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1 font-semibold transition-colors"
                                >
                                    <ExternalLink size={12}/> View 360° Profile
                                </button>
                            )}
                        </div>
                        {customer ? (
                            <div className="p-2 bg-gray-50 rounded border border-gray-100 font-medium">
                                {customer.forename} {customer.surname}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">Unknown Customer</p>
                        )}
                    </div>

                    {/* Vehicle Section */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-600">Vehicle:</span>
                            {vehicle && onViewVehicle && (
                                <button 
                                    onClick={() => onViewVehicle(vehicle.id)}
                                    className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1 font-semibold transition-colors"
                                >
                                    <ExternalLink size={12}/> View History
                                </button>
                            )}
                        </div>
                        {vehicle ? (
                             <div className="p-2 bg-gray-50 rounded border border-gray-100 font-medium">
                                {vehicle.make} {vehicle.model} <span className="font-mono bg-gray-200 px-1 rounded text-xs ml-1">{vehicle.registration}</span>
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">Unknown Vehicle</p>
                        )}
                    </div>
                </div>
            </Section>

            {/* Courtesy Car Section */}
            <Section title="Courtesy Car / Rental" icon={CarFront}>
                <div className="text-sm space-y-2">
                    {linkedBooking ? (
                        <div>
                            <p><strong>Status:</strong> <span className="font-semibold">{linkedBooking.status}</span></p>
                            <p><strong>Vehicle:</strong> {rentalVehicleRegistration}</p>
                            <p><strong>Dates:</strong> {new Date(linkedBooking.startDate).toLocaleString()} to {new Date(linkedBooking.endDate).toLocaleString()}</p>
                            <button onClick={() => onOpenRentalBooking(linkedBooking)} className="mt-2 text-indigo-600 font-semibold hover:underline">Manage Booking</button>
                            
                            <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                                {!linkedBooking.checkOutDetails ? (
                                    <button onClick={() => onOpenConditionReport(linkedBooking, 'checkOut')} className="w-full py-2 px-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Check Out Vehicle</button>
                                ) : !linkedBooking.checkInDetails ? (
                                    <button onClick={() => onOpenConditionReport(linkedBooking, 'checkIn')} className="w-full py-2 px-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Check In Vehicle</button>
                                ) : (
                                    <p className="text-sm text-center text-green-700 font-semibold">Vehicle Returned</p>
                                )}
                            </div>

                            {linkedBooking.checkOutDetails && (
                                <div className="mt-2 text-xs p-2 bg-gray-100 rounded">
                                    <p className="font-bold">Checked Out:</p>
                                    <p>Mileage: {linkedBooking.checkOutDetails.mileage.toLocaleString()}, Fuel: {linkedBooking.checkOutDetails.fuelLevel}%</p>
                                </div>
                            )}
                            {linkedBooking.checkInDetails && (
                                <div className="mt-1 text-xs p-2 bg-gray-100 rounded">
                                    <p className="font-bold">Checked In:</p>
                                    <p>Mileage: {linkedBooking.checkInDetails.mileage.toLocaleString()}, Fuel: {linkedBooking.checkInDetails.fuelLevel}%</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={onBookCourtesyCar} className="w-full py-2 px-3 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200">Book Courtesy Car</button>
                    )}
                </div>
            </Section>

            {/* Job Details Section */}
            <Section title="Job Details" icon={Wrench}>
                <div className="space-y-3 text-sm">
                    <div><label className="font-semibold">Description</label><input name="description" value={editableJob.description} onChange={onChange} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                    <div><label className="font-semibold">Booking Notes</label><textarea name="notes" value={editableJob.notes || ''} onChange={onChange} rows={3} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="font-semibold">Mileage In</label><input name="mileage" type="number" value={editableJob.mileage || ''} onChange={onChange} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                        <div><label className="font-semibold">Key Number</label><input name="keyNumber" type="text" value={editableJob.keyNumber || ''} onChange={onChange} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                    </div>
                </div>
            </Section>
        </div>
    );
};