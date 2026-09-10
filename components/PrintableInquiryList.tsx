import React from 'react';
import { Inquiry, Vehicle, Customer, Estimate, BusinessEntity, Job } from '../types';
import { getCustomerDisplayName } from '../utils/customerUtils';
import { Printer, CalendarCheck, ListFilter, Loader2, ArrowUpDown, LayoutTemplate, ArrowUp, ArrowDown } from 'lucide-react';
import { usePrint } from '../core/hooks/usePrint';
import { getEffectiveInquiryScheduledDate, getEffectiveJobScheduledDate } from '../core/utils/dateUtils';

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

export interface PrintableInquirySheetProps {
    inquiries: Inquiry[];
    vehiclesById: Map<string, Vehicle>;
    customersById: Map<string, Customer>;
    estimatesById: Map<string, Estimate>;
    usersById: Map<string, string>;
    entitiesById: Map<string, string>;
    jobsById: Map<string, Job>;
    jobs: Job[];
    filterMode: 'all' | 'scheduled';
    sortBy?: 'scheduledDate' | 'createdAt' | 'inquiryNumber' | 'customer';
    sortOrder?: 'asc' | 'desc';
    onSortChange?: (field: 'scheduledDate' | 'createdAt' | 'inquiryNumber' | 'customer') => void;
    orientation?: 'landscape' | 'portrait';
    title: string;
}

export const PrintableInquirySheet: React.FC<PrintableInquirySheetProps> = ({
    inquiries,
    vehiclesById,
    customersById,
    estimatesById,
    usersById,
    entitiesById,
    jobsById,
    jobs,
    filterMode,
    sortBy = 'scheduledDate',
    sortOrder = 'asc',
    onSortChange,
    orientation = 'landscape',
    title
}) => {
    const resolveLinkedJob = (inquiry: Inquiry): Job | null => {
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
    };

    const resolveVehicleInfo = (inquiry: Inquiry): { reg: string; details: string } => {
        let v: Vehicle | undefined = undefined;
        if (inquiry.linkedVehicleId && vehiclesById.has(inquiry.linkedVehicleId)) {
            v = vehiclesById.get(inquiry.linkedVehicleId);
        } else if (inquiry.linkedEstimateId && estimatesById.has(inquiry.linkedEstimateId)) {
            const est = estimatesById.get(inquiry.linkedEstimateId);
            if (est?.vehicleId && vehiclesById.has(est.vehicleId)) {
                v = vehiclesById.get(est.vehicleId);
            }
        }
        if (!v) {
            const job = resolveLinkedJob(inquiry);
            if (job?.vehicleId && vehiclesById.has(job.vehicleId)) {
                v = vehiclesById.get(job.vehicleId);
            }
        }

        const reg = (v?.registration && v.registration.trim())
            || (inquiry.vehicleRegistration && inquiry.vehicleRegistration.trim())
            || (inquiry.linkedEstimateId && (estimatesById.get(inquiry.linkedEstimateId) as any)?.vehicleRegistration)
            || '';

        const make = (v?.make && v.make.toLowerCase() !== 'unknown')
            ? v.make
            : (inquiry.vehicleMake && inquiry.vehicleMake.toLowerCase() !== 'unknown' ? inquiry.vehicleMake : '');

        const model = (v?.model && v.model.toLowerCase() !== 'unknown')
            ? v.model
            : (inquiry.vehicleModel && inquiry.vehicleModel.toLowerCase() !== 'unknown' ? inquiry.vehicleModel : '');

        const type = (v?.type && v.type.toLowerCase() !== 'unknown')
            ? v.type
            : ((inquiry as any).vehicleType && (inquiry as any).vehicleType.toLowerCase() !== 'unknown' ? (inquiry as any).vehicleType : '');

        const makeModel = [make, model].filter(Boolean).join(' ').trim();
        let details = makeModel;
        if (type) {
            if (!details) {
                details = type;
            } else if (!details.toLowerCase().includes(type.toLowerCase())) {
                details = `${details} (${type})`;
            }
        }

        return { reg, details };
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

    return (
        <div 
            className="printable-page bg-white font-sans text-gray-800 p-8" 
            style={{ 
                width: '100%', 
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
            }}
        >
            <style dangerouslySetInnerHTML={{ __html: `
                @page { 
                    size: A4 ${orientation} !important; 
                    margin: 8mm !important; 
                }
                @media print {
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .printable-page {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: ${orientation === 'landscape' ? '194mm' : '277mm'} !important;
                        padding: 4mm 6mm !important;
                        box-sizing: border-box !important;
                        margin: 0 !important;
                    }
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                    }
                    th, td { 
                        padding: 6px 8px !important; 
                        font-size: 10px !important; 
                        border: 1px solid #d1d5db !important;
                    }
                }
            `}} />

            <header className="pb-4 border-b border-gray-300 flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span>{filterMode === 'scheduled' ? 'Scheduled Inquiries List' : 'Inquiries List'}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider print:hidden">
                            {orientation === 'landscape' ? 'Landscape' : 'Portrait'}
                        </span>
                    </h1>
                    <p className="text-sm font-semibold text-indigo-600">
                        {filterMode === 'scheduled' ? `${title} • Sorted by Scheduled Date` : title}
                    </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                    <p>Total Items: <span className="font-bold text-gray-800">{inquiries.length}</span></p>
                    <p>Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </header>

            <main>
                {inquiries.length === 0 ? (
                    <p className="text-center py-8 text-gray-500 italic">
                        {filterMode === 'scheduled' ? 'No scheduled inquiries found.' : 'No inquiries to print.'}
                    </p>
                ) : (
                    <table className="w-full text-left text-xs border-collapse" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 uppercase tracking-wider text-[10px] font-bold" style={{ backgroundColor: '#f3f4f6' }}>
                                <th 
                                    className="p-2 border border-gray-300 min-w-[90px] whitespace-nowrap cursor-pointer hover:bg-gray-200 transition select-none"
                                    onClick={() => onSortChange?.('inquiryNumber')}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Inquiry #</span>
                                        {sortBy === 'inquiryNumber' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th 
                                    className="p-2 border border-gray-300 min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-gray-200 transition select-none"
                                    onClick={() => onSortChange?.('createdAt')}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Date/Time</span>
                                        {sortBy === 'createdAt' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th 
                                    className="p-2 border border-gray-300 min-w-[160px] cursor-pointer hover:bg-gray-200 transition select-none"
                                    onClick={() => onSortChange?.('customer')}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Customer</span>
                                        <span className="text-[9px] font-normal text-gray-500 lowercase">(phone/addr)</span>
                                        {sortBy === 'customer' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th className="p-2 border border-gray-300 min-w-[130px] whitespace-nowrap">Vehicle (Reg / Model)</th>
                                {filterMode === 'scheduled' && (
                                    <>
                                        {/* Enlarged Job # Column to prevent truncation */}
                                        <th className="p-2 border border-gray-300 min-w-[150px] whitespace-nowrap bg-emerald-50/70 text-emerald-950 font-black">
                                            Job #
                                        </th>
                                        <th 
                                            className="p-2 border border-gray-300 min-w-[130px] whitespace-nowrap bg-indigo-50/70 text-indigo-950 font-black cursor-pointer hover:bg-indigo-100 transition select-none"
                                            onClick={() => onSortChange?.('scheduledDate')}
                                            title="Click to toggle scheduled date sort order"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Scheduled Date</span>
                                                {sortBy === 'scheduledDate' ? (sortOrder === 'asc' ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />) : <ArrowUpDown size={12} className="text-gray-400" />}
                                            </div>
                                        </th>
                                    </>
                                )}
                                <th className="p-2 border border-gray-300 min-w-[95px] whitespace-nowrap">Status</th>
                                <th className="p-2 border border-gray-300 min-w-[200px]">Comments / Message</th>
                                <th className="p-2 border border-gray-300 min-w-[110px] whitespace-nowrap">Assigned To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inquiries.map(inquiry => {
                                const customer = inquiry.linkedCustomerId ? customersById.get(inquiry.linkedCustomerId) : null;
                                const customerName = customer ? getCustomerDisplayName(customer) : inquiry.fromName;
                                const vehicleInfo = resolveVehicleInfo(inquiry);
                                const assignedTo = getAssignedName(inquiry);
                                const linkedJob = resolveLinkedJob(inquiry);
                                const effectiveDate = getEffectiveInquiryScheduledDate(inquiry, linkedJob);
                                const scheduledDateStr = effectiveDate 
                                    ? new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).toLocaleDateString('en-GB')
                                    : '-';
                                const fullJobNumber = linkedJob?.jobNumber || linkedJob?.id || '-';

                                const phone = customer?.mobile || customer?.phone || inquiry.fromPhone || (inquiry.fromContact && !inquiry.fromContact.includes('@') ? inquiry.fromContact : '') || (linkedJob as any)?.customerPhone || (linkedJob as any)?.customerMobile || '';
                                const addressParts = [
                                    customer?.addressLine1 || inquiry.addressLine1,
                                    customer?.addressLine2 || inquiry.addressLine2,
                                    customer?.city || inquiry.city,
                                    customer?.postcode || inquiry.postcode
                                ].filter(Boolean);
                                const address = addressParts.length > 0 ? addressParts.join(', ') : (customer?.address || '');

                                return (
                                    <tr key={inquiry.id} className="hover:bg-gray-50">
                                        <td className="p-2 border border-gray-300 font-mono font-bold whitespace-nowrap">
                                            {inquiry.inquiryNumber || inquiry.id}
                                        </td>
                                        <td className="p-2 border border-gray-300 font-mono text-[10px] whitespace-nowrap">
                                            {new Date(inquiry.createdAt).toLocaleDateString('en-GB')} {new Date(inquiry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-2 border border-gray-300 min-w-[150px]">
                                            <div className="font-bold text-gray-900">{customerName}</div>
                                            {phone ? (
                                                <div className="text-[10px] text-indigo-700 font-mono font-semibold flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                                    <span>📞 {phone}</span>
                                                </div>
                                            ) : null}
                                            {address ? (
                                                <div className="text-[10px] text-gray-600 leading-tight mt-0.5 max-w-[220px]">
                                                    {address}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="p-2 border border-gray-300 min-w-[120px]">
                                            <div className="font-mono font-bold text-blue-800 whitespace-nowrap">
                                                {vehicleInfo.reg || '-'}
                                            </div>
                                            {vehicleInfo.details ? (
                                                <div className="text-[10px] text-gray-700 font-medium whitespace-normal leading-tight mt-0.5">
                                                    {vehicleInfo.details}
                                                </div>
                                            ) : null}
                                        </td>
                                        {filterMode === 'scheduled' && (
                                             <>
                                                 {/* Whole Job Number displayed with expanded width */}
                                                 <td className="p-2 border border-gray-300 font-mono font-bold text-emerald-800 whitespace-nowrap min-w-[150px]">
                                                     {fullJobNumber}
                                                 </td>
                                                 <td className="p-2 border border-gray-300 font-bold text-gray-900 whitespace-nowrap min-w-[130px]">
                                                     {scheduledDateStr}
                                                 </td>
                                             </>
                                         )}
                                         <td className="p-2 border border-gray-300 font-semibold whitespace-nowrap">{inquiry.status}</td>
                                         <td className="p-2 border border-gray-300 max-w-[280px] break-words" title={inquiry.subject ? `${inquiry.subject}: ${inquiry.message}` : inquiry.message}>
                                             <div 
                                                 className="text-[10px] text-gray-700 leading-snug line-clamp-4 overflow-hidden"
                                                 style={{
                                                     display: '-webkit-box',
                                                     WebkitLineClamp: 4,
                                                     WebkitBoxOrient: 'vertical',
                                                     overflow: 'hidden',
                                                     maxHeight: '4.8em'
                                                 }}
                                             >
                                                 {inquiry.subject ? <span className="font-semibold text-gray-900">{inquiry.subject}: </span> : null}
                                                 <span>{inquiry.message}</span>
                                             </div>
                                         </td>
                                        <td className="p-2 border border-gray-300 whitespace-nowrap">{assignedTo}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </main>
        </div>
    );
};

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
    const print = usePrint();
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [filterMode, setFilterMode] = React.useState<'all' | 'scheduled'>(initialFilter);
    const [sortBy, setSortBy] = React.useState<'scheduledDate' | 'createdAt' | 'inquiryNumber' | 'customer'>(
        initialFilter === 'scheduled' ? 'scheduledDate' : 'createdAt'
    );
    const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
        initialFilter === 'scheduled' ? 'asc' : 'desc'
    );
    const [orientation, setOrientation] = React.useState<'landscape' | 'portrait'>('landscape');

    React.useEffect(() => {
        if (isOpen) {
            setFilterMode(initialFilter);
            if (initialFilter === 'scheduled') {
                setSortBy('scheduledDate');
                setSortOrder('asc');
            } else {
                setSortBy('createdAt');
                setSortOrder('desc');
            }
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

    const getScheduledTimestamp = React.useCallback((inquiry: Inquiry): number => {
        const job = resolveLinkedJob(inquiry);
        const effectiveDate = getEffectiveInquiryScheduledDate(inquiry, job);
        if (effectiveDate) {
            const t = new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).getTime();
            if (!isNaN(t)) return t;
        }
        return sortOrder === 'asc' ? 9999999999999 : 0;
    }, [resolveLinkedJob, sortOrder]);

    const sortedInquiries = React.useMemo(() => {
        const items = [...displayInquiries];
        items.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'scheduledDate') {
                const timeA = getScheduledTimestamp(a);
                const timeB = getScheduledTimestamp(b);
                comparison = timeA - timeB;
            } else if (sortBy === 'createdAt') {
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else if (sortBy === 'inquiryNumber') {
                const numA = (a.inquiryNumber || a.id).toLowerCase();
                const numB = (b.inquiryNumber || b.id).toLowerCase();
                comparison = numA.localeCompare(numB);
            } else if (sortBy === 'customer') {
                const customerA = a.linkedCustomerId ? customersById.get(a.linkedCustomerId) : null;
                const customerB = b.linkedCustomerId ? customersById.get(b.linkedCustomerId) : null;
                const nameA = (customerA ? getCustomerDisplayName(customerA) : a.fromName || '').toLowerCase();
                const nameB = (customerB ? getCustomerDisplayName(customerB) : b.fromName || '').toLowerCase();
                comparison = nameA.localeCompare(nameB);
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return items;
    }, [displayInquiries, sortBy, sortOrder, getScheduledTimestamp, customersById]);

    const handleSortChange = (field: 'scheduledDate' | 'createdAt' | 'inquiryNumber' | 'customer') => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder(field === 'scheduledDate' ? 'asc' : 'desc');
        }
    };

    const handleFilterModeChange = (mode: 'all' | 'scheduled') => {
        setFilterMode(mode);
        if (mode === 'scheduled') {
            setSortBy('scheduledDate');
            setSortOrder('asc');
        } else {
            setSortBy('createdAt');
            setSortOrder('desc');
        }
    };

    const handlePrint = () => {
        setIsPrinting(true);
        print(
            <PrintableInquirySheet
                inquiries={sortedInquiries}
                vehiclesById={vehiclesById}
                customersById={customersById}
                estimatesById={estimatesById}
                usersById={usersById}
                entitiesById={entitiesById}
                jobsById={jobsById}
                jobs={jobs}
                filterMode={filterMode}
                sortBy={sortBy}
                sortOrder={sortOrder}
                orientation={orientation}
                title={title}
            />
        );
        setTimeout(() => {
            setIsPrinting(false);
        }, 1800);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            {/* Modal Controls (Hidden during print) */}
            <div className="print:hidden fixed top-4 right-4 flex items-center gap-2 z-50 flex-wrap justify-end">
                {/* Mode Filter Pills */}
                <div className="bg-white/95 backdrop-blur-sm border border-gray-200 p-1 rounded-xl shadow-lg flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => handleFilterModeChange('all')}
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
                        onClick={() => handleFilterModeChange('scheduled')}
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

                {/* Sort Toggle */}
                {filterMode === 'scheduled' && (
                    <button
                        type="button"
                        onClick={() => handleSortChange('scheduledDate')}
                        className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                        title="Click to toggle scheduled date sort order (Earliest first / Latest first)"
                    >
                        <ArrowUpDown size={14} className="text-indigo-600" />
                        <span>
                            Sort: {sortBy === 'scheduledDate' ? (sortOrder === 'asc' ? 'Date (Earliest First)' : 'Date (Latest First)') : 'Scheduled Date'}
                        </span>
                    </button>
                )}

                {/* Landscape / Portrait Orientation Toggle */}
                <button
                    type="button"
                    onClick={() => setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
                    className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                    title="Toggle print layout orientation"
                >
                    <LayoutTemplate size={14} className="text-indigo-600" />
                    <span>{orientation === 'landscape' ? 'Landscape (Wide)' : 'Portrait'}</span>
                </button>

                {/* Print Action */}
                <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition cursor-pointer"
                >
                    {isPrinting ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                    <span>{isPrinting ? 'Preparing Print...' : `Print ${filterMode === 'scheduled' ? 'Scheduled' : 'List'} (${orientation === 'landscape' ? 'Landscape' : 'Portrait'})`}</span>
                </button>

                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-bold shadow-lg transition border cursor-pointer"
                >
                    Close
                </button>
            </div>

            {/* Preview Modal Content: max-w-7xl for wide landscape viewing */}
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto p-6 border border-gray-200 mt-12">
                <PrintableInquirySheet
                    inquiries={sortedInquiries}
                    vehiclesById={vehiclesById}
                    customersById={customersById}
                    estimatesById={estimatesById}
                    usersById={usersById}
                    entitiesById={entitiesById}
                    jobsById={jobsById}
                    jobs={jobs}
                    filterMode={filterMode}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={handleSortChange}
                    orientation={orientation}
                    title={title}
                />
            </div>
        </div>
    );
};

export default PrintableInquiryList;
