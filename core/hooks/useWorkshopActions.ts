
import React, { useCallback } from 'react';
import { useData } from '../state/DataContext';
import { useApp } from '../state/AppContext';
import * as T from '../../types';
import { generateSequenceId, saveDocument } from '../db';
import { formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { calculateJobStatus } from '../utils/jobUtils';

export const useWorkshopActions = () => {
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    const { 
        jobs, estimates, purchaseOrders, inquiries, parts, businessEntities, vehicles
    } = data;

    // Helper to determine collection name based on item properties
    const getCollectionName = (item: any): string => {
        // Core Workflow
        if ('estimateNumber' in item) return 'brooks_estimates';
        if ('vehicleRegistrationRef' in item) return 'brooks_purchaseOrders';
        if ('takenByUserId' in item) return 'brooks_inquiries';
        if ('segments' in item) return 'brooks_jobs';
        
        // Workshop Data
        if ('costItems' in item) return 'brooks_servicePackages';
        if ('stockQuantity' in item && 'partNumber' in item) return 'brooks_parts';
        
        // CRM
        if ('forename' in item && 'surname' in item) return 'brooks_customers';
        if ('registration' in item && 'make' in item) return 'brooks_vehicles';
        
        // Other
        if ('contactName' in item) return 'brooks_suppliers';
        
        console.warn("Could not determine collection for item, saving to generic 'brooks_items'", item);
        return 'brooks_items';
    };

    // Refactored to Write to Cloud directly
    const handleSaveItem = async <Type extends { id: string }>(
        setter: React.Dispatch<React.SetStateAction<Type[]>>, // Kept for type compatibility but ignored
        item: Type,
        collectionOverride?: string
    ) => {
        // Optimistic UI is handled by Firestore SDK + onSnapshot in usePersistentState
        const col = collectionOverride || getCollectionName(item);
        await saveDocument(col, item);
    };

    const updateLinkedInquiryStatus = async (estimateId: string, newStatus: T.Inquiry['status'], extraUpdates: Partial<T.Inquiry> = {}) => {
        const targetInquiry = inquiries.find(i => i.linkedEstimateId === estimateId && i.status !== 'Closed');
        if (targetInquiry) {
            await saveDocument('brooks_inquiries', { ...targetInquiry, status: newStatus, ...extraUpdates });
        }
    };

    const handleSaveEstimate = async (estimate: T.Estimate) => {
        const isNew = !estimates.some(e => e.id === estimate.id);
        
        await saveDocument('brooks_estimates', estimate);
        
        if (estimate.status === 'Sent') updateLinkedInquiryStatus(estimate.id, 'Sent');
        
        if (isNew && estimate.jobId) {
             const newInquiry: T.Inquiry = {
                id: crypto.randomUUID(),
                entityId: estimate.entityId,
                createdAt: new Date().toISOString(),
                fromName: `Workshop (${currentUser.name})`,
                fromContact: 'Internal',
                message: `Supplementary Estimate #${estimate.estimateNumber} created for Job #${estimate.jobId}. Please review and send to customer.`,
                takenByUserId: currentUser.id,
                status: 'Open',
                linkedCustomerId: estimate.customerId,
                linkedVehicleId: estimate.vehicleId,
                linkedEstimateId: estimate.id,
                actionNotes: 'Auto-generated from workshop.',
            };
            await saveDocument('brooks_inquiries', newInquiry);
            
            setConfirmation({ isOpen: true, title: 'Sent to Inquiries', message: `Supplementary Estimate #${estimate.estimateNumber} has been created and sent to the Inquiries queue for review.`, type: 'success' });
        }
    };

    const handleSavePurchaseOrder = async (po: T.PurchaseOrder) => {
        const poToSave = {
            ...po,
            createdByUserId: po.createdByUserId || currentUser.id
        };
        await saveDocument('brooks_purchaseOrders', poToSave);

        if (po.jobId) {
            const job = jobs.find(j => j.id === po.jobId);
            if (job) {
                // Determine parts status based on *all* POs for this job
                // Note: We use the local state 'purchaseOrders' for calculation as it reflects the snapshot
                const otherJobPOs = purchaseOrders.filter(p => p.jobId === job.id && p.id !== po.id);
                const allJobPOs = [...otherJobPOs, poToSave];
                
                let newPartsStatus: T.Job['partsStatus'] = job.partsStatus;
                if (allJobPOs.length > 0) {
                     if (allJobPOs.every(p => p.status === 'Received')) newPartsStatus = 'Fully Received';
                     else if (allJobPOs.some(p => p.status === 'Partially Received' || p.status === 'Received')) newPartsStatus = 'Partially Received';
                     else if (allJobPOs.some(p => p.status === 'Ordered')) newPartsStatus = 'Ordered';
                     else newPartsStatus = 'Awaiting Order';
                }
                
                const needsIdLink = !job.purchaseOrderIds?.includes(po.id);
                if (newPartsStatus !== job.partsStatus || needsIdLink) {
                    const updatedJob = { ...job, partsStatus: newPartsStatus, purchaseOrderIds: needsIdLink ? [...(job.purchaseOrderIds || []), po.id] : job.purchaseOrderIds };
                    await saveDocument('brooks_jobs', updatedJob);
                }
            }
        }
        
        // Auto-close inquiries if parts ordered
        // Logic simplified for async
        inquiries.forEach(async (inq) => {
            const isLinkedToPO = inq.linkedPurchaseOrderIds?.includes(po.id);
            if (isLinkedToPO) {
                // Check if all linked POs are ordered
                const otherInqPos = purchaseOrders.filter(p => inq.linkedPurchaseOrderIds?.includes(p.id) && p.id !== po.id);
                const allInqPos = [...otherInqPos, po];
                const allOrderedOrBetter = allInqPos.every(p => ['Ordered', 'Partially Received', 'Received'].includes(p.status));
                
                if (allOrderedOrBetter && inq.status !== 'Closed') {
                     await saveDocument('brooks_inquiries', { 
                         ...inq, 
                         status: 'Closed', 
                         actionNotes: (inq.actionNotes || '') + `\n[System]: All parts ordered. Inquiry closed.` 
                     });
                }
            }
        });
    };

    const handleApproveEstimate = async (estimate: T.Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => {
        // Logic for filtering items remains the same...
        const explicitItemIds = new Set((estimate.lineItems || []).filter(li => !li.isOptional || selectedOptionalItemIds.includes(li.id)).map(i => i.id));
        const allIncludedIds = new Set(explicitItemIds);
        (estimate.lineItems || []).forEach(item => {
            if (item.isPackageComponent && item.servicePackageId) {
                const header = (estimate.lineItems || []).find(h => h.servicePackageId === item.servicePackageId && !h.isPackageComponent);
                if (header && explicitItemIds.has(header.id)) allIncludedIds.add(item.id);
            }
        });
        const activeLineItems = (estimate.lineItems || []).filter(li => allIncludedIds.has(li.id));
        const approvedLineItems = activeLineItems.map(li => ({ ...li, isOptional: false }));
        let updatedEstimate: T.Estimate = { ...estimate, lineItems: approvedLineItems, status: 'Approved', notes: notes ? `${estimate.notes || ''}\n${notes}` : estimate.notes };

        if (estimate.jobId && !scheduledDate) {
             // Supplementary Approval Logic
             const existingJob = jobs.find(j => j.id === estimate.jobId);
             if (existingJob) {
                 // Create POs logic...
                 const partItems = approvedLineItems.filter(li => !li.isLabor && li.partId);
                 const newPurchaseOrderIds: string[] = [];
                 
                 // Generate POs
                 if (partItems.length > 0) {
                     const partsBySupplier: Record<string, T.EstimateLineItem[]> = {};
                     partItems.forEach(item => {
                         const partDef = parts.find(p => p.id === item.partId);
                         const supplierId = partDef?.defaultSupplierId || 'no_supplier';
                         if (!partsBySupplier[supplierId]) partsBySupplier[supplierId] = [];
                         partsBySupplier[supplierId].push(item);
                     });
                     
                     const entity = businessEntities.find(e => e.id === existingJob.entityId);
                     const entityShortCode = entity?.shortCode || 'UNK';
                     
                     for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                         // ASYNC ID GENERATION
                         const newPOId = await generateSequenceId('944', entityShortCode);
                         const vehicle = vehicles.find(v => v.id === existingJob.vehicleId);
                         
                         const newPO: T.PurchaseOrder = {
                             id: newPOId, 
                             entityId: existingJob.entityId, 
                             supplierId: supplierId === 'no_supplier' ? null : supplierId, 
                             vehicleRegistrationRef: vehicle?.registration || 'N/A',
                             orderDate: formatDate(new Date()), 
                             status: 'Draft', 
                             jobId: existingJob.id, 
                             createdByUserId: currentUser.id,
                             lineItems: items.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId }))
                         };
                         await saveDocument('brooks_purchaseOrders', newPO);
                         newPurchaseOrderIds.push(newPOId);
                     }
                 }

                 let jobUpdates: Partial<T.Job> = {};
                 if (newPurchaseOrderIds.length > 0) {
                     const allPOIds = [...(existingJob.purchaseOrderIds || []), ...newPurchaseOrderIds];
                     jobUpdates.purchaseOrderIds = allPOIds; 
                     jobUpdates.partsStatus = 'Awaiting Order'; 
                 }
                 const additionalHours = approvedLineItems.filter(li => li.isLabor).reduce((sum, i) => sum + i.quantity, 0);
                 if (additionalHours > 0) jobUpdates.estimatedHours = (existingJob.estimatedHours || 0) + additionalHours;
                 
                 // Merge Logic
                 if (existingJob.estimateId && existingJob.estimateId !== estimate.id) {
                     const mainEstimate = estimates.find(e => e.id === existingJob.estimateId);
                     if (mainEstimate) {
                         const mergedItems = [...(mainEstimate.lineItems || []), ...approvedLineItems];
                         await saveDocument('brooks_estimates', { ...mainEstimate, lineItems: mergedItems });
                         updatedEstimate.notes = (updatedEstimate.notes || '') + ' [Merged into Job Estimate]';
                     }
                 } else if (!existingJob.estimateId) {
                     jobUpdates.estimateId = estimate.id;
                 }
                 
                 if (Object.keys(jobUpdates).length > 0) {
                     await saveDocument('brooks_jobs', { ...existingJob, ...jobUpdates });
                 }

                 // Update Inquiry
                 const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
                 if (existingInquiry) {
                     await saveDocument('brooks_inquiries', { 
                         ...existingInquiry, 
                         status: 'Approved', 
                         linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds], 
                         actionNotes: (existingInquiry.actionNotes || '') + '\n[System]: Supplementary Estimate Approved. Parts ordered/work authorized.' 
                     });
                 }

                 updatedEstimate.status = 'Closed'; 
                 setConfirmation({ isOpen: true, title: 'Supplementary Work Approved', message: `Job #${existingJob.id} updated. New Purchase Order(s) created and tracking card added to Inquiries.`, type: 'success' });
             }
        }
        else if (scheduledDate) {
             // Create New Job Logic
             const entity = businessEntities.find(e => e.id === estimate.entityId);
             const laborItems = approvedLineItems.filter(li => li.isLabor);
             const totalHours = laborItems.reduce((acc, i) => acc + i.quantity, 0);
             const partItems = approvedLineItems.filter(li => !li.isLabor && li.partId);
             const newPurchaseOrderIds: string[] = [];

             if (partItems.length > 0) {
                 const partsBySupplier: Record<string, T.EstimateLineItem[]> = {};
                 partItems.forEach(item => {
                     const partDef = parts.find(p => p.id === item.partId);
                     const supplierId = partDef?.defaultSupplierId || 'no_supplier';
                     if (!partsBySupplier[supplierId]) partsBySupplier[supplierId] = [];
                     partsBySupplier[supplierId].push(item);
                 });
                 
                 const entityShortCode = entity?.shortCode || 'UNK';
                 
                 // ASYNC ID GENERATION
                 const newJobId = await generateSequenceId('992', entityShortCode);

                 for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                     const newPOId = await generateSequenceId('944', entityShortCode);
                     const vehicle = vehicles.find(v => v.id === estimate.vehicleId);
                     const newPO: T.PurchaseOrder = { id: newPOId, entityId: estimate.entityId, supplierId: supplierId === 'no_supplier' ? null : supplierId, vehicleRegistrationRef: vehicle?.registration || 'N/A', orderDate: formatDate(new Date()), status: 'Draft', jobId: newJobId, createdByUserId: currentUser.id, lineItems: items.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId })) };
                     await saveDocument('brooks_purchaseOrders', newPO);
                     newPurchaseOrderIds.push(newPOId);
                 }
                 
                 const newJob: T.Job = { id: newJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Est #${estimate.estimateNumber}`, estimatedHours: Math.max(1, totalHours), scheduledDate: scheduledDate, status: 'Unallocated', createdAt: formatDate(new Date()), createdByUserId: currentUser.id, segments: [], estimateId: estimate.id, notes: notes || estimate.notes, vehicleStatus: 'Awaiting Arrival', partsStatus: newPurchaseOrderIds.length > 0 ? 'Awaiting Order' : 'Not Required', purchaseOrderIds: newPurchaseOrderIds.length > 0 ? newPurchaseOrderIds : undefined };
                 newJob.segments = splitJobIntoSegments(newJob);
                 
                 await saveDocument('brooks_jobs', newJob);
                 
                 updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: newJob.id };
                 
                 const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
                 if (existingInquiry) {
                      const status = newPurchaseOrderIds.length > 0 ? 'Approved' : 'Closed';
                      await saveDocument('brooks_inquiries', { 
                          ...existingInquiry, 
                          status: status as any, 
                          linkedJobId: newJob.id, 
                          linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds], 
                          actionNotes: (existingInquiry.actionNotes || '') + `\n[System]: Job Scheduled.` 
                      });
                 }
                 setConfirmation({ isOpen: true, title: 'Job Created', message: `Job #${newJob.id} created for ${scheduledDate}.`, type: 'success' });
             } else {
                 // Fallback if no parts, still need to create job...
                 const entityShortCode = entity?.shortCode || 'UNK';
                 const newJobId = await generateSequenceId('992', entityShortCode);
                 const newJob: T.Job = { id: newJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Est #${estimate.estimateNumber}`, estimatedHours: Math.max(1, totalHours), scheduledDate: scheduledDate, status: 'Unallocated', createdAt: formatDate(new Date()), createdByUserId: currentUser.id, segments: [], estimateId: estimate.id, notes: notes || estimate.notes, vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', purchaseOrderIds: undefined };
                 newJob.segments = splitJobIntoSegments(newJob);
                 await saveDocument('brooks_jobs', newJob);
                 updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: newJobId };
                 setConfirmation({ isOpen: true, title: 'Job Created', message: `Job #${newJobId} created for ${scheduledDate}.`, type: 'success' });
             }
        } else {
             setConfirmation({ isOpen: true, title: 'Estimate Approved', message: 'Estimate has been marked as approved.', type: 'success' });
             updateLinkedInquiryStatus(estimate.id, 'Approved');
        }
        await saveDocument('brooks_estimates', updatedEstimate);
    };

    const handleUpdateSegmentStatus = async (jobId: string, segmentId: string, newStatus: T.JobSegment['status'], extraUpdates: Partial<T.JobSegment> = {}) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, status: newStatus, ...extraUpdates } : s);
            const updatedJob = { ...job, segments: newSegments, status: calculateJobStatus(newSegments) };
            await saveDocument('brooks_jobs', updatedJob);
        }
    };

    const handleQcApprove = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.status === 'Engineer Complete' ? { ...s, status: 'QC Complete' as const, qcCompletedAt: new Date().toISOString(), qcCompletedByUserId: currentUser.id } : s);
            const updatedJob = { ...job, segments: newSegments, status: 'Complete' as const };
            await saveDocument('brooks_jobs', updatedJob);
        }
    };

    const handleReassignEngineer = async (jobId: string, segmentId: string, newEngineerId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, engineerId: newEngineerId } : s);
            await saveDocument('brooks_jobs', { ...job, segments: newSegments });
        }
    };

    const handleUnscheduleSegment = async (jobId: string, segmentId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, status: 'Unallocated' as const, allocatedLift: null, scheduledStartSegment: null, engineerId: null } : s);
            const updatedJob = { ...job, segments: newSegments, status: calculateJobStatus(newSegments) };
            await saveDocument('brooks_jobs', updatedJob);
        }
    };

    return {
        handleSaveItem,
        handleSaveEstimate,
        handleSavePurchaseOrder,
        handleApproveEstimate,
        handleUpdateSegmentStatus,
        handleQcApprove,
        handleReassignEngineer,
        handleUnscheduleSegment,
        updateLinkedInquiryStatus
    };
};
