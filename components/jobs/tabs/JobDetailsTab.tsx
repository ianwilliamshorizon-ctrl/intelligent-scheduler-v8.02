import React, { useState } from 'react';
import * as T from '../../../types';
import { Car, User, KeyRound, Calendar, Clock, Edit, Phone, Mail, MapPin, Building, Briefcase, Expand, ImageIcon, X } from 'lucide-react';

interface TabSectionProps {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

const TabSection: React.FC<TabSectionProps> = ({ title, icon: Icon, children, actions }) => (
    <div className="border rounded-lg bg-white shadow-sm">
        <h3 className="text-md font-bold p-3 flex justify-between items-center bg-gray-50 rounded-t-lg">
            <span className="flex items-center gap-2"><Icon size={16}/> {title}</span>
            {actions}
        </h3>
        <div className="p-3 text-sm space-y-2">{children}</div>
    </div>
);

interface JobDetailsTabProps {
    editableJob: T.Job;
    vehicle?: T.Vehicle;
    customer?: T.Customer;
    isReadOnly: boolean;
    linkedBooking?: T.RentalBooking;
    rentalVehicleRegistration?: string;
    onBookCourtesyCar: () => void;
    onOpenRentalBooking: (booking: T.RentalBooking) => void;
    onOpenConditionReport: (booking: T.RentalBooking, mode: 'checkOut' | 'checkIn') => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
    engineers: T.Engineer[];
    onCheckIn: () => void;
    onCheckOut: () => void;
}

const JobDetailsTab: React.FC<JobDetailsTabProps> = ({ 
    editableJob, vehicle, customer, isReadOnly, linkedBooking, rentalVehicleRegistration, 
    onBookCourtesyCar, onOpenRentalBooking, onOpenConditionReport, onChange, onViewCustomer, 
    onViewVehicle, engineers, onCheckIn, onCheckOut 
}) => {
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    
    const handleNotesSave = (newNotes: string) => {
        onChange({ target: { name: 'notes', value: newNotes } } as React.ChangeEvent<HTMLTextAreaElement>);
        setIsNotesModalOpen(false);
    };
    
    return (
        <div className="space-y-4">
             <TabSection title="Key Details" icon={KeyRound}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-500"/><strong>Scheduled:</strong> <span>{editableJob.scheduledDate}</span></div>
                    <div className="flex items-center gap-2"><Clock size={14} className="text-gray-500"/><strong>Est. Hours:</strong> <span>{editableJob.estimatedHours || 'N/A'}</span></div>
                    <div className="flex items-center gap-2"><User size={14} className="text-gray-500"/><strong>Assigned To:</strong>
                        {isReadOnly ? (
                            <span>{engineers.find(e => e.id === editableJob.engineerId)?.name || 'N/A'}</span>
                        ) : (
                            <select name="engineerId" value={editableJob.engineerId || ''} onChange={onChange} className="p-1 border rounded bg-white text-sm w-full">
                                <option value="">Unassigned</option>
                                {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="flex items-center gap-2"><Briefcase size={14} className="text-gray-500"/><strong>Type:</strong> 
                        {isReadOnly ? (
                            <span>{editableJob.jobType}</span>
                        ) : (
                            <select name="jobType" value={editableJob.jobType} onChange={onChange} className="p-1 border rounded bg-white text-sm w-full">
                                <option>Standard</option>
                                <option>Internal</option>
                                <option>Warranty</option>
                            </select>
                        )}
                    </div>
                </div>
            </TabSection>

            {customer && (
                <TabSection title="Customer Details" icon={User} actions={<button type="button" onClick={() => onViewCustomer(customer.id)} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100">View Full</button>}>
                    <p className="font-bold text-base">{customer.forename} {customer.surname}</p>
                    {customer.companyName && <p className="flex items-center gap-2 text-gray-600"><Building size={14}/> {customer.companyName}</p>}
                    <p className="flex items-center gap-2"><Mail size={14} className="text-gray-500"/> {customer.email}</p>
                    <p className="flex items-center gap-2"><Phone size={14} className="text-gray-500"/> {customer.mobile || customer.phone}</p>
                    <p className="flex items-center gap-2"><MapPin size={14} className="text-gray-500"/> {`${customer.addressLine1}, ${customer.city}, ${customer.postcode}`}</p>
                </TabSection>
            )}
            
            {vehicle && (
                <TabSection title="Vehicle Details" icon={Car} actions={<button type="button" onClick={() => onViewVehicle(vehicle.id)} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100">View Full</button>}>
                    <p className="font-bold text-base">{vehicle.registration}</p>
                    <p className="text-gray-600">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
                    <p className="text-xs font-mono bg-gray-100 p-1 rounded inline-block">VIN: {vehicle.vin}</p>
                </TabSection>
            )}

            <TabSection title="Job Status & Actions" icon={Briefcase}>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <label htmlFor="jobStatus" className="font-semibold">Status:</label>
                        <select id="jobStatus" name="status" value={editableJob.status} onChange={onChange} className="p-1 border rounded bg-white text-sm w-full" disabled={isReadOnly}>
                            <option>Unallocated</option>
                            <option>Allocated</option>
                            <option>In Progress</option>
                            <option>Paused</option>
                            <option>Pending QC</option>
                            <option>Complete</option>
                            <option>Invoiced</option>
                            <option>Closed</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <button onClick={onCheckIn} disabled={!!editableJob.checkInTimestamp} className="py-2 px-3 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 text-sm">Vehicle Check-in</button>
                        <button onClick={onCheckOut} disabled={!!editableJob.checkOutTimestamp} className="py-2 px-3 bg-green-500 text-white rounded-lg disabled:bg-gray-300 text-sm">Vehicle Check-out</button>
                    </div>
                </div>
            </TabSection>

             <div className="border rounded-lg bg-white shadow-sm">
                <h3 className="text-md font-bold p-3 flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <span className="flex items-center gap-2"><ImageIcon size={16}/> Notes & Media</span>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setIsNotesModalOpen(true)} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm"><Expand size={14}/> Expand</button>
                    </div>
                </h3>
                <div className="p-3">
                    <textarea 
                        name="notes" 
                        value={editableJob.notes || ''} 
                        onChange={onChange} 
                        rows={8} 
                        className="w-full p-2 border rounded text-sm" 
                        placeholder="Internal notes for the job..." 
                        disabled={isReadOnly} 
                    />
                </div>
            </div>

            {isNotesModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                        <header className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-bold">Job Notes</h2>
                            <button onClick={() => setIsNotesModalOpen(false)}><X size={24} /></button>
                        </header>
                        <div className="flex-grow p-4">
                            <textarea
                                value={editableJob.notes || ''}
                                onChange={onChange}
                                name="notes"
                                className="w-full h-full p-2 border rounded resize-none text-sm"
                                placeholder="Enter notes..."
                                readOnly={isReadOnly}
                            />
                        </div>
                        <footer className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => setIsNotesModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
                            {!isReadOnly && <button onClick={() => handleNotesSave(editableJob.notes || '')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>}
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobDetailsTab;
