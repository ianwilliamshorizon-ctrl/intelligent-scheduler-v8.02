import React, { useCallback } from 'react';
import { useData } from '../state/DataContext';
import { useApp } from '../state/AppContext';
import * as T from '../../types';
import { generateSequenceId, saveDocument, deleteDocument } from '../db';
import { formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { calculateJobStatus } from '../utils/jobUtils';

export const useWorkshopActions = () => {
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    
    // Destructure setters to enable local state updates
    const { 
        jobs, setJobs,
        estimates, setEstimates,
        purchaseOrders, setPurchaseOrders,
        inquiries, setInquiries,
        parts, setParts,
        businessEntities, 
        vehicles, setVehicles
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

    // --- New: Search String Generator ---
    const generateSearchField = (item: any): string => {
        const parts: string[] = [];

        // Customer: Name and Company
        if (item.forename || item.surname || item.companyName) {
            parts.push(item.forename, item.surname, item.companyName);
        }
        // Vehicle: Reg, Make, Model
        if (item.registration || item.vrm) {
            parts.push(item.registration || item.vrm, item.make, item.model);
        }
        // Part: Part Number and Description
        if (item.partNumber || item.partName || item.description) {
            parts.push(item.partNumber, item.partName, item.description);
        }

        return parts
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .trim();
    };

    // Updated handleSaveItem to perform Search Indexing and Optimistic Update
    const handleSaveItem = async <Type extends { id: string }>(
        setter: React.Dispatch<React.SetStateAction<Type[]>>,
        item: Type,
        collectionOverride?: string
    ) => {
        // 0. Generate Search Index
        const searchField = generateSearchField(item);
        const itemToSave = searchField 
            ? { ...item, searchField } 
            : item;

        // 1. Optimistic / Local Update
        setter(prev => {
            const index = prev.findIndex(i => i.id === itemToSave.id);
            if (index >= 0) {
                const newArr = [...prev];
                newArr[index] = itemToSave;
                return newArr;
            } else {
                return [...prev, itemToSave];
            }
        });

        // 2. Persist to DB
        const col = collectionOverride || getCollectionName(itemToSave);
        await saveDocument(col, itemToSave);
    };

    const handleDeleteJob = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
             // Cancel job instead of deleting
             const updatedJob: T.Job = { ...job, status: 'Cancelled' };
             
             // 1. Optimistic Update
             setJobs(prev => prev.map(j => j.id === jobId ? updatedJob : j));
             
             // 2. Persist to DB
             await saveDocument('brooks_jobs', updatedJob);
             
             setConfirmation({
                 isOpen: true,
                 title: 'Job Cancelled',
                 message: `Job #${jobId} has been moved to Cancelled status and history retained.`,
                 type: 'success'
             });
        }
    };

    const updateLinkedInquiryStatus = async (estimateId: string, newStatus: T.Inquiry['status'], extraUpdates: Partial<T.Inquiry> = {}) => {
        const targetInquiry = inquiries.find(i => i.linkedEstimateId === estimateId && i.status !== 'Closed');
        if (targetInquiry) {
            const updatedInquiry = { ...targetInquiry, status: newStatus, ...extraUpdates };
            // Optimistic Update
            setInquiries(prev => prev.map(i => i.id === updatedInquiry.id ? updatedInquiry : i));
            // Persist
            await saveDocument('brooks_inquiries', updatedInquiry);
        }
    };

    const handleSaveEstimate = async (estimate: T.Estimate) => {
        const isNew = !estimates.some(e => e.id === estimate.id);
        
        // Optimistic Save
        handleSaveItem(setEstimates, estimate, 'brooks_estimates');
        
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
                linkedJobId: estimate.jobId,
                actionNotes: 'Auto-generated from workshop.',
            };
            handleSaveItem(setInquiries, newInquiry, 'brooks_inquiries');
            
            setConfirmation({ 
                isOpen: true, 
                title: 'Sent to Inquiries', 
                message: `Supplementary Estimate #${estimate.estimateNumber} has been created and sent to the Inquiries queue for review.`, 
                type: 'success',
                confirmText: 'OK',
                cancelText: '' // Hides the cancel button
            });
        }
    };

    const handleSavePurchaseOrder = async (po: T.PurchaseOrder) => {
        const poToSave = {
            ...po,
            createdByUserId: po.createdByUserId || currentUser.id
        };

        // Optimistic Save PO
        handleSaveItem(setPurchaseOrders, poToSave, 'brooks_purchaseOrders');

        // Update parts pricing if updates are included in the payload
        if (po.partUpdates && po.partUpdates.length > 0) {
            for (const part of po.partUpdates) {
                handleSaveItem(setParts, part, 'brooks_parts');
            }
        }

        if (po.jobId) {
            const job = jobs.find(j => j.id === po.jobId);
            if (job) {
                // Determine parts status based on *all* POs for this job
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
                    handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
                }
            }
        }
        
        // Auto-close inquiries if parts ordered
        inquiries.forEach(async (inq) => {
            const isLinkedToPO = inq.linkedPurchaseOrderIds?.includes(po.id);
            if (isLinkedToPO) {
                // Check if all linked POs are ordered
                const otherInqPos = purchaseOrders.filter(p => inq.linkedPurchaseOrderIds?.includes(p.id) && p.id !== po.id);
                const allInqPos = [...otherInqPos, po];
                const allOrderedOrBetter = allInqPos.every(p => ['Ordered', 'Partially Received', 'Received'].includes(p.status));
                
                // Note: We don't auto-close for supplementary anymore, we wait for the user to "Apply" or "Schedule"
                // But for initial inquiries (no job yet), we might still want this logic.
                // Keeping it conservative: Only update action notes.
                if (allOrderedOrBetter) {
                     const updatedInquiry = { 
                         ...inq, 
                         actionNotes: (inq.actionNotes || '') + `\n[System]: All parts ordered.` 
                     };
                     handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                }
            }
        });
    };

    const handleApproveEstimate = async (estimate: T.Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => {
        // Filter items based on selection
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
        
        // Update Estimate Status
        let updatedEstimate: T.Estimate = { 
            ...estimate, 
            lineItems: approvedLineItems, 
            status: 'Approved', 
            notes: notes ? `${estimate.notes || ''}\n${notes}` : estimate.notes 
        };

        // SCENARIO 1: Supplementary Estimate (Linked to existing job, NO specific new date selected)
        if (estimate.jobId && !scheduledDate) {
             const existingJob = jobs.find(j => j.id === estimate.jobId);
             
             if (existingJob) {
                 // 1. Generate Draft Purchase Orders (if parts needed)
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
                     
                     const entity = businessEntities.find(e => e.id === existingJob.entityId);
                     const entityShortCode = entity?.shortCode || 'UNK';
                     
                     for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                         const newPOId = await generateSequenceId('944', entityShortCode);
                         const vehicle = vehicles.find(v => v.id === existingJob.vehicleId);
                         
                         const newPO: T.PurchaseOrder = {
                             id: newPOId, 
                             entityId: existingJob.entityId, 
                             supplierId: supplierId === 'no_supplier' ? null : supplierId, 
                             vehicleRegistrationRef: vehicle?.registration || 'N/A',
                             orderDate: formatDate(new Date()), 
                             status: 'Draft', 
                             jobId: existingJob.id, // Link to parent job initially
                             createdByUserId: currentUser.id,
                             lineItems: items.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId }))
                         };
                         handleSaveItem(setPurchaseOrders, newPO, 'brooks_purchaseOrders');
                         newPurchaseOrderIds.push(newPOId);
                     }
                 }

                 // 2. Update Inquiry Status to 'Approved' & Link POs
                 const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
                 if (existingInquiry) {
                     const updatedInquiry = { 
                         ...existingInquiry, 
                         status: 'Approved' as const, 
                         linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds], 
                         actionNotes: (existingInquiry.actionNotes || '') + '\n[System]: Estimate Approved by Client. Action Required: Merge to Job or Reschedule.' 
                     };
                     handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                 }

                 setConfirmation({ 
                     isOpen: true, 
                     title: 'Estimate Approved', 
                     message: `Estimate marked as Approved. Purchase Orders (if any) have been created as Drafts. Go to Inquiries to order parts and apply work to the job card.`, 
                     type: 'success',
                     confirmText: 'OK',
                     cancelText: ''
                 });
             }
        }
        // SCENARIO 2: New Job from Estimate (Date selected)
        else if (scheduledDate) {
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
                 const newJobId = await generateSequenceId('992', entityShortCode);

                 for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                     const newPOId = await generateSequenceId('944', entityShortCode);
                     const vehicle = vehicles.find(v => v.id === estimate.vehicleId);
                     const newPO: T.PurchaseOrder = { id: newPOId, entityId: estimate.entityId, supplierId: supplierId === 'no_supplier' ? null : supplierId, vehicleRegistrationRef: vehicle?.registration || 'N/A', orderDate: formatDate(new Date()), status: 'Draft', jobId: newJobId, createdByUserId: currentUser.id, lineItems: items.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId })) };
                     handleSaveItem(setPurchaseOrders, newPO, 'brooks_purchaseOrders');
                     newPurchaseOrderIds.push(newPOId);
                 }
                 
                 const newJob: T.Job = { id: newJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Est #${estimate.estimateNumber}`, estimatedHours: Math.max(1, totalHours), scheduledDate: scheduledDate, status: 'Unallocated', createdAt: formatDate(new Date()), createdByUserId: currentUser.id, segments: [], estimateId: estimate.id, notes: notes || estimate.notes, vehicleStatus: 'Awaiting Arrival', partsStatus: newPurchaseOrderIds.length > 0 ? 'Awaiting Order' : 'Not Required', purchaseOrderIds: newPurchaseOrderIds.length > 0 ? newPurchaseOrderIds : undefined };
                 newJob.segments = splitJobIntoSegments(newJob);
                 handleSaveItem(setJobs, newJob, 'brooks_jobs');
                 updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: newJob.id };
                 
                 const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
                 if (existingInquiry) {
                      const updatedInquiry = { 
                          ...existingInquiry, 
                          status: 'Approved' as const, 
                          linkedJobId: newJob.id, 
                          linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds], 
                          actionNotes: (existingInquiry.actionNotes || '') + `\n[System]: Job Scheduled.` 
                      };
                      handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                 }
                 setConfirmation({ isOpen: true, title: 'Job Created', message: `Job #${newJob.id} created for ${scheduledDate}.`, type: 'success', confirmText: 'OK', cancelText: '' });
             } else {
                 const entityShortCode = entity?.shortCode || 'UNK';
                 const newJobId = await generateSequenceId('992', entityShortCode);
                 const newJob: T.Job = { id: newJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Est #${estimate.estimateNumber}`, estimatedHours: Math.max(1, totalHours), scheduledDate: scheduledDate, status: 'Unallocated', createdAt: formatDate(new Date()), createdByUserId: currentUser.id, segments: [], estimateId: estimate.id, notes: notes || estimate.notes, vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', purchaseOrderIds: undefined };
                 newJob.segments = splitJobIntoSegments(newJob);
                 handleSaveItem(setJobs, newJob, 'brooks_jobs');
                 updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: newJobId };
                 setConfirmation({ isOpen: true, title: 'Job Created', message: `Job #${newJobId} created for ${scheduledDate}.`, type: 'success', confirmText: 'OK', cancelText: '' });
             }
        } 
        
        handleSaveItem(setEstimates, updatedEstimate, 'brooks_estimates');
    };

    const handleMergeEstimateToJob = async (estimate: T.Estimate, jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        const approvedItems = (estimate.lineItems || []).filter(li => !li.isOptional);
        const additionalLaborHours = approvedItems.filter(li => li.isLabor).reduce((sum, i) => sum + i.quantity, 0);

        const inquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
        const linkedPOIds = inquiry?.linkedPurchaseOrderIds || [];

        let newSegments = [...(job.segments || [])];
        if (additionalLaborHours > 0) {
            let remainingToAdd = additionalLaborHours;
            while (remainingToAdd > 0) {
                const chunkDuration = Math.min(remainingToAdd, 8);
                newSegments.push({
                    segmentId: crypto.randomUUID(),
                    date: null, 
                    duration: chunkDuration,
                    status: 'Unallocated',
                    allocatedLift: null,
                    scheduledStartSegment: null,
                    engineerId: null
                });
                remainingToAdd -= chunkDuration;
            }
        }

        const updatedJob: T.Job = {
            ...job,
            estimatedHours: (job.estimatedHours || 0) + additionalLaborHours,
            purchaseOrderIds: [...(job.purchaseOrderIds || []), ...linkedPOIds],
            partsStatus: linkedPOIds.length > 0 ? 'Awaiting Order' : job.partsStatus,
            notes: (job.notes || '') + `\n\n--- Supplementary Work (Est #${estimate.estimateNumber}) ---\n` + (estimate.notes || ''),
            segments: newSegments,
            status: calculateJobStatus(newSegments)
        };
        
        const closedEstimate: T.Estimate = { ...estimate, status: 'Closed', notes: (estimate.notes || '') + '\n[Merged into Job]' };
        
        await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
        await handleSaveItem(setEstimates, closedEstimate, 'brooks_estimates');
        
        if (inquiry) {
            const closedInquiry = { ...inquiry, status: 'Closed' as const, actionNotes: (inquiry.actionNotes || '') + '\n[System]: Merged to Job.' };
            await handleSaveItem(setInquiries, closedInquiry, 'brooks_inquiries');
        }

        setConfirmation({
            isOpen: true,
            title: 'Supplementary Work Merged',
            message: `Items from Estimate #${estimate.estimateNumber} have been added to Job #${job.id}. ${additionalLaborHours > 0 ? `${additionalLaborHours} labor hours added to Unallocated queue.` : 'No labor hours added.'}`,
            type: 'success',
            confirmText: 'OK',
            cancelText: ''
        });
    };

    const handleUpdateSegmentStatus = async (jobId: string, segmentId: string, newStatus: T.JobSegment['status'], extraUpdates: Partial<T.JobSegment> = {}) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, status: newStatus, ...extraUpdates } : s);
            const updatedJob = { ...job, segments: newSegments, status: calculateJobStatus(newSegments) };
            handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
        }
    };

    const handleQcApprove = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.status === 'Engineer Complete' ? { ...s, status: 'QC Complete' as const, qcCompletedAt: new Date().toISOString(), qcCompletedByUserId: currentUser.id } : s);
            const updatedJob = { ...job, segments: newSegments, status: 'Complete' as const };
            handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
        }
    };

    const handleReassignEngineer = async (jobId: string, segmentId: string, newEngineerId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, engineerId: newEngineerId } : s);
            handleSaveItem(setJobs, { ...job, segments: newSegments }, 'brooks_jobs');
        }
    };

    const handleUnscheduleSegment = async (jobId: string, segmentId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, status: 'Unallocated' as const, allocatedLift: null, scheduledStartSegment: null, engineerId: null } : s);
            const updatedJob = { ...job, segments: newSegments, status: calculateJobStatus(newSegments) };
            handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
        }
    };

    return {
        handleSaveItem,
        handleDeleteJob,
        handleSaveEstimate,
        handleSavePurchaseOrder,
        handleApproveEstimate,
        handleMergeEstimateToJob,
        handleUpdateSegmentStatus,
        handleQcApprove,
        handleReassignEngineer,
        handleUnscheduleSegment,
        updateLinkedInquiryStatus
    };
};