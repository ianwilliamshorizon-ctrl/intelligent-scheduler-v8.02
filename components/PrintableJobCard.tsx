import React from 'react';
import { Job, Vehicle, Customer, Estimate, BusinessEntity, Engineer, TaxRate } from '../types';
import { formatCurrency } from '../utils/formatUtils';

interface PrintableJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    estimates?: Estimate[];
    entity?: BusinessEntity;
    engineers: Engineer[];
    taxRates: TaxRate[];
}

const PrintableJobCard: React.FC<PrintableJobCardProps> = ({ job, vehicle, customer, estimates, entity, engineers, taxRates }) => {
    const technicianIds = new Set(job.segments.map(s => s.engineerId).filter(Boolean));
    const technicianNames = Array.from(technicianIds).map(id => engineers.find(e => e.id === id)?.name).filter(Boolean).join(', ');

    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <header className="flex justify-between items-start pb-4 border-b mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{entity?.name}</h1>
                    <h2 className="text-xl font-semibold text-gray-700">Technician Job Sheet #{job.id}</h2>
                </div>
                <div className="text-right">
                    <p>Date: {job.createdAt}</p>
                    <p className="font-bold mt-2">Parts Status: {job.partsStatus || 'Not Required'}</p>
                </div>
            </header>
            <main className="flex-grow space-y-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Customer</h3>
                        <p className="font-bold text-gray-800">{customer?.forename} {customer?.surname}</p>
                        <p className="text-xs">Tel: {customer?.phone || 'N/A'}</p>
                        <p className="text-xs">Mobile: {customer?.mobile || 'N/A'}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model} (<span className="font-mono">{vehicle?.registration}</span>)</p>
                    </div>
                </section>

                <section>
                    <h3 className="font-semibold text-gray-800 p-2 bg-gray-100 border-b">Work Required: {job.description}</h3>
                    <p className="p-2 text-gray-700 whitespace-pre-wrap">{job.notes || "No additional booking notes provided."}</p>
                </section>
                
                {estimates && estimates.length > 0 ? (
                     <section>
                        <h3 className="font-semibold text-gray-800 p-2 bg-gray-100 border-b">Parts & Labour</h3>
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-1.5 py-1 border-b">
                            <div className="col-span-2">Part No.</div>
                            <div className="col-span-8">Description</div>
                            <div className="col-span-1 text-right">Qty</div>
                            <div className="col-span-1 text-center">Chk</div>
                        </div>
                        {estimates.map(est => (
                            <React.Fragment key={est.id}>
                                {estimates.length > 1 && (
                                    <div className="col-span-12 bg-gray-50 p-1 text-xs font-bold text-gray-700 border-b mt-2">
                                        Source: Estimate #{est.estimateNumber}
                                    </div>
                                )}
                                {(est.lineItems || []).map(item => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-1.5 border-b text-sm">
                                        <div className="col-span-2 font-mono text-xs">{item.partNumber || (item.isLabor ? 'LABOR' : 'N/A')}</div>
                                        <div className="col-span-8">{item.description}</div>
                                        <div className="col-span-1 text-right">{item.quantity}</div>
                                        <div className="col-span-1 border-l border-gray-300"></div>
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </section>
                ) : (
                    <section className="p-4 text-center text-gray-500 italic">
                        No estimate items linked to this job.
                    </section>
                )}

                <section>
                    <h3 className="font-semibold text-gray-800 p-2 bg-gray-100 border-b">Vehicle Condition Report</h3>
                    <div className="p-2 grid grid-cols-2 gap-4">
                        <div>
                            <p className="font-semibold">Mileage In</p>
                            <p className="text-lg">{typeof job.mileage === 'number' ? `${job.mileage.toLocaleString()} miles` : 'N/A'}</p>
                        </div>
                        <div>
                             <p className="font-semibold">Tyre Report (mm)</p>
                             <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                                <span>Offside Front:</span> <span className="font-mono">{job.tyreDepths?.osf?.toFixed(1) || 'N/A'}</span>
                                <span>Nearside Front:</span> <span className="font-mono">{job.tyreDepths?.nsf?.toFixed(1) || 'N/A'}</span>
                                <span>Offside Rear:</span> <span className="font-mono">{job.tyreDepths?.osr?.toFixed(1) || 'N/A'}</span>
                                <span>Nearside Rear:</span> <span className="font-mono">{job.tyreDepths?.nsr?.toFixed(1) || 'N/A'}</span>
                             </div>
                        </div>
                    </div>
                </section>
                
                 <section className="flex-grow">
                     <h3 className="font-semibold text-gray-800 p-2 bg-gray-100 border-b">Technician Observations & Notes</h3>
                     <div className="p-2 min-h-[150px] border border-gray-200 rounded mt-2">
                        {(job.technicianObservations && job.technicianObservations.length > 0) ? (
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                {job.technicianObservations.map((obs, index) => <li key={index}>{obs}</li>)}
                            </ul>
                        ) : null}
                     </div>
                </section>
            </main>
            <footer className="mt-auto pt-4 border-t text-xs text-gray-500">
                <div className="grid grid-cols-2 gap-8 mt-8">
                    <div><p className="mb-8">Technician: {technicianNames || '_____________________'}</p><div className="border-t pt-1">Technician Signature</div></div>
                    <div><p className="mb-8">Date: _______________</p><div className="border-t pt-1">QC Signature</div></div>
                </div>
            </footer>
        </div>
    );
};
export default PrintableJobCard;