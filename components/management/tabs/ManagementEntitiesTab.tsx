
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { BusinessEntity, Job, Invoice } from '../../../types';
import { PlusCircle, Upload } from 'lucide-react';
import EntityFormModal from '../../EntityFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { generateJobId, generateInvoiceId } from '../../../core/utils/numberGenerators';
import { splitJobIntoSegments, formatDate } from '../../../core/utils/dateUtils';
import { saveDocument } from '../../../core/db';

export const ManagementEntitiesTab = ({ onShowStatus }: { onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { businessEntities, jobs, vehicles, customers, invoices, taxRates } = useData();
    const { updateItem } = useManagementTable(businessEntities, 'brooks_businessEntities');

    const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [importTargetEntityId, setImportTargetEntityId] = useState<string | null>(null);

    const handleImportJobs = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const entityId = importTargetEntityId;
        if (!file || !entityId) return;
        try {
            const data = await parseCsv(file);
            const entity = businessEntities.find(e => e.id === entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            
            // Generate jobs and filter duplicates based on existing 'jobs' state
            const newJobs: Job[] = data.map((row: any) => {
                const reg = (row.registration || '').toUpperCase().replace(/\s/g, '');
                const vehicle = vehicles.find(v => v.registration === reg);
                const customer = customers.find(c => (vehicle && c.id === vehicle.customerId) || (row.customerName && `${c.forename} ${c.surname}`.toLowerCase().includes(String(row.customerName).toLowerCase())));
                const newJobId = row.id || generateJobId(jobs, entityShortCode);
                const job: Job = {
                    id: newJobId, entityId: entityId, vehicleId: vehicle?.id || 'unknown_vehicle', customerId: customer?.id || 'unknown_customer', description: row.description || 'Imported Job',
                    estimatedHours: Number(row.estimatedHours) || 1, scheduledDate: row.scheduledDate || null, status: row.status || 'Unallocated', createdAt: row.createdAt || new Date().toISOString(), segments: [],
                    mileage: row.mileage ? Number(row.mileage) : undefined, keyNumber: row.keyNumber ? Number(row.keyNumber) : undefined
                };
                job.segments = splitJobIntoSegments(job);
                return job;
            });
            
            const uniqueNew = newJobs.filter(j => !jobs.some(ex => ex.id === j.id));
            
            // Persist
            for (const job of uniqueNew) {
                await saveDocument('brooks_jobs', job);
            }
            
            onShowStatus(`Imported ${uniqueNew.length} new jobs successfully.`, 'success');
        } catch (err) { console.error(err); onShowStatus('Error importing jobs.', 'error'); }
        e.target.value = ''; setImportTargetEntityId(null);
    };

    const handleImportInvoices = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const entityId = importTargetEntityId;
        if (!file || !entityId) return;
        try {
            const data = await parseCsv(file);
            const entity = businessEntities.find(e => e.id === entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            
            const newInvoices: Invoice[] = data.map((row: any) => {
                const reg = (row.registration || '').toUpperCase().replace(/\s/g, '');
                const vehicle = vehicles.find(v => v.registration === reg);
                const customer = customers.find(c => (vehicle && c.id === vehicle.customerId) || (row.customerName && `${c.forename} ${c.surname}`.toLowerCase().includes(String(row.customerName).toLowerCase())));
                const newInvoiceId = row.id || generateInvoiceId(invoices, entityShortCode);
                const total = Number(row.total) || 0; const net = total / 1.2;
                const invoice: Invoice = {
                    id: newInvoiceId, entityId: entityId, customerId: customer?.id || 'unknown_customer', vehicleId: vehicle?.id,
                    issueDate: row.issueDate || formatDate(new Date()), dueDate: row.dueDate || formatDate(new Date()), status: row.status || 'Draft',
                    lineItems: [{ id: crypto.randomUUID(), description: 'Imported Balance', quantity: 1, unitPrice: net, isLabor: false, taxCodeId: taxRates.find(t=>t.code==='T1')?.id }]
                };
                return invoice;
            });
            
            const uniqueNew = newInvoices.filter(i => !invoices.some(ex => ex.id === i.id));
            
            // Persist
            for (const inv of uniqueNew) {
                await saveDocument('brooks_invoices', inv);
            }
            
            onShowStatus(`Imported ${uniqueNew.length} new invoices successfully.`, 'success');
        } catch (err) { console.error(err); onShowStatus('Error importing invoices.', 'error'); }
        e.target.value = ''; setImportTargetEntityId(null);
    };

    return (
        <div>
            <div className="flex justify-end mb-4">
                 <button onClick={() => { setSelectedEntity(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Business Entity
                </button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh]">
                {businessEntities.map(e => (
                    <div key={e.id} className={`p-4 border-2 rounded-lg transition-all border-${e.color}-200 bg-white relative group`}>
                        <div className={`w-full h-2 bg-${e.color}-500 rounded-t mb-2`}></div>
                        <div className="flex justify-between items-start cursor-pointer" onClick={() => { setSelectedEntity(e); setIsModalOpen(true); }}>
                            <div>
                                <h3 className="font-bold text-lg">{e.name}</h3>
                                <p className="text-sm text-gray-500">{e.type}</p>
                                <p className="text-xs text-gray-400 mt-2">{e.city}</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t flex gap-2 justify-end">
                            <label className="text-xs flex items-center gap-1 cursor-pointer bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200" title="Import Jobs CSV">
                                <Upload size={12} /> Import Jobs
                                <input type="file" accept=".csv" className="hidden" onClick={() => setImportTargetEntityId(e.id)} onChange={handleImportJobs} />
                            </label>
                            <label className="text-xs flex items-center gap-1 cursor-pointer bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200" title="Import Invoices CSV">
                                <Upload size={12} /> Import Invoices
                                <input type="file" accept=".csv" className="hidden" onClick={() => setImportTargetEntityId(e.id)} onChange={handleImportInvoices} />
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            
            {isModalOpen && (
                <EntityFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(e) => { updateItem(e); setIsModalOpen(false); }} 
                    entity={selectedEntity} 
                    isDebugMode={false} 
                />
            )}
        </div>
    );
};
