import React, { useMemo } from 'react';
import { 
    Briefcase, Calendar, Clock, User, 
    FileText, Tag, AlertCircle
} from 'lucide-react';
// Fixed paths: moving up two levels (../../) to reach core and types
import { useData } from '../../../core/state/DataContext';
import { Job } from '../../../types';

// Local formatter fallback to avoid module resolution issues
const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

interface JobDetailsTabProps {
    job: Job | undefined;
}

const JobDetailsTab: React.FC<JobDetailsTabProps> = ({ job }) => {
    const { customers } = useData();

    // Safely find customer
    const customer = useMemo(() => {
        if (!job || !job.customerId) return null;
        return customers.find(c => c.id === job.customerId);
    }, [job, customers]);

    // Error safety: If job is undefined, prevent the crash
    if (!job) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <AlertCircle size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-bold">Job Data Missing</p>
                <p className="text-sm">Please select a valid job to view details.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Briefcase size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Job Reference</span>
                    </div>
                    <p className="text-lg font-black text-gray-900">{job.id || 'N/A'}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Clock size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${job.status === 'Completed' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <p className="text-lg font-black text-gray-900">{job.status || 'Draft'}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Calendar size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Created Date</span>
                    </div>
                    <p className="text-lg font-black text-gray-900">
                        {job.createdAt ? formatDate(job.createdAt) : 'No Date'}
                    </p>
                </div>
            </div>

            {/* Description Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Primary Description</h3>
                </div>
                <div className="p-6">
                    <textarea 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                        value={job.description || ''} 
                        readOnly
                    />
                </div>
            </div>

            {/* Customer & Vehicle Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <User size={18} />
                        </div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Customer Information</h3>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase">Name</p>
                            <p className="font-bold text-gray-900">{customer?.name || 'Walk-in Customer'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <Tag size={18} />
                        </div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Vehicle Reference</h3>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase">Registration / VIN</p>
                            <p className="font-black text-gray-900 text-lg uppercase tracking-tight">
                                {job.vehicleRegistration || 'NO REG'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Default export matches what EditJobModal expects
export default JobDetailsTab;