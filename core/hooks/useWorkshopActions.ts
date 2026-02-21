import React, { useCallback } from 'react';
import { useData } from '../state/DataContext';
import { useApp } from '../state/AppContext';
import * as T from '../../types';
import { generateSequenceId, saveDocument, deleteDocument } from '../db';
import { formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { calculateJobStatus } from '../utils/jobUtils';

export const useWorkshopActions = (handleGenerateInvoice?: (jobId: string) => void) => {
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    
    const { 
        jobs, setJobs,
        estimates, setEstimates,
        purchaseOrders, setPurchaseOrders,
        inquiries, setInquiries,
        parts, setParts,
        businessEntities, 
        vehicles, setVehicles
    } = data;

    const getCollectionName = (item: any): string => {
        if ('estimateNumber' in item) return 'brooks_estimates';
        if ('vehicleRegistrationRef' in item) return 'brooks_purchaseOrders';
        if ('takenByUserId' in item) return 'brooks_inquiries';
        if ('segments' in item) return 'brooks_jobs';
        if ('costItems' in item) return 'brooks_servicePackages';
        if ('stockQuantity' in item && 'partNumber' in item) return 'brooks_parts';
        if ('forename' in item && 'surname' in item) return 'brooks_customers';
        if ('registration' in item && 'make' in item) return 'brooks_vehicles';
        if ('contactName' in item) return 'brooks_suppliers';
        if ('sections' in item && 'isDefault' in item) return 'brooks_inspectionTemplates';
        return 'brooks_items';
    };

    /**
     * handleSaveItem
     * Repaired to convert literal "\n" strings into real newline characters.
     */
    const handleSaveItem = async <Type extends { id: string }>(
        setter: React.Dispatch<React.SetStateAction<Type[]>>,
        item: Type,
        collectionOverride?: string
    ) => {
        const itemToSave = { ...item };
        const col = collectionOverride || getCollectionName(itemToSave);

        // This fixes the "\n" appearing as literal text in the Estimate Builder
        if (col === 'brooks_estimates' && Array.isArray((itemToSave as any)['lineItems'])) {
            (itemToSave as any)['lineItems'] = (itemToSave as any)['lineItems'].map((lineItem: any) => {
                if (lineItem && typeof lineItem.description === 'string') {
                    return { ...lineItem, description: lineItem.description.replace(/\\n/g, '\n') };
                }
                return lineItem;
            });
        }

        let finalItem: Type = itemToSave;

        setter(prev => {
            const index = prev.findIndex(i => i.id === itemToSave.id);
            if (index >= 0) {
                const existing = prev[index];
                const cleanUpdate = Object.fromEntries(
                    Object.entries(itemToSave).filter(([_, v]) => v !== undefined && v !== null)
                );
                
                finalItem = { ...existing, ...cleanUpdate as Type };

                const newArr = [...prev];
                newArr[index] = finalItem;
                return newArr;
            } else {
                finalItem = itemToSave;
                return [...prev, itemToSave];
            }
        });

        await saveDocument(col, finalItem);
        return finalItem;
    };

    const handleDeleteJob = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
             const updatedJob: T.Job = { ...job, status: 'Cancelled' };
             await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
             setConfirmation({
                 isOpen: true,
                 title: 'Job Cancelled',
                 message: `Job #${jobId} has been moved to Cancelled status.`,
                 type: 'success'
             });
        }
    };

    const updateLinkedInquiryStatus = async (estimateId: string, newStatus: T.Inquiry['status'], extraUpdates: Partial<T.Inquiry> = {}) => {
        const targetInquiry = inquiries.find(i => i.linkedEstimateId === estimateId && i.status !== 'Closed');
        if (targetInquiry) {
            await handleSaveItem(setInquiries, { ...targetInquiry, status: newStatus, ...extraUpdates } as T.Inquiry);
        }
    };

    const handleSaveEstimate = async (estimate: T.Estimate) => {
        const isNew = !estimates.some(e => e.id === estimate.id);
        await handleSaveItem(setEstimates, estimate);
        
        if (estimate.status === 'Sent') await updateLinkedInquiryStatus(estimate.id, 'Sent');
        
        if (isNew && estimate.jobId) {
             const newInquiry: T.Inquiry = {
                id: crypto.randomUUID(),
                entityId: estimate.entityId,
                createdAt: new Date().toISOString(),
                fromName: `Workshop (${currentUser.name})`,
                fromContact: 'Internal',
                message: `Supplementary Estimate #${estimate.estimateNumber} created for Job #${estimate.jobId}.`,
                takenByUserId: currentUser.id,
                status: 'Open',
                linkedCustomerId: estimate.customerId,
                linkedVehicleId: estimate.vehicleId,
                linkedEstimateId: estimate.id,
                linkedJobId: estimate.jobId,
                actionNotes: 'Auto-generated from workshop.',
            };
            await handleSaveItem(setInquiries, newInquiry);
            
            setConfirmation({ 
                isOpen: true, 
                title: 'Sent to Inquiries', 
                message: `Estimate #${estimate.estimateNumber} sent for review.`, 
                type: 'success'
            });
        }
    };

    const handleSavePurchaseOrder = async (po: T.PurchaseOrder) => {
        const existingPO = purchaseOrders.find(p => p.id === po.id);
        
        const poToSave: T.PurchaseOrder = {
            ...existingPO,
            ...po,
            supplierId: po.supplierId || existingPO?.supplierId || '',
            createdByUserId: po.createdByUserId || existingPO?.createdByUserId || currentUser.id
        } as T.PurchaseOrder;

        await handleSaveItem(setPurchaseOrders, poToSave, 'brooks_purchaseOrders');

        if (po.partUpdates && po.partUpdates.length > 0) {
            for (const part of po.partUpdates) {
                await handleSaveItem(setParts, part, 'brooks_parts');
            }
        }

        if (poToSave.jobId) {
            const job = jobs.find(j => j.id === poToSave.jobId);
            if (job) {
                const otherJobPOs = purchaseOrders.filter(p => p.jobId === job.id && p.id !== poToSave.id);
                const allJobPOs = [...otherJobPOs, poToSave];
                
                let newPartsStatus: T.Job['partsStatus'] = job.partsStatus;
                if (allJobPOs.length > 0) {
                     if (allJobPOs.every(p => p.status === 'Received')) newPartsStatus = 'Fully Received';
                     else if (allJobPOs.some(p => p.status === 'Partially Received' || p.status === 'Received')) newPartsStatus = 'Partially Received';
                     else if (allJobPOs.some(p => p.status === 'Ordered')) newPartsStatus = 'Ordered';
                     else newPartsStatus = 'Awaiting Order';
                }
                
                const needsIdLink = !job.purchaseOrderIds?.includes(poToSave.id);
                if (newPartsStatus !== job.partsStatus || needsIdLink) {
                    const updatedJob = { 
                        ...job, 
                        partsStatus: newPartsStatus, 
                        purchaseOrderIds: needsIdLink ? [...(job.purchaseOrderIds || []), poToSave.id] : job.purchaseOrderIds 
                    };
                    await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
                }
            }
        }
        
        for (const inq of inquiries) {
            const isLinkedToPO = inq.linkedPurchaseOrderIds?.includes(poToSave.id);
            if (isLinkedToPO) {
                const otherInqPos = purchaseOrders.filter(p => inq.linkedPurchaseOrderIds?.includes(p.id) && p.id !== poToSave.id);
                const allInqPos = [...otherInqPos, poToSave];
                const allOrderedOrBetter = allInqPos.every(p => ['Ordered', 'Partially Received', 'Received'].includes(p.status));
                
                if (allOrderedOrBetter) {
                    const updatedInquiry = { 
                        ...inq, 
                        actionNotes: (inq.actionNotes || '') + `\n[System]: All parts ordered.` 
                    };
                    await handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                }
            }
        }
    };

    const handleApproveEstimate = async (estimate: T.Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => {
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
        
        let updatedEstimate: T.Estimate = { 
            ...estimate, 
            lineItems: approvedLineItems, 
            status: 'Approved', 
            notes: notes ? `${estimate.notes || ''}\n${notes}` : estimate.notes 
        };

        const createPOs = async (targetJobId: string, entityCode: string, itemsForPO: T.EstimateLineItem[]) => {
            const partItems = itemsForPO.filter(li => !li.isLabor && li.partId);
            const poIds: string[] = [];
            if (partItems.length > 0) {
                const partsBySupplier: Record<string, T.EstimateLineItem[]> = {};
                partItems.forEach(item => {
                    const partDef = parts.find(p => p.id === item.partId);
                    const sId = partDef?.defaultSupplierId || 'PENDING_SUPPLIER';
                    if (!partsBySupplier[sId]) partsBySupplier[sId] = [];
                    partsBySupplier[sId].push(item);
                });

                for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                    const newPOId = await generateSequenceId('944', entityCode);
                    const vehicle = vehicles.find(v => v.id === estimate.vehicleId);
                    const newPO: T.PurchaseOrder = {
                        id: newPOId, 
                        entityId: estimate.entityId, 
                        supplierId: supplierId === 'PENDING_SUPPLIER' ? '' : supplierId, 
                        vehicleRegistrationRef: vehicle?.registration || 'N/A',
                        orderDate: formatDate(new Date()), 
                        status: 'Draft', 
                        jobId: targetJobId,
                        createdByUserId: currentUser.id,
                        lineItems: items.map(item => ({ 
                            id: crypto.randomUUID(), 
                            partNumber: item.partNumber || '', 
                            description: item.description || '', 
                            quantity: item.quantity, 
                            receivedQuantity: 0, 
                            unitPrice: item.unitCost || 0, 
                            taxCodeId: item.taxCodeId || '' 
                        }))
                    };
                    await handleSavePurchaseOrder(newPO);
                    poIds.push(newPOId);
                }
            }
            return poIds;
        };

        if (estimate.jobId && !scheduledDate) {
             const existingJob = jobs.find(j => j.id === estimate.jobId);
             if (existingJob) {
                 const entity = businessEntities.find(e => e.id === existingJob.entityId);
                 const newPurchaseOrderIds = await createPOs(existingJob.id, entity?.shortCode || 'UNK', approvedLineItems);

                 const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
                 if (existingInquiry) {
                     const updatedInquiry = { 
                         ...existingInquiry, 
                         status: 'Approved' as const, 
                         linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds], 
                         actionNotes: (existingInquiry.actionNotes || '') + '\n[System]: Approved and POs generated.' 
                     };
                     await handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                 }
                 setConfirmation({ isOpen: true, title: 'Estimate Approved', message: `Draft POs created.`, type: 'success' });
             }
        } else if (scheduledDate) {
            const isMotOnly = approvedLineItems.every(li => li.description === 'MOT');
            const includesMot = approvedLineItems.some(li => li.description === 'MOT');
            const entity = businessEntities.find(e => e.id === estimate.entityId);
            const entityShortCode = entity?.shortCode || 'UNK';

            if (isMotOnly) {
                const newJobId = await generateSequenceId('992', entityShortCode);
                const newJob: T.Job = { 
                    id: newJobId, 
                    entityId: estimate.entityId, 
                    vehicleId: estimate.vehicleId, 
                    customerId: estimate.customerId, 
                    description: 'MOT', 
                    estimatedHours: 1, 
                    scheduledDate: scheduledDate, 
                    status: 'Unallocated', 
                    createdAt: new Date().toISOString(), 
                    createdByUserId: currentUser.id, 
                    segments: [{ segmentId: crypto.randomUUID(), date: scheduledDate, duration: 1, status: 'Unallocated', allocatedLift: 'MOT', scheduledStartSegment: null, engineerId: null }], 
                    estimateId: estimate.id, 
                    notes: `MOT Only job created from Estimate #${estimate.estimateNumber}`,
                    vehicleStatus: 'Awaiting Arrival', 
                    partsStatus: 'Not Required',
                    isStandalone: true
                };
                await handleSaveItem(setJobs, newJob, 'brooks_jobs');
                updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: newJob.id };
                setConfirmation({ isOpen: true, title: 'MOT Job Created', message: `Job #${newJob.id} for MOT created and assigned to MOT Lift.`, type: 'success' });

            } else if (includesMot) {
                const motJobId = await generateSequenceId('992', entityShortCode);
                const mainJobId = await generateSequenceId('992', entityShortCode);

                const otherLineItems = approvedLineItems.filter(li => li.description !== 'MOT');
                const otherLaborHours = otherLineItems.filter(li => li.isLabor).reduce((acc, i) => acc + i.quantity, 0);

                const motJob: T.Job = {
                    id: motJobId,
                    entityId: estimate.entityId,
                    vehicleId: estimate.vehicleId,
                    customerId: estimate.customerId,
                    description: 'MOT',
                    estimatedHours: 1,
                    scheduledDate: scheduledDate,
                    status: 'Unallocated',
                    createdAt: new Date().toISOString(),
                    createdByUserId: currentUser.id,
                    segments: [{ segmentId: crypto.randomUUID(), date: scheduledDate, duration: 1, status: 'Unallocated', allocatedLift: 'MOT', scheduledStartSegment: null, engineerId: null }],
                    estimateId: estimate.id,
                    notes: `Associated with Job #${mainJobId}`,
                    vehicleStatus: 'Awaiting Arrival',
                    partsStatus: 'Not Required',
                    isStandalone: false,
                    associatedJobId: mainJobId
                };
                await handleSaveItem(setJobs, motJob, 'brooks_jobs');

                const mainJobPOIds = await createPOs(mainJobId, entityShortCode, otherLineItems);
                const mainJob: T.Job = {
                    id: mainJobId,
                    entityId: estimate.entityId,
                    vehicleId: estimate.vehicleId,
                    customerId: estimate.customerId,
                    description: `Est #${estimate.estimateNumber}`,
                    estimatedHours: Math.max(1, otherLaborHours),
                    scheduledDate: scheduledDate,
                    status: 'Unallocated',
                    createdAt: new Date().toISOString(),
                    createdByUserId: currentUser.id,
                    segments: [],
                    estimateId: estimate.id,
                    notes: `MOT booked separately as Job #${motJobId}.\n${notes || estimate.notes || ''}`,
                    vehicleStatus: 'Awaiting Arrival',
                    partsStatus: mainJobPOIds.length > 0 ? 'Awaiting Order' : 'Not Required',
                    purchaseOrderIds: mainJobPOIds,
                    associatedJobId: motJobId
                };
                mainJob.segments = splitJobIntoSegments(mainJob);
                await handleSaveItem(setJobs, mainJob, 'brooks_jobs');

                updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: mainJob.id };
                setConfirmation({ isOpen: true, title: 'Jobs Created', message: `Main Job #${mainJobId} and MOT Job #${motJobId} created.`, type: 'success' });

            } else { 
                const newJobId = await generateSequenceId('992', entityShortCode);
                const newPurchaseOrderIds = await createPOs(newJobId, entityShortCode, approvedLineItems);
                const laborItems = approvedLineItems.filter(li => li.isLabor);
                const totalHours = laborItems.reduce((acc, i) => acc + i.quantity, 0);
                const newJob: T.Job = { 
                    id: newJobId, 
                    entityId: estimate.entityId, 
                    vehicleId: estimate.vehicleId, 
                    customerId: estimate.customerId, 
                    description: `Est #${estimate.estimateNumber}`, 
                    estimatedHours: Math.max(1, totalHours), 
                    scheduledDate: scheduledDate, 
                    status: 'Unallocated', 
                    createdAt: new Date().toISOString(), 
                    createdByUserId: currentUser.id, 
                    segments: [], 
                    estimateId: estimate.id, 
                    notes: notes || estimate.notes, 
                    vehicleStatus: 'Awaiting Arrival', 
                    partsStatus: newPurchaseOrderIds.length > 0 ? 'Awaiting Order' : 'Not Required', 
                    purchaseOrderIds: newPurchaseOrderIds 
                };
                newJob.segments = splitJobIntoSegments(newJob);
                await handleSaveItem(setJobs, newJob, 'brooks_jobs');
                updatedEstimate = { ...updatedEstimate, status: 'Converted to Job', jobId: newJob.id };
                setConfirmation({ isOpen: true, title: 'Job Created', message: `Job #${newJob.id} created.`, type: 'success' });
            }
             
             const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
             if (existingInquiry) {
                  await handleSaveItem(setInquiries, { ...existingInquiry, status: 'Approved', linkedJobId: updatedEstimate.jobId }, 'brooks_inquiries');
             }
        } 
        await handleSaveItem(setEstimates, updatedEstimate, 'brooks_estimates');
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
            partsStatus: (linkedPOIds.length > 0 || (job.purchaseOrderIds && job.purchaseOrderIds.length > 0)) ? job.partsStatus : 'Not Required',
            notes: (job.notes || '') + `\n\n--- Supplementary (Est #${estimate.estimateNumber}) ---\n` + (estimate.notes || ''),
            segments: newSegments,
            status: calculateJobStatus(newSegments)
        };
        
        await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
        await handleSaveItem(setEstimates, { ...estimate, status: 'Closed' } as T.Estimate, 'brooks_estimates');
        
        if (inquiry) {
            await handleSaveItem(setInquiries, { ...inquiry, status: 'Closed' } as T.Inquiry, 'brooks_inquiries');
        }

        setConfirmation({ isOpen: true, title: 'Work Merged', message: `Added to Job #${job.id}.`, type: 'success' });
    };

    const handleUpdateSegmentStatus = async (jobId: string, segmentId: string, newStatus: T.JobSegment['status'], extraUpdates: Partial<T.JobSegment> = {}) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, status: newStatus, ...extraUpdates } : s);
            await handleSaveItem(setJobs, { ...job, segments: newSegments, status: calculateJobStatus(newSegments) } as T.Job, 'brooks_jobs');
        }
    };


    const handleQcApprove = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        const newSegments = job.segments.map(s => 
            s.status === 'Engineer Complete' 
                ? { ...s, status: 'QC Complete' as const, qcCompletedAt: new Date().toISOString(), qcCompletedByUserId: currentUser.id } 
                : s
        );

        const newStatus = calculateJobStatus(newSegments);
        const updatedJob = { ...job, segments: newSegments, status: newStatus } as T.Job;
        await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');

        // If this is a main job, find and close the associated MOT job
        if (job.associatedJobId) {
            const associatedMOT = jobs.find(j => j.id === job.associatedJobId && j.description === 'MOT');
            if (associatedMOT) {
                await handleSaveItem(setJobs, { ...associatedMOT, status: 'Closed' } as T.Job, 'brooks_jobs');
            }
        }
    };

    const handleReassignEngineer = async (jobId: string, segmentId: string, newEngineerId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, engineerId: newEngineerId } : s);
            await handleSaveItem(setJobs, { ...job, segments: newSegments } as T.Job, 'brooks_jobs');

            // If this is a main job, find and assign the unassigned MOT job
            if (job.associatedJobId) {
                const associatedMOT = jobs.find(j => j.id === job.associatedJobId && j.description === 'MOT');
                if (associatedMOT && associatedMOT.segments.every(s => !s.engineerId)) {
                    const newMotSegments = associatedMOT.segments.map(s => ({ ...s, engineerId: newEngineerId }));
                    await handleSaveItem(setJobs, { ...associatedMOT, segments: newMotSegments } as T.Job, 'brooks_jobs');
                }
            }
        }
    };

    const handleUnscheduleSegment = async (jobId: string, segmentId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            const newSegments = job.segments.map(s => s.segmentId === segmentId ? { ...s, status: 'Unallocated' as const, allocatedLift: null, scheduledStartSegment: null, engineerId: null } : s);
            await handleSaveItem(setJobs, { ...job, segments: newSegments, status: calculateJobStatus(newSegments) } as T.Job, 'brooks_jobs');
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