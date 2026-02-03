import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { BusinessEntity, Job, Invoice } from '../../../types';
import { PlusCircle, Upload, Building2, MapPin, Briefcase, FileText } from 'lucide-react';
import EntityFormModal from '../../EntityFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { generateJobId, generateInvoiceId } from '../../../core/utils/numberGenerators';
import { splitJobIntoSegments, formatDate } from '../../../core/utils/dateUtils';
import { saveDocument } from '../../../core/db';

export const ManagementEntitiesTab = ({ onShowStatus }: { onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // 1. Data Context with Fallbacks
    const { 
        businessEntities = [], 
        jobs = [], 
        vehicles = [], 
        customers = [], 
        invoices = [], 
        taxRates = [],
        refreshActiveData 
    } = useData();

    // 2. Local State for UI Stability
    const [localEntities, setLocalEntities] = useState<BusinessEntity[]>(Array.isArray(businessEntities) ? businessEntities : []);
    
    useEffect(() => {
        setLocalEntities(Array.isArray(businessEntities) ? businessEntities : []);
    }, [businessEntities]);

    const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [importTargetEntityId, setImportTargetEntityId] = useState<string | null>(null);

    // 3. Bulletproof Save Logic for Entities
    const handleSave = async (entity: BusinessEntity) => {
        try {
            await saveDocument('brooks_businessEntities', entity);
            
            // Optimistic UI update
            setLocalEntities(prev => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(e => e.id === entity.id);
                return exists ? current.map(e => e.id === entity.id ? entity : e) : [...current, entity];
            });

            setIsModalOpen(false);
            setSelectedEntity(null);

            // Cloud settle buffer
            if (refreshActiveData) {
                setTimeout(async () => {
                    await refreshActiveData(true);
                }, 800);
            }
            onShowStatus('Business entity updated.', 'success');
        } catch (error) {
            onShowStatus('Failed to save entity changes.', 'error');
        }
    };

    const handleImportJobs = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const entityId = importTargetEntityId;
        if (!file || !entityId) return;
        onShowStatus('Processing jobs import...', 'info');
        try {
            const data = await parseCsv(file);
            const entity = localEntities.find(e => e.id === entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            
            const newJobs: Job[] = data.map((row: any) => {
                const reg = (row.registration || '').toUpperCase().replace(/\s/g, '');
                const vehicle = (vehicles || []).find(v => v.registration === reg);
                const customer = (customers || []).find(c => 
                    (vehicle && c.id === vehicle.customerId) || 
                    (row.customerName && `${c.forename} ${c.surname}`.toLowerCase().includes(String(row.customerName).toLowerCase()))
                );
                const newJobId = row.id || generateJobId(jobs, entityShortCode);
                const job: Job = {
                    id: newJobId, entityId: entityId, vehicleId: vehicle?.id || 'unknown_vehicle', customerId: customer?.id || 'unknown_customer', description: row.description || 'Imported Job',
                    estimatedHours: Number(row.estimatedHours) || 1, scheduledDate: row.scheduledDate || null, status: row.status || 'Unallocated', createdAt: row.createdAt || new Date().toISOString(), segments: [],
                    mileage: row.mileage ? Number(row.mileage) : undefined, keyNumber: row.keyNumber ? Number(row.keyNumber) : undefined
                };
                job.segments = splitJobIntoSegments(job);
                return job;
            });
            
            const uniqueNew = newJobs.filter(j => !(jobs || []).some(ex => ex.id === j.id));
            
            for (const job of uniqueNew) {
                await saveDocument('brooks_jobs', job);
            }
            
            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus(`Imported ${uniqueNew.length} new jobs successfully.`, 'success');
        } catch (err) { 
            console.error(err); 
            onShowStatus('Error importing jobs.', 'error'); 
        }
        e.target.value = ''; 
        setImportTargetEntityId(null);
    };

    const handleImportInvoices = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const entityId = importTargetEntityId;
        if (!file || !entityId) return;
        onShowStatus('Processing invoices import...', 'info');
        try {
            const data = await parseCsv(file);
            const entity = localEntities.find(e => e.id === entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            
            const newInvoices: Invoice[] = data.map((row: any) => {
                const reg = (row.registration || '').toUpperCase().replace(/\s/g, '');
                const vehicle = (vehicles || []).find(v => v.registration === reg);
                const customer = (customers || []).find(c => (vehicle && c.id === vehicle.customerId) || (row.customerName && `${c.forename} ${c.surname}`.toLowerCase().includes(String(row.customerName).toLowerCase())));
                const newInvoiceId = row.id || generateInvoiceId(invoices, entityShortCode);
                const total = Number(row.total) || 0; 
                const net = total / 1.2;
                const invoice: Invoice = {
                    id: newInvoiceId, entityId: entityId, customerId: customer?.id || 'unknown_customer', vehicleId: vehicle?.id,
                    issueDate: row.issueDate || formatDate(new Date()), dueDate: row.dueDate || formatDate(new Date()), status: row.status || 'Draft',
                    lineItems: [{ id: crypto.randomUUID(), description: 'Imported Balance', quantity: 1, unitPrice: net, isLabor: false, taxCodeId: (taxRates || []).find(t=>t.code==='T1')?.id }]
                };
                return invoice;
            });
            
            const uniqueNew = newInvoices.filter(i => !(invoices || []).some(ex => ex.id === i.id));
            
            for (const inv of uniqueNew) {
                await saveDocument('brooks_invoices', inv);
            }
            
            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus(`Imported ${uniqueNew.length} new invoices successfully.`, 'success');
        } catch (err) { 
            console.error(err); 
            onShowStatus('Error importing invoices.', 'error'); 
        }
        e.target.value = ''; 
        setImportTargetEntityId(null);
    };

    return (
        <div className="p-1 space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Business Entities</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage legal entities and data imports</p>
                </div>
                <button 
                    onClick={() => { setSelectedEntity(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                >
                    <PlusCircle size={18}/> Add Business Entity
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localEntities.map(e => (
                    <div key={e.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
                        <div className={`h-1.5 w-full bg-${e.color || 'slate'}-500 opacity-80`}></div>
                        
                        <div className="p-5 flex-grow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 bg-${e.color || 'slate'}-50 text-${e.color || 'slate'}-600 rounded-lg`}>
                                        <Building2 size={20} />
                                    </div>
                                    <div onClick={() => { setSelectedEntity(e); setIsModalOpen(true); }} className="cursor-pointer">
                                        <h3 className="font-black text-gray-900 uppercase text-sm tracking-tight hover:text-indigo-600 transition-colors">{e.name}</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{e.type}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-6">
                                <MapPin size={14} className="text-gray-300" />
                                {e.city || 'No city set'}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex flex-col items-center justify-center p-3 border border-gray-100 bg-gray-50 rounded-xl cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group">
                                    <Briefcase size={16} className="text-gray-400 group-hover:text-blue-600 mb-1" />
                                    <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-blue-700">Jobs</span>
                                    <input type="file" accept=".csv" className="hidden" onClick={() => setImportTargetEntityId(e.id)} onChange={handleImportJobs} />
                                </label>

                                <label className="flex flex-col items-center justify-center p-3 border border-gray-100 bg-gray-50 rounded-xl cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all group">
                                    <FileText size={16} className="text-gray-400 group-hover:text-green-600 mb-1" />
                                    <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-green-700">Invoices</span>
                                    <input type="file" accept=".csv" className="hidden" onClick={() => setImportTargetEntityId(e.id)} onChange={handleImportInvoices} />
                                </label>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setSelectedEntity(e); setIsModalOpen(true); }}
                            className="w-full py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors border-t border-gray-100"
                        >
                            Edit Entity Details
                        </button>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <EntityFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    entity={selectedEntity} 
                    isDebugMode={false} 
                />
            )}
        </div>
    );
};