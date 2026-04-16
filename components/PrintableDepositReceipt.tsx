import React from 'react';
import { Customer, Vehicle, BusinessEntity, Job } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';

interface PrintableDepositReceiptProps {
    job: Job;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
}

const PrintableDepositReceipt: React.FC<PrintableDepositReceiptProps> = ({ job, customer, vehicle, entity }) => {
    return (
        <div className="p-12 max-w-[800px] mx-auto bg-white min-h-[1050px] font-sans text-gray-900 print:p-0">
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    {entity?.logoUrl ? (
                        <img src={entity.logoUrl} alt="Logo" className="h-16 mb-4 object-contain" />
                    ) : (
                        <h1 className="text-3xl font-black tracking-tighter text-gray-900 mb-2">{entity?.name || 'Brookspeed'}</h1>
                    )}
                    <div className="text-xs text-gray-500 font-medium space-y-0.5">
                        <p>{entity?.addressLine1}</p>
                        <p>{entity?.city}, {entity?.postcode}</p>
                        {entity?.email && <p>{entity.email}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-3xl font-black text-indigo-600 uppercase tracking-tight mb-2">Deposit Receipt</h2>
                    <div className="text-sm space-y-1">
                        <p><span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mr-2">Ref:</span> <span className="font-bold">{job.id}</span></p>
                        <p><span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mr-2">Date:</span> <span className="font-bold">{formatDate(new Date())}</span></p>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-12 mb-12">
                <div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 pb-1 border-b">Customer Info</h3>
                    <div className="text-sm">
                        <p className="font-bold text-gray-900">{customer?.companyName || `${customer?.forename} ${customer?.surname}`}</p>
                        <p className="text-gray-600 italic mt-1">{customer?.email || 'No email provided'}</p>
                    </div>
                </div>
                <div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 pb-1 border-b">Vehicle Details</h3>
                    <div className="text-sm">
                        <p className="font-bold text-gray-900 uppercase tracking-wide">{vehicle?.registration}</p>
                        <p className="text-gray-600">{vehicle?.make} {vehicle?.model}</p>
                    </div>
                </div>
            </div>

            {/* Receipt Table */}
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-12">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b">
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4 text-right">Amount Received</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        <tr>
                            <td className="px-6 py-6">
                                <p className="font-bold text-gray-900">Security Deposit for Job #{job.id}</p>
                                <p className="text-xs text-gray-500 mt-1">{job.description}</p>
                            </td>
                            <td className="px-6 py-6">
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-black uppercase tracking-tighter">
                                    {job.depositMethod || 'BACS'}
                                </span>
                            </td>
                            <td className="px-6 py-6 text-right font-black text-xl text-indigo-600">
                                {formatCurrency(job.depositAmount || 0)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Total Section */}
            <div className="flex justify-end mb-12">
                <div className="bg-gray-900 text-white p-8 rounded-2xl min-w-[320px] shadow-xl">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest text-indigo-400">Remaining Balance (Est)</span>
                        <span className="text-2xl font-black">{formatCurrency((job.estimatedHours || 0) * (entity?.laborRate || 0) - (job.depositAmount || 0))} *</span>
                    </div>
                    <p className="text-[9px] text-gray-400 italic leading-relaxed">
                        * The remaining balance is an estimate based on the quoted labour hours. 
                        Final invoicing will reflect actual parts and time used.
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-12 border-t border-gray-100 italic text-[10px] text-gray-400 leading-relaxed">
                <p>This deposit serves as a formal guarantee for the scheduling of the work described above. Deposits are generally non-refundable unless agreed otherwise in writing. Thank you for choosing {entity?.name || 'Brookspeed'}.</p>
                
                <div className="mt-8 flex justify-between items-center font-bold font-mono">
                    <div className="space-y-1">
                        <p className="text-gray-300">Bank Details for Reference:</p>
                        <p className="text-gray-500">{entity?.bankAccountName}</p>
                        <p className="text-gray-500">S/C: {entity?.bankSortCode} | A/C: {entity?.bankAccountNumber}</p>
                    </div>
                    <div className="text-center">
                        <div className="h-10 w-10 bg-gray-50 border border-gray-100 rounded mx-auto mb-1 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full animate-pulse" />
                        </div>
                        <p className="uppercase tracking-[0.3em] text-[8px]">Authenticated</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintableDepositReceipt;
