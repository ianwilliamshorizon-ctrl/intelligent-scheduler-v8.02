import { Customer, Vehicle, BusinessEntity, Job, Estimate, EstimateLineItem } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';

interface PrintableDepositReceiptProps {
    job: Job;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
    estimate?: Estimate | null;
    estimates?: Estimate[] | null;
}

const PrintableDepositReceipt: React.FC<PrintableDepositReceiptProps> = ({ job, customer, vehicle, entity, estimate, estimates }) => {
    let lineItemsToUse: EstimateLineItem[] = [];
    if (estimates && estimates.length > 0) {
        lineItemsToUse = estimates.flatMap(e => e.lineItems || []);
    } else if (estimate?.lineItems?.length) {
        lineItemsToUse = estimate.lineItems;
    } else if (job?.lineItems?.length) {
        lineItemsToUse = job.lineItems;
    }
    const hasEstimate = lineItemsToUse.length > 0;
    const estimateTotal = lineItemsToUse.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0);
    const remainingBalance = estimateTotal - (job.depositAmount || 0);

    return (
        <div className="p-12 max-w-[800px] mx-auto bg-white min-h-[1050px] font-sans text-gray-900 print:p-0 rebuild-print-container">
            {/* DEBUG BLOCK - We will remove this once we see the issue */}
            <div className="bg-red-100 p-4 mb-4 text-xs font-mono text-red-900 border border-red-500 rounded">
                <p><strong>DEBUG INFO:</strong></p>
                <p>lineItemsToUse Length: {lineItemsToUse.length}</p>
                <p>estimates Array Length: {estimates?.length || 0}</p>
                <p>estimate Passed?: {estimate ? 'YES' : 'NO'}</p>
                <p>estimate line items: {estimate?.lineItems?.length || 0}</p>
                <p>job.lineItems: {job?.lineItems?.length || 0}</p>
            </div>
            
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

            {/* Estimate Detail Table */}
            {hasEstimate && (
                <div className="mb-12">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 pb-1 border-b">Estimate Summary</h3>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b">
                                    <th className="px-6 py-3">Service Item</th>
                                    <th className="px-6 py-3 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {lineItemsToUse.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-6 py-3 text-gray-700 font-medium">{item.description}</td>
                                        <td className="px-6 py-3 text-right text-gray-900">{formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50/50">
                                    <td className="px-6 py-3 font-bold text-gray-900">Estimate Total (Inc. VAT)</td>
                                    <td className="px-6 py-3 text-right font-black text-gray-900">{formatCurrency(estimateTotal)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Deposit Transaction Table */}
            <div className="mb-12">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 pb-1 border-b">Deposit Transaction</h3>
                <div className="border border-indigo-100 rounded-xl overflow-hidden bg-indigo-50/20">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-indigo-600/5 text-[10px] font-black uppercase tracking-widest text-indigo-400 border-b border-indigo-100">
                                <th className="px-6 py-4">Transaction Details</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4 text-right">Deposit Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="px-6 py-6">
                                    <p className="font-bold text-gray-900 text-lg">Deposit Applied to Job #{job.id}</p>
                                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">{job.description}</p>
                                </td>
                                <td className="px-6 py-6">
                                    <span className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-black uppercase tracking-tighter shadow-sm">
                                        {job.depositMethod || 'BACS'}
                                    </span>
                                </td>
                                <td className="px-6 py-6 text-right font-black text-2xl text-indigo-600">
                                    {formatCurrency(job.depositAmount || 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary Section */}
            <div className="flex justify-between items-start gap-12 mb-12">
                <div className="flex-grow max-w-sm italic text-[10px] text-gray-400 leading-relaxed">
                    <p>Total estimated costs were calculated at the time of scheduling. 
                    This deposit has been deducted from your total. The remaining balance shown 
                    is due upon completion of the work unless alternative arrangements are in place.</p>
                </div>
                <div className="bg-gray-900 text-white p-8 rounded-2xl min-w-[340px] shadow-xl">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs opacity-60">
                            <span>Estimated Total</span>
                            <span>{formatCurrency(estimateTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-indigo-400">
                            <span>Deposit Paid Today</span>
                            <span>- {formatCurrency(job.depositAmount || 0)}</span>
                        </div>
                        <div className="h-px bg-gray-700" />
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Balance Remaining</span>
                            <span className="text-3xl font-black text-white">{formatCurrency(remainingBalance)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-12 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
                <p className="italic">This deposit serves as a formal guarantee for the scheduling of the work described above. Deposits are generally non-refundable unless agreed otherwise in writing. Thank you for choosing {entity?.name || 'Brookspeed'}.</p>
                
                <div className="mt-8 flex justify-between items-center font-bold font-mono">
                    <div className="space-y-1">
                        <p className="text-gray-300">Bank Details for Reference:</p>
                        <p className="text-gray-500">{entity?.bankAccountName}</p>
                        <p className="text-gray-500">S/C: {entity?.bankSortCode} | A/C: {entity?.bankAccountNumber}</p>
                    </div>
                    <div className="text-center">
                        <div className="h-10 w-10 bg-gray-50 border border-gray-100 rounded mx-auto mb-1 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                        </div>
                        <p className="uppercase tracking-[0.3em] text-[8px]">Authenticated</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintableDepositReceipt;
