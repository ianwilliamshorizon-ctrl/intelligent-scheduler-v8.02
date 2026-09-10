import React from 'react';
import { Inquiry, Vehicle, Customer, Estimate, BusinessEntity, Job } from '../types';
import { getCustomerDisplayName } from '../utils/customerUtils';
import { Printer, CalendarCheck, ListFilter } from 'lucide-react';

interface PrintableInquiryListProps {
    inquiries: Inquiry[];
    vehicles: Vehicle[];
    customers: Customer[];
    estimates?: Estimate[];
    users?: any[];
    entities?: BusinessEntity[];
    jobs?: Job[];
    initialFilter?: 'all' | 'scheduled';
    title: string;
    isOpen?: boolean;
    onClose?: () => void;
}

export const PrintableInquiryList: React.FC<PrintableInquiryListProps> = ({
    inquiries,
    vehicles,
    customers,
    estimates = [],
    users = [],
    entities = [],
    jobs = [],
    initialFilter = 'all',
    title,
    isOpen = false,
    onClose
}) => {
    const [filterMode, setFilterMode] = React.useState<'all' | 'scheduled'>(initialFilter);

    React.useEffect(() => {
        if (isOpen) {
            setFilterMode(initialFilter);
        }
    }, [isOpen, initialFilter]);

    const vehiclesById = React.useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = React.useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const estimatesById = React.useMemo(() => new Map(estimates.map(e => [e.id, e])), [estimates]);
    const usersById = React.useMemo(() => new Map(users.map(u => [u.id, u.name || u.email])), [users]);
    const entitiesById = React.useMemo(() => new Map(entities.map(e => [e.id, e.name])), [entities]);
    const jobsById = React.useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);

    const resolveLinkedJob = React.useCallback((inquiry: Inquiry): Job | null => {
        if (inquiry.linkedJobId && jobsById.has(inquiry.linkedJobId)) {
            return jobsById.get(inquiry.linkedJobId) || null;
        }
        const byAssoc = jobs.find(j => (j as any).associatedInquiryId === inquiry.id);
        if (byAssoc) return byAssoc;
        if (inquiry.linkedEstimateId && estimatesById.has(inquiry.linkedEstimateId)) {
            const est = estimatesById.get(inquiry.linkedEstimateId);
            if (est?.jobId && jobsById.has(est.jobId)) {
                return jobsById.get(est.jobId) || null;
            }
        }
        return null;
    }, [jobs, jobsById, estimatesById]);

    const checkIsScheduled = React.useCallback((inquiry: Inquiry): boolean => {
        const job = resolveLinkedJob(inquiry);
        return inquiry.status === 'Scheduled' || Boolean(inquiry.linkedJobId) || Boolean(job);
    }, [resolveLinkedJob]);

    const scheduledCount = React.useMemo(() => {
        return inquiries.filter(checkIsScheduled).length;
    }, [inquiries, checkIsScheduled]);

    const displayInquiries = React.useMemo(() => {
        if (filterMode === 'scheduled') {
            return inquiries.filter(checkIsScheduled);
        }
        return inquiries;
    }, [inquiries, filterMode, checkIsScheduled]);

    const handlePrint = () => {
        window.print();
    };

    const resolveRegNo = (inquiry: Inquiry): string => {
        if (inquiry.linkedVehicleId && vehiclesById.has(inquiry.linkedVehicleId)) {
            const v = vehiclesById.get(inquiry.linkedVehicleId);
            if (v?.registration) return v.registration;
        }
        if (inquiry.vehicleRegistration && inquiry.vehicleRegistration.trim()) {
            return inquiry.vehicleRegistration.trim();
        }
        if (inquiry.linkedEstimateId && estimatesById.has(inquiry.linkedEstimateId)) {
            const est = estimatesById.get(inquiry.linkedEstimateId);
            if ((est as any)?.vehicleRegistration) return (est as any).vehicleRegistration;
            if (est?.vehicleId && vehiclesById.has(est.vehicleId)) {
                return vehiclesById.get(est.vehicleId)?.registration || '';
            }
        }
        return '';
    };

    const getAssignedName = (inquiry: Inquiry): string => {
        if (inquiry.assignedToUserId && usersById.has(inquiry.assignedToUserId)) {
            return usersById.get(inquiry.assignedToUserId) || '';
        }
        if (inquiry.assignedToEntityId && entitiesById.has(inquiry.assignedToEntityId)) {
            return entitiesById.get(inquiry.assignedToEntityId) || '';
        }
        return '-';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            {/* Modal Controls (Hidden during print) */}
            <div className="print:hidden fixed top-4 right-4 flex items-center gap-3 z-50">
                <div className="bg-white/95 backdrop-blur-sm border border-gray-200 p-1 rounded-xl shadow-lg flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setFilterMode('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            filterMode === 'all'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <ListFilter size={14} />
                        <span>All Inquiries ({inquiries.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterMode('scheduled')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            filterMode === 'scheduled'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <CalendarCheck size={14} />
                        <span>Scheduled Only ({scheduledCount})</span>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition cursor-pointer"
                >
                    <Printer size={18} />
                    <span>Print {filterMode === 'scheduled' ? 'Scheduled' : 'List'}</span>
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-bold shadow-lg transition border cursor-pointer"
                >
                    Close
                </button>
            </div>

            {/* Printable Content */}
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8 print:p-0 print:shadow-none print:max-w-none print:max-h-none print:overflow-visible">
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        @page { 
                            size: A4 portrait;
                            margin: 10mm; 
                        }
                        body * { 
                            visibility: hidden !important; 
                        }
                        .inquiry-print-container, .inquiry-print-container * { 
                            visibility: visible !important; 
                        }
                        .inquiry-print-container { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important;
                            background: white !important;
                            padding: 0 !important;
                        }
                        table { 
                            width: 100% !important; 
                            border-collapse: collapse !important; 
                            margin-top: 15px !important;
                        }
                        th { 
                            background-color: #f3f4f6 !important; 
                            -webkit-print-color-adjust: exact; 
                        }
                        td, th { 
                            border: 1px solid #d1d5db !important; 
                            padding: 6px 8px !important; 
                            color: #111827 !important; 
                            font-size: 10px !important;
                        }
                    }
                `}} />

                <div className="inquiry-print-container font-sans text-gray-800">
                    <header className="pb-4 border-b border-gray-300 flex justify-between items-end mb-4">
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                {filterMode === 'scheduled' ? 'Scheduled Inquiries List' : 'Inquiries List'}
                            </h1>
                            <p className="text-sm font-semibold text-indigo-600">
                                {filterMode === 'scheduled' ? `${title} • Scheduled Inquiries Only` : title}
                            </p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                            <p>Total Items: <span className="font-bold text-gray-800">{displayInquiries.length}</span></p>
                            <p>Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </header>

                    <main>
                        {displayInquiries.length === 0 ? (
                            <p className="text-center py-8 text-gray-500 italic">
                                {filterMode === 'scheduled' ? 'No scheduled inquiries found.' : 'No inquiries to print.'}
                            </p>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700 uppercase tracking-wider text-[10px] font-bold">
                                        <th className="p-2 border border-gray-300">Inquiry #</th>
                                        <th className="p-2 border border-gray-300">Date/Time</th>
                                        <th className="p-2 border border-gray-300">Customer</th>
                                        <th className="p-2 border border-gray-300">Reg No</th>
                                        {filterMode === 'scheduled' && (
                                            <>
                                                <th className="p-2 border border-gray-300">Job #</th>
                                                <th className="p-2 border border-gray-300">Scheduled Date</th>
                                            </>
                                        )}
                                        <th className="p-2 border border-gray-300">Status</th>
                                        <th className="p-2 border border-gray-300">Subject / Message</th>
                                        <th className="p-2 border border-gray-300">Assigned To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayInquiries.map(inquiry => {
                                        const customer = inquiry.linkedCustomerId ? customersById.get(inquiry.linkedCustomerId) : null;
                                        const customerName = customer ? getCustomerDisplayName(customer) : inquiry.fromName;
                                        const regNo = resolveRegNo(inquiry);
                                        const assignedTo = getAssignedName(inquiry);
                                        const linkedJob = resolveLinkedJob(inquiry);
                                        const scheduledDateStr = linkedJob?.scheduledDate 
                                            ? new Date(linkedJob.scheduledDate).toLocaleDateString('en-GB')
                                            : (inquiry.followUpDate ? new Date(inquiry.followUpDate).toLocaleDateString('en-GB') : '-');

                                        return (
                                            <tr key={inquiry.id} className="hover:bg-gray-50">
                                                <td className="p-2 border border-gray-300 font-mono font-bold">{inquiry.inquiryNumber || inquiry.id.substring(0, 8)}</td>
                                                <td className="p-2 border border-gray-300 font-mono text-[10px]">
                                                    {new Date(inquiry.createdAt).toLocaleDateString('en-GB')} {new Date(inquiry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-2 border border-gray-300 font-semibold">{customerName}</td>
                                                <td className="p-2 border border-gray-300 font-mono font-bold text-blue-800">
                                                    {regNo || '-'}
                                                </td>
                                                {filterMode === 'scheduled' && (
                                                    <>
                                                        <td className="p-2 border border-gray-300 font-mono font-bold text-emerald-800">
                                                            {linkedJob?.jobNumber || (linkedJob?.id ? linkedJob.id.substring(0, 8) : '-')}
                                                        </td>
                                                        <td className="p-2 border border-gray-300 font-semibold text-gray-900">
                                                            {scheduledDateStr}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="p-2 border border-gray-300 font-semibold">{inquiry.status}</td>
                                                <td className="p-2 border border-gray-300 max-w-[250px] truncate" title={inquiry.subject || inquiry.message}>
                                                    {inquiry.subject ? <span className="font-semibold">{inquiry.subject}: </span> : null}
                                                    {inquiry.message}
                                                </td>
                                                <td className="p-2 border border-gray-300">{assignedTo}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default PrintableInquiryList;
