import React, { useMemo } from 'react';
import { 
    Briefcase, Calendar, Clock, User, 
    FileText, Tag, AlertCircle, Car, ExternalLink
} from 'lucide-react';
import { useData } from '../../../core/state/DataContext';
import { Job, Vehicle, Customer, RentalBooking } from '../../../types';

// Local formatter fallback
const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
};

interface JobDetailsTabProps {
    editableJob: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    isReadOnly: boolean;
    linkedBooking?: RentalBooking;
    rentalVehicleRegistration?: string;
    onBookCourtesyCar: () => void;
    onOpenRentalBooking: (booking: Partial<RentalBooking> | null) => void;
    onOpenConditionReport: (booking: RentalBooking, mode: 'checkOut' | 'checkIn') => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
}

const JobDetailsTab: React.FC<JobDetailsTabProps> = ({ 
    editableJob, 
    vehicle, 
    customer, 
    isReadOnly,
    linkedBooking,
    rentalVehicleRegistration,
    onBookCourtesyCar,
    onOpenRentalBooking,
    onOpenConditionReport,
    onChange,
    onViewCustomer,
    onViewVehicle 
}) => {

    if (!editableJob) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <AlertCircle size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-bold">Job Data Missing</p>
                <p className="text-sm">Please select a valid job to view details.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Customer Section */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <User size={16} />
                        </div>
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Customer</h3>
                    </div>
                    {customer && (
                        <button 
                            onClick={() => onViewCustomer(customer.id)}
                            className="text-indigo-600 hover:text-indigo-800 transition"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900">{customer?.name || 'Walk-in Customer'}</p>
                    {customer?.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                    {customer?.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                </div>
            </div>

            {/* Vehicle Section */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                            <Tag size={16} />
                        </div>
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Vehicle</h3>
                    </div>
                    {vehicle && (
                        <button 
                            onClick={() => onViewVehicle(vehicle.id)}
                            className="text-indigo-600 hover:text-indigo-800 transition"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-400 text-black px-2 py-1 rounded font-mono font-bold text-sm border border-black shadow-sm">
                        {vehicle?.registration || editableJob.vehicleRegistration || 'NO REG'}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">
                            {vehicle?.make} {vehicle?.model}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">
                            {vehicle?.vin || 'VIN Not Recorded'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Job Metadata */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Status</p>
                        <select 
                            name="status"
                            value={editableJob.status}
                            onChange={onChange}
                            disabled={isReadOnly}
                            className="w-full mt-1 text-sm font-bold bg-gray-50 border-none rounded-md p-1 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Draft">Draft</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Scheduled</p>
                        <input 
                            type="date"
                            name="scheduledDate"
                            value={editableJob.scheduledDate || ''}
                            onChange={onChange}
                            disabled={isReadOnly}
                            className="w-full mt-1 text-sm font-bold bg-gray-50 border-none rounded-md p-1"
                        />
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Work Description</p>
                <textarea 
                    name="description"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                    value={editableJob.description || ''} 
                    onChange={onChange}
                    disabled={isReadOnly}
                    placeholder="Enter job requirements..."
                />
            </div>

            {/* Courtesy Car Section */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Car size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Courtesy Vehicle</h3>
                </div>
                
                {linkedBooking ? (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                            <span className="text-sm font-bold text-emerald-800">{rentalVehicleRegistration || 'Vehicle Assigned'}</span>
                            <button 
                                onClick={() => onOpenRentalBooking(linkedBooking)}
                                className="text-[10px] font-bold text-emerald-700 underline"
                            >
                                View Booking
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => onOpenConditionReport(linkedBooking, 'checkOut')}
                                className="text-[10px] py-2 bg-white border border-emerald-200 text-emerald-700 rounded-md font-bold hover:bg-emerald-50"
                            >
                                Check Out
                            </button>
                            <button 
                                onClick={() => onOpenConditionReport(linkedBooking, 'checkIn')}
                                className="text-[10px] py-2 bg-white border border-emerald-200 text-emerald-700 rounded-md font-bold hover:bg-emerald-50"
                            >
                                Check In
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={onBookCourtesyCar}
                        disabled={isReadOnly}
                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all"
                    >
                        + Assign Courtesy Car
                    </button>
                )}
            </div>
        </div>
    );
};

export default JobDetailsTab;