import React from 'react';
import { 
    Job, 
    Vehicle, 
    Customer, 
    Estimate, 
    BusinessEntity, 
    Engineer, 
    TaxRate, 
    EstimateLineItem 
} from '../types';

interface PrintableJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    estimates?: Estimate[];
    entity?: BusinessEntity;
    engineers: Engineer[];
    taxRates: TaxRate[];
}

const PrintableJobCard: React.FC<PrintableJobCardProps> = ({ 
    job, 
    vehicle, 
    customer, 
    estimates, 
    entity, 
    engineers, 
    taxRates 
}) => {
    
    // 1. DATA RESOLUTION
    // Handles embedded job data if the separate customer/vehicle objects aren't passed
    const jobData = job as any;
    const fName = customer?.forename || jobData.customerForename || "";
    const sName = customer?.surname || jobData.customerSurname || "";
    const customerFullName = `${fName} ${sName}`.trim();

    // Secondary Identifier if name is missing
    const displayName = customerFullName || (job.customerId ? `ACCOUNT: ${job.customerId}` : "DATA MISSING");

    // 2. TECHNICIAN RESOLUTION
    // Checks both 'segments' and 'tasks' to support different schema versions
    const segments = job.segments || jobData.tasks || [];
    const technicianIds = new Set(segments.map((s: any) => s.engineerId).filter(Boolean));
    
    const technicianNames = Array.from(technicianIds)
        .map(id => engineers.find(e => e.id === id)?.name)
        .filter(Boolean)
        .join(', ');

    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" 
             style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            
            {/* BRANDING HEADER */}
            <header className="flex justify-between items-start pb-4 border-b-2 border-gray-900 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">
                        {entity?.name || 'WORKSHOP JOB CARD'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-bold rounded uppercase">
                            Technician Copy
                        </span>
                        <h2 className="text-lg font-bold text-gray-700 uppercase tracking-tight">
                            Job Sheet #{job.id}
                        </h2>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Printed Date</p>
                    <p className="font-bold">{new Date().toLocaleDateString('en-GB')}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Key Number</p>
                    <p className="font-bold text-xl text-indigo-700">{job.keyNumber || 'N/A'}</p>
                </div>
            </header>

            <main className="flex-grow space-y-6">
                {/* CONTACT & VEHICLE INFO */}
                <section className="grid grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Customer Information</h3>
                        <p className="text-lg font-black text-gray-900 uppercase">
                            {displayName}
                        </p>
                        <div className="mt-2 text-xs space-y-1 text-gray-600">
                            <p>{customer?.addressLine1 || "Address not provided"}</p>
                            <p>{customer?.city} {customer?.postcode}</p>
                            <div className="pt-2 mt-2 border-t border-gray-200 flex flex-col font-bold text-gray-900">
                                <span>Tel: {customer?.mobile || customer?.phone || 'No Contact Number'}</span>
                                <span className="text-indigo-600 font-normal">{customer?.email || 'No Email Recorded'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Vehicle Details</h3>
                        <p className="text-lg font-black text-gray-900 uppercase">
                            {vehicle?.make} {vehicle?.model || 'Unknown Vehicle'}
                        </p>
                        <div className="mt-2">
                            <span className="bg-yellow-400 text-black px-4 py-1.5 rounded font-mono font-bold text-xl border-2 border-black shadow-sm inline-block">
                                {vehicle?.registration || 'NO REG'}
                            </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 text-[10px] font-mono text-gray-500 uppercase">
                            <span>VIN: {vehicle?.vin?.slice(-8) || 'N/A'}</span>
                            <span className="text-right">Colour: {vehicle?.colour || 'N/A'}</span>
                        </div>
                    </div>
                </section>

                {/* JOB DESCRIPTION */}
                <section className="border-2 border-gray-900 rounded-lg overflow-hidden">
                    <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest">Primary Work Description</h3>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Hours: {job.estimatedHours || 0}h</span>
                    </div>
                    <div className="p-4 bg-white">
                        <p className="text-lg font-bold text-gray-900 mb-2 underline decoration-indigo-500 underline-offset-4">
                            {job.description}
                        </p>
                        <div className="p-3 bg-gray-50 rounded text-gray-800 whitespace-pre-wrap min-h-[60px] border border-gray-100 italic">
                            {job.notes || "No booking notes provided."}
                        </div>
                    </div>
                </section>

                {/* PARTS & LABOUR CHECKLIST */}
                <section>
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Required Parts & Labour Items</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                                <tr>
                                    <th className="px-4 py-2 w-1/4">Ref / Part No.</th>
                                    <th className="px-4 py-2 w-1/2">Description</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-center w-16">Done</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {estimates && estimates.length > 0 ? (
                                    estimates.flatMap(est => (est.lineItems || []).map((item: EstimateLineItem) => (
                                        <tr key={item.id} className="text-sm">
                                            <td className="px-4 py-3 font-mono text-[10px] text-gray-400 uppercase">
                                                {item.partNumber || (item.isLabor ? 'LABOUR' : 'PART')}
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 font-semibold">
                                                {item.description}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">
                                                {item.quantity}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="w-5 h-5 border-2 border-gray-300 rounded mx-auto bg-white"></div>
                                            </td>
                                        </tr>
                                    )))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400 italic">
                                            No line items linked to this job card.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* TECHNICIAN OBSERVATIONS */}
                <section className="flex-grow flex flex-col">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Technician Findings / Required Repairs</h3>
                    <div className="flex-grow border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50/30">
                        <div className="space-y-8 pt-4">
                            <div className="border-b border-gray-200 pb-2 text-gray-300 text-[10px] uppercase">Notes / Observations:</div>
                            <div className="border-b border-gray-100"></div>
                            <div className="border-b border-gray-100"></div>
                            <div className="border-b border-gray-100"></div>
                            <div className="border-b border-gray-100"></div>
                            <div className="border-b border-gray-100"></div>
                        </div>
                    </div>
                </section>
            </main>

            {/* FOOTER SIGN-OFF */}
            <footer className="mt-8 pt-6 border-t-2 border-gray-900 text-[11px]">
                <div className="grid grid-cols-2 gap-16">
                    <div>
                        <p className="mb-8 uppercase font-bold text-gray-400 tracking-widest">Lead Technician</p>
                        <p className="mb-1 text-sm text-black font-black">
                            {technicianNames || '__________________________'}
                        </p>
                        <div className="border-t border-black pt-1">Sign-off Signature</div>
                    </div>
                    <div className="text-right">
                        <p className="mb-8 uppercase font-bold text-gray-400 tracking-widest">Quality Assurance / Date</p>
                        <p className="mb-1 text-black font-bold text-sm">
                            ___ / ___ / 202___
                        </p>
                        <div className="border-t border-black pt-1 w-48 ml-auto text-right">Manager Signature</div>
                    </div>
                </div>
                <div className="mt-6 text-center text-[9px] text-gray-400 uppercase tracking-widest">
                    Generated via Workshop Management System
                </div>
            </footer>
        </div>
    );
};

export default PrintableJobCard;