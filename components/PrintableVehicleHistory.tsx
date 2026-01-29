import React from 'react';
import { Vehicle, Customer, Job, Estimate, Invoice, User, BusinessEntity, Engineer } from '../types';
import { formatCurrency } from '../utils/formatUtils';

// Define props interface
interface PrintableVehicleHistoryProps {
    vehicle: Vehicle;
    owner: Customer | undefined;
    jobs: Job[];
    financials: ((Estimate & { type: 'Estimate' }) | (Invoice & { type: 'Invoice' }))[];
    ownership: { customer: Customer; firstSeen: Date }[];
    users: User[];
    businessEntities: BusinessEntity[];
    engineers: Engineer[];
}

// FIX: Re-typed component using React.FC to correctly handle React's special `key` prop and avoid type errors in loops.
const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-white font-sans text-sm text-gray-800 page-break-after-always" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
        {children}
    </div>
);

const Header: React.FC<{ title: string; entity: BusinessEntity | undefined }> = ({ title, entity }) => (
    <header className="pb-4 border-b mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{entity?.name || 'Brookspeed'}</h1>
        <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
    </header>
);

const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-6 page-break-inside-avoid">
        <h3 className="text-base font-bold text-gray-800 mb-2 border-b pb-1">{title}</h3>
        {children}
    </section>
);

const PrintableVehicleHistory: React.FC<PrintableVehicleHistoryProps> = ({
    vehicle,
    owner,
    jobs,
    financials,
    ownership,
    users,
    businessEntities,
    engineers,
}) => {
    const userMap = new Map(users.map(u => [u.id, u.name]));
    // FIX: Added a filter to guard against malformed BusinessEntity data (e.g., empty objects from corrupted localStorage) that could cause type errors.
    const entityMap = new Map(businessEntities.filter(e => e && e.id).map(e => [e.id, e]));
    const engineerMap = new Map(engineers.map(e => [e.id, e.name]));
    
    const firstEntity = entityMap.get(jobs[0]?.entityId) || entityMap.get(financials[0]?.entityId) || businessEntities.find(e => e && e.id);

    return (
        <>
            {/* Page 1: Summary & Details */}
            <Page>
                <Header title={`Vehicle History Report: ${vehicle.registration}`} entity={firstEntity} />
                
                <Section title="Vehicle & Current Owner Details">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                            <p><strong>Make:</strong> {vehicle.make}</p>
                            <p><strong>Model:</strong> {vehicle.model}</p>
                            <p><strong>Registration:</strong> {vehicle.registration}</p>
                            <p><strong>VIN:</strong> {vehicle.vin || 'N/A'}</p>
                        </div>
                        <div>
                            <p><strong>Owner:</strong> {owner?.forename} {owner?.surname}</p>
                            <p><strong>Contact:</strong> {owner?.mobile || owner?.phone}</p>
                            <p><strong>Address:</strong> {owner?.addressLine1}, {owner?.city}, {owner?.postcode}</p>
                        </div>
                    </div>
                </Section>

                <Section title="Ownership History">
                    <div className="space-y-2 text-xs">
                        {ownership.map(({ customer, firstSeen }) => (
                            <div key={customer.id} className="p-2 bg-gray-50 rounded">
                                <p><strong>{customer.forename} {customer.surname}</strong> (First seen on {firstSeen.toLocaleDateString()})</p>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="Financial Summary">
                    <div className="space-y-2 text-xs">
                        {financials.map(item => (
                            <div key={`${item.type}-${item.id}`} className="p-2 bg-gray-50 rounded">
                                <p><strong>{item.type} #{'estimateNumber' in item ? item.estimateNumber : item.id}</strong> on {item.issueDate} - Status: {item.status}</p>
                            </div>
                        ))}
                    </div>
                </Section>
            </Page>
            
            {/* Page 2 onwards: Job History */}
            {jobs.map((job, index) => {
                const jobEntity = entityMap.get(job.entityId);
                const technicianIds = new Set(job.segments.map(s => s.engineerId).filter(Boolean));
                const technicianNames = Array.from(technicianIds).map(id => engineerMap.get(id!)).filter(Boolean).join(', ');

                return (
                    <Page key={job.id}>
                        <Header title={`Job Card Detail: ${job.id}`} entity={jobEntity} />
                        <Section title={job.description}>
                            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                                <div>
                                    <p><strong>Date Created:</strong> {job.createdAt}</p>
                                    <p><strong>Status:</strong> {job.status}</p>
                                </div>
                                <div>
                                    <p><strong>Mileage In:</strong> {typeof job.mileage === 'number' ? `${job.mileage.toLocaleString()} miles` : 'N/A'}</p>
                                    <p><strong>Key Number:</strong> {job.keyNumber || 'N/A'}</p>
                                </div>
                                <div>
                                    <p><strong>Technician:</strong> {technicianNames || 'N/A'}</p>
                                </div>
                            </div>
                            
                            <div className="page-break-inside-avoid">
                                <h4 className="text-sm font-semibold mb-1">Technician Observations</h4>
                                <div className="p-2 bg-gray-50 rounded text-xs">
                                    {(job.technicianObservations && job.technicianObservations.length > 0) ? (
                                        <ul className="list-disc list-inside">
                                            {job.technicianObservations.map((obs, i) => <li key={i}>{obs}</li>)}
                                        </ul>
                                    ) : <p>No observations recorded.</p>}
                                </div>
                            </div>

                             <div className="page-break-inside-avoid mt-4">
                                <h4 className="text-sm font-semibold mb-1">Tyre Depths (mm)</h4>
                                 <div className="p-2 bg-gray-50 rounded text-xs grid grid-cols-2 gap-x-4">
                                     <p><strong>Offside Front (OSF):</strong> {job.tyreDepths?.osf || 'N/A'}</p>
                                     <p><strong>Nearside Front (NSF):</strong> {job.tyreDepths?.nsf || 'N/A'}</p>
                                     <p><strong>Offside Rear (OSR):</strong> {job.tyreDepths?.osr || 'N/A'}</p>
                                     <p><strong>Nearside Rear (NSR):</strong> {job.tyreDepths?.nsr || 'N/A'}</p>
                                 </div>
                            </div>
                        </Section>
                    </Page>
                );
            })}
        </>
    );
};

export default PrintableVehicleHistory;
