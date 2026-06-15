import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { useApp } from '../../../core/state/AppContext';
import { BusinessEntity, Job, Invoice } from '../../../types';
import { PlusCircle, Upload, Building2, MapPin, Briefcase, FileText, Mail, RefreshCw, Trash2, Archive } from 'lucide-react';
import EntityFormModal from '../../EntityFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { generateJobId, generateInvoiceId } from '../../../core/utils/numberGenerators';
import { splitJobIntoSegments, formatDate } from '../../../core/utils/dateUtils';
import { saveDocument, deleteDocument } from '../../../core/db';

const isInvalidDate = (dateVal: any): boolean => {
    if (dateVal === null || dateVal === undefined || String(dateVal).trim() === '') {
        return false;
    }
    const dateStr = String(dateVal).trim().toLowerCase();
    if (dateStr.includes('invalid') || dateStr.includes('nan')) {
        return true;
    }
    const parsed = Date.parse(dateStr);
    return isNaN(parsed);
};

const isDuplicateJob = (j1: Job, j2: Job): boolean => {
    if (j1.id === j2.id) return true;
    const sameEntity = j1.entityId === j2.entityId;
    const sameVehicle = j1.vehicleId === j2.vehicleId && j1.vehicleId !== 'unknown_vehicle';
    const sameCustomer = j1.customerId === j2.customerId && j1.customerId !== 'unknown_customer';
    const hasMatchableOwner = sameVehicle || sameCustomer;
    const sameDate = j1.scheduledDate === j2.scheduledDate;
    const sameDesc = (j1.description || '').trim().toLowerCase() === (j2.description || '').trim().toLowerCase();
    
    if (sameEntity && hasMatchableOwner && sameDate && sameDesc) {
        return true;
    }
    
    if (sameEntity && hasMatchableOwner && !j1.scheduledDate && !j2.scheduledDate && sameDesc) {
        const d1 = j1.createdAt ? j1.createdAt.split('T')[0] : '';
        const d2 = j2.createdAt ? j2.createdAt.split('T')[0] : '';
        if (d1 && d1 === d2) return true;
    }
    
    return false;
};

const isDuplicateInvoice = (i1: Invoice, i2: Invoice): boolean => {
    if (i1.id === i2.id) return true;
    const sameEntity = i1.entityId === i2.entityId;
    const sameVehicle = i1.vehicleId === i2.vehicleId && i1.vehicleId !== 'unknown_vehicle';
    const sameCustomer = i1.customerId === i2.customerId && i1.customerId !== 'unknown_customer';
    const hasMatchableOwner = sameVehicle || sameCustomer;
    const sameDate = i1.issueDate === i2.issueDate;
    const sameTotal = Math.abs((i1.grandTotal || 0) - (i2.grandTotal || 0)) < 0.01;
    
    return sameEntity && hasMatchableOwner && sameDate && sameTotal;
};

interface ManagementEntitiesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementEntitiesTab: React.FC<ManagementEntitiesTabProps> = ({ onShowStatus }) => {
    // 1. Data Context with Fallbacks
    const { 
        businessEntities = [], 
        jobs = [], 
        vehicles = [], 
        customers = [], 
        invoices = [], 
        taxRates = [],
        saveRecord,
        setJobs,
        setInvoices,
    } = useData();
    const { refreshData } = useApp();

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
            await saveRecord('businessEntities', entity);
            setIsModalOpen(false);
            setSelectedEntity(null);
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
            
            const importedJobs: Job[] = [];
            let duplicateCount = 0;
            let invalidCount = 0;
            
            for (const row of data) {
                const reg = (row.registration || '').toUpperCase().replace(/\s/g, '');
                const vehicle = (vehicles || []).find(v => v.registration === reg);
                const customer = (customers || []).find(c => 
                    (vehicle && c.id === vehicle.customerId) || 
                    (row.customerName && `${c.forename} ${c.surname}`.toLowerCase().includes(String(row.customerName).toLowerCase()))
                );
                
                const tempJobId = row.id || generateJobId([...(jobs || []), ...importedJobs], entityShortCode);
                const scheduledDate = row.scheduledDate || null;
                const customerId = customer?.id || 'unknown_customer';
                
                if (customerId === 'unknown_customer' || isInvalidDate(scheduledDate)) {
                    invalidCount++;
                    continue;
                }
                
                const job: Job = {
                    id: tempJobId,
                    entityId: entityId,
                    vehicleId: vehicle?.id || 'unknown_vehicle',
                    customerId: customerId,
                    description: row.description || 'Imported Job',
                    estimatedHours: Number(row.estimatedHours) || 1,
                    scheduledDate: scheduledDate,
                    status: row.status || 'Archived',
                    createdAt: row.createdAt || new Date().toISOString(),
                    segments: [],
                    mileage: row.mileage ? Number(row.mileage) : undefined,
                    keyNumber: row.keyNumber ? Number(row.keyNumber) : undefined
                };
                job.segments = splitJobIntoSegments(job);
                
                const isDuplicateInBatch = importedJobs.some(imported => isDuplicateJob(imported, job));
                const isDuplicateInDb = (jobs || []).some(existing => isDuplicateJob(existing, job));
                
                if (isDuplicateInBatch || isDuplicateInDb) {
                    duplicateCount++;
                } else {
                    importedJobs.push(job);
                }
            }
            
            for (const job of importedJobs) {
                await saveDocument('brooks_jobs', job);
            }
            
            if (importedJobs.length > 0) {
                setJobs(prevJobs => [...prevJobs, ...importedJobs]);
            }
            
            let feedbackMsg = `Imported ${importedJobs.length} new jobs successfully.`;
            const extraDetails = [];
            if (duplicateCount > 0) {
                extraDetails.push(`${duplicateCount} duplicate(s) skipped`);
            }
            if (invalidCount > 0) {
                extraDetails.push(`${invalidCount} invalid job(s) skipped (no customer or invalid date)`);
            }
            if (extraDetails.length > 0) {
                feedbackMsg += ` (${extraDetails.join(', ')})`;
            }

            if (importedJobs.length > 0) {
                onShowStatus(feedbackMsg, 'success');
            } else {
                onShowStatus(`No new jobs imported. ${duplicateCount > 0 ? `${duplicateCount} duplicate(s) skipped. ` : ''}${invalidCount > 0 ? `${invalidCount} invalid job(s) skipped.` : ''}`, 'info');
            }
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
            
            const importedInvoices: Invoice[] = [];
            let duplicateCount = 0;
            
            for (const row of data) {
                const reg = (row.registration || '').toUpperCase().replace(/\s/g, '');
                const vehicle = (vehicles || []).find(v => v.registration === reg);
                const customer = (customers || []).find(c => (vehicle && c.id === vehicle.customerId) || (row.customerName && `${c.forename} ${c.surname}`.toLowerCase().includes(String(row.customerName).toLowerCase())));
                
                const tempInvoiceId = row.id || generateInvoiceId([...(invoices || []), ...importedInvoices], entityShortCode);
                const total = Number(row.total) || 0; 
                const net = total / 1.2;
                const invoice: Invoice = {
                    id: tempInvoiceId,
                    entityId: entityId,
                    customerId: customer?.id || 'unknown_customer',
                    vehicleId: vehicle?.id || 'unknown_vehicle',
                    issueDate: row.issueDate || formatDate(new Date()),
                    dueDate: row.dueDate || formatDate(new Date()),
                    status: row.status || 'Draft',
                    lineItems: [{ id: crypto.randomUUID(), description: 'Imported Balance', quantity: 1, unitPrice: net, isLabor: false, taxCodeId: (taxRates || []).find(t=>t.code==='T1')?.id }],
                    payments: [],
                    grandTotal: total
                };
                
                const isDuplicateInBatch = importedInvoices.some(imported => isDuplicateInvoice(imported, invoice));
                const isDuplicateInDb = (invoices || []).some(existing => isDuplicateInvoice(existing, invoice));
                
                if (isDuplicateInBatch || isDuplicateInDb) {
                    duplicateCount++;
                } else {
                    importedInvoices.push(invoice);
                }
            }
            
            for (const inv of importedInvoices) {
                await saveDocument('brooks_invoices', inv);
            }
            
            if (importedInvoices.length > 0) {
                setInvoices(prevInvoices => [...prevInvoices, ...importedInvoices]);
            }
            
            if (importedInvoices.length > 0) {
                onShowStatus(`Imported ${importedInvoices.length} new invoices successfully.${duplicateCount > 0 ? ` (${duplicateCount} duplicate(s) skipped)` : ''}`, 'success');
            } else {
                onShowStatus(`No new invoices imported. All ${duplicateCount} records were duplicates.`, 'info');
            }
        } catch (err) { 
            console.error(err); 
            onShowStatus('Error importing invoices.', 'error'); 
        }
        e.target.value = ''; 
        setImportTargetEntityId(null);
    };

    const handleBulkAction = async (entityId: string, actionType: 'archive' | 'delete') => {
        const entity = localEntities.find(e => e.id === entityId);
        const entityName = entity?.name || 'this entity';
        
        const targetJobs = (jobs || []).filter(j => 
            j.entityId === entityId && 
            (
                j.status === 'Unallocated' || 
                j.customerId === 'unknown_customer' || 
                isInvalidDate(j.scheduledDate)
            )
        );
        
        if (targetJobs.length === 0) {
            onShowStatus(`No unallocated or invalid jobs found for ${entityName}.`, 'info');
            return;
        }
        
        let confirmMsg = '';
        if (actionType === 'delete') {
            confirmMsg = `Are you sure you want to PERMANENTLY DELETE all ${targetJobs.length} unallocated or invalid jobs for ${entityName}? This action is destructive and cannot be undone.`;
        } else {
            confirmMsg = `Are you sure you want to ARCHIVE unallocated jobs and DELETE invalid jobs for ${entityName}? To prevent duplicate or invalid records on the vehicles, any duplicate or invalid (no customer or invalid date) jobs will be permanently deleted, and only unique valid jobs will be archived.`;
        }
            
        if (!confirm(confirmMsg)) return;
        
        onShowStatus(`Processing bulk ${actionType}...`, 'info');
        
        try {
            let archivedCount = 0;
            let deletedDuplicatesCount = 0;
            let deletedInvalidCount = 0;
            const deletedJobIds: string[] = [];
            
            if (actionType === 'delete') {
                for (const job of targetJobs) {
                    await deleteDocument('brooks_jobs', job.id);
                    deletedJobIds.push(job.id);
                    deletedInvalidCount++;
                }
                setJobs(prevJobs => prevJobs.filter(j => !deletedJobIds.includes(j.id)));
            } else {
                // Archive with deduplication and invalid filtering
                const jobsToKeepAndArchive: Job[] = [];
                const otherJobsInDb = (jobs || []).filter(j => 
                    j.entityId === entityId && 
                    j.status !== 'Unallocated' && 
                    j.customerId !== 'unknown_customer' && 
                    !isInvalidDate(j.scheduledDate)
                );
                
                for (const job of targetJobs) {
                    // Check if it's invalid (no customer or invalid scheduledDate)
                    const isInvalid = job.customerId === 'unknown_customer' || isInvalidDate(job.scheduledDate);
                    
                    if (isInvalid) {
                        await deleteDocument('brooks_jobs', job.id);
                        deletedJobIds.push(job.id);
                        deletedInvalidCount++;
                        continue;
                    }
                    
                    // Check if it duplicates any job already in the DB (non-unallocated)
                    const isDupInDb = otherJobsInDb.some(existing => isDuplicateJob(existing, job));
                    
                    // Check if it duplicates a job we've already decided to keep in this batch
                    const isDupInBatch = jobsToKeepAndArchive.some(kept => isDuplicateJob(kept, job));
                    
                    if (isDupInDb || isDupInBatch) {
                        // Delete the duplicate
                        await deleteDocument('brooks_jobs', job.id);
                        deletedJobIds.push(job.id);
                        deletedDuplicatesCount++;
                    } else {
                        // Keep and archive this unique job
                        await saveDocument('brooks_jobs', {
                            ...job,
                            status: 'Archived',
                            updatedAt: new Date().toISOString()
                        });
                        jobsToKeepAndArchive.push(job);
                        archivedCount++;
                    }
                }
                
                setJobs(prevJobs => prevJobs.map(j => {
                    const isKept = jobsToKeepAndArchive.some(k => k.id === j.id);
                    if (isKept) {
                        return {
                            ...j,
                            status: 'Archived' as const,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return j;
                }).filter(j => !deletedJobIds.includes(j.id)));
            }
            
            if (actionType === 'delete') {
                onShowStatus(`Successfully deleted ${deletedInvalidCount} unallocated or invalid jobs.`, 'success');
            } else {
                let statusText = `Successfully archived ${archivedCount} jobs.`;
                const deletedParts = [];
                if (deletedDuplicatesCount > 0) {
                    deletedParts.push(`${deletedDuplicatesCount} duplicate(s)`);
                }
                if (deletedInvalidCount > 0) {
                    deletedParts.push(`${deletedInvalidCount} invalid (no customer/date)`);
                }
                if (deletedParts.length > 0) {
                    statusText += ` Deleted ${deletedParts.join(' and ')} permanently to clean database.`;
                }
                onShowStatus(statusText, 'success');
            }
        } catch (error) {
            console.error(`Bulk ${actionType} failed:`, error);
            onShowStatus(`Failed to perform bulk ${actionType}.`, 'error');
        }
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

                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-2">
                                <MapPin size={14} className="text-gray-300" />
                                {e.city || 'No city set'}
                            </div>

                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-6">
                                <Mail size={14} className="text-indigo-400" />
                                <span className="text-xs text-indigo-600 font-semibold">{e.email || 'No email configured'}</span>
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

                            {/* Tidy Database Section */}
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px]">
                                <span className="font-bold text-gray-400 uppercase tracking-wider">Tidy DB:</span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleBulkAction(e.id, 'archive')}
                                        className="font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 hover:underline cursor-pointer"
                                        title="Archive all Unallocated jobs"
                                    >
                                        <Archive size={10} />
                                        Archive
                                    </button>
                                    <span className="text-gray-200 font-light">|</span>
                                    <button 
                                        onClick={() => handleBulkAction(e.id, 'delete')}
                                        className="font-black uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 hover:underline cursor-pointer"
                                        title="Delete all Unallocated jobs"
                                    >
                                        <Trash2 size={10} />
                                        Delete
                                    </button>
                                </div>
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