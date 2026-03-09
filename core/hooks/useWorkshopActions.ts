import React, { useCallback } from 'react';
import { useData } from '../state/DataContext';
import { useApp } from '../state/AppContext';
import * as T from '../../types';
import { generateSequenceId, saveDocument, deleteDocument } from '../db';
import { formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { calculateJobStatus } from '../utils/jobUtils';
import useToaster from '../../hooks/useToaster';

export const useWorkshopActions = (handleGenerateInvoice?: (jobId: string) => void) => {
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    const { showSuccess } = useToaster();
    
    const { 
        jobs, setJobs,
        estimates, setEstimates,
        purchaseOrders, setPurchaseOrders,
        inquiries, setInquiries,
        parts, setParts,
        businessEntities, 
        vehicles, setVehicles,
        customers
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

    const handleSaveItem = async <Type extends { id: string }>(
        setter: React.Dispatch<React.SetStateAction<Type[]>>,
        item: Type,
        collectionOverride?: string
    ) => {
        const col = collectionOverride || getCollectionName(item);

        let itemToSave: Type | null = null;
            setter(prev => {
            const index = prev.findIndex(i => i.id === item.id);
            if (index >= 0) {
                const newArr = [...prev];
                const mergedItem = { ...newArr[index], ...item };
                newArr[index] = mergedItem;
                itemToSave = mergedItem;
                return newArr;
            } else {
                itemToSave = item;
                return [...prev, item];
            }
        });
        if (itemToSave) {
            await saveDocument(col, itemToSave);
            return itemToSave;
        }
    
        return item;
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

    const handleDeletePurchaseOrder = async (purchaseOrderId: string) => {
        const poToDelete = purchaseOrders.find(p => p.id === purchaseOrderId);
        if (!poToDelete) {
            console.error("Purchase order to delete not found");
            setConfirmation({isOpen: true, title: 'Error', message: 'Could not find the purchase order to delete.', type: 'error'});
            return;
        }
    
        if (poToDelete.jobId) {
            const associatedJob = jobs.find(j => j.id === poToDelete.jobId);
            if (associatedJob) {
                const updatedPurchaseOrderIds = (associatedJob.purchaseOrderIds || []).filter(id => id !== purchaseOrderId);
                let updatedJob = { ...associatedJob, purchaseOrderIds: updatedPurchaseOrderIds };
                
                const associatedEstimate = estimates.find(e => e.id === associatedJob?.estimateId);
                if (associatedEstimate) {
                    const poLineItemIds = new Set((poToDelete.lineItems || []).map(li => li.id));
                    const updatedEstimateLineItems = (associatedEstimate.lineItems || []).map(li => {
                        if (li.purchaseOrderLineItemId && poLineItemIds.has(li.purchaseOrderLineItemId)) {
                            const { purchaseOrderLineItemId, ...rest } = li;
                            return rest;
                        }
                        return li;
                    });
                    const updatedEstimate = { ...associatedEstimate, lineItems: updatedEstimateLineItems };
                    await handleSaveItem(setEstimates, updatedEstimate, 'brooks_estimates');
                }
                
                await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
            }
        }
        
        await deleteDocument('brooks_purchaseOrders', purchaseOrderId);
        
        setPurchaseOrders(prev => prev.filter(p => p.id !== purchaseOrderId));
    
        setConfirmation({
            isOpen: true,
            title: 'Purchase Order Deleted',
            message: `Purchase Order #${purchaseOrderId} has been permanently deleted.`,
            type: 'success',
        });
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

        if (existingPO && existingPO.jobId && existingPO.status === 'Draft' && po.status === 'Draft' && existingPO.supplierId !== po.supplierId) {
            const targetPO = purchaseOrders.find(p =>
                p.jobId === existingPO.jobId &&
                p.id !== existingPO.id &&
                p.status === 'Draft' &&
                p.supplierId === po.supplierId
            );

            if (targetPO) {
                const mergedPO: T.PurchaseOrder = {
                    ...targetPO,
                    lineItems: [...targetPO.lineItems, ...existingPO.lineItems],
                };
                await handleSaveItem(setPurchaseOrders, mergedPO, 'brooks_purchaseOrders');

                await deleteDocument('brooks_purchaseOrders', existingPO.id);
                setPurchaseOrders(prev => prev.filter(p => p.id !== existingPO.id));
                
                return; 
            }
        }
        
        await handleSaveItem(setPurchaseOrders, po, 'brooks_purchaseOrders');

        if (po.partUpdates && po.partUpdates.length > 0) {
            for (const part of po.partUpdates) {
                await handleSaveItem(setParts, part, 'brooks_parts');
            }
        }
        
        for (const inq of inquiries) {
            const isLinkedToPO = inq.linkedPurchaseOrderIds?.includes(po.id);
            if (isLinkedToPO) {
                const otherInqPos = purchaseOrders.filter(p => inq.linkedPurchaseOrderIds?.includes(p.id) && p.id !== po.id);
                const allInqPos = [...otherInqPos, po];
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

        const createPOs = async (targetJobId: string, entityShortCode: string, itemsForPO: T.EstimateLineItem[]) => {
            const partItems = itemsForPO.filter(li => !li.isLabor && li.partId);
            const poIds: string[] = [];
            if (partItems.length > 0) {
                const partsBySupplier: Record<string, T.EstimateLineItem[]> = {};
                partItems.forEach(item => {
                    const partDef = parts.find(p => p.id === item.partId);
                    const sId = item.supplierId || partDef?.defaultSupplierId || 'PENDING_SUPPLIER';
                    if (!partsBySupplier[sId]) partsBySupplier[sId] = [];
                    partsBySupplier[sId].push(item);
                });

                for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                    const newPOId = await generateSequenceId('944', entityShortCode);
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
                            taxCodeId: item.taxCodeId || '',
                            jobLineItemId: item.id
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
        
                let jobToSave: T.Job | null = null;
                setJobs(prevJobs => {
                    const jobIndex = prevJobs.findIndex(j => j.id === existingJob.id);
                    if (jobIndex === -1) return prevJobs;
        
                    const job = prevJobs[jobIndex];
                    
                    const currentPOIds = new Set(job.purchaseOrderIds || []);
                    newPurchaseOrderIds.forEach(id => currentPOIds.add(id));
                    const uniquePurchaseOrderIds = Array.from(currentPOIds);
        
                    const existingLineItemIds = new Set((job.lineItems || []).map(li => li.id));
                    const newItemsFromEstimate = approvedLineItems.filter(item => !existingLineItemIds.has(item.id));
                    const updatedLineItems = [...(job.lineItems || []), ...newItemsFromEstimate];
                    
                    const newPartsStatus = (uniquePurchaseOrderIds.length > 0 && job.partsStatus !== 'Fully Received') ? 'Awaiting Order' : job.partsStatus;
        
                    const updatedJob: T.Job = {
                        ...job,
                        purchaseOrderIds: uniquePurchaseOrderIds,
                        partsStatus: newPartsStatus,
                        lineItems: updatedLineItems,
                    };
                    jobToSave = updatedJob;
                    
                    const newJobs = [...prevJobs];
                    newJobs[jobIndex] = updatedJob;
                    return newJobs;
                });
        
                if (jobToSave) {
                    await saveDocument('brooks_jobs', jobToSave);
                }
        
                const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
                if (existingInquiry) {
                    const updatedInquiry = {
                        ...existingInquiry,
                        status: 'Approved' as const,
                        linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds],
                        actionNotes: (existingInquiry.actionNotes || '') + '\n[System]: Approved and POs generated.',
                    };
                    await handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                }
                setConfirmation({ isOpen: true, title: 'Estimate Approved', message: `Supplementary work added to Job #${existingJob.id}.`, type: 'success' });
            }
        } else if (scheduledDate) {
            const isMotOnly = approvedLineItems.every(li => li.description === 'MOT');
            const includesMot = approvedLineItems.some(li => li.description === 'MOT');
            const entity = businessEntities.find(e => e.id === estimate.entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            const customer = customers.find(c => c.id === estimate.customerId);
            const vehicle = vehicles.find(v => v.id === estimate.vehicleId);

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
                    isStandalone: true,
                    vehicleRegistration: vehicle?.registration || '',
                    jobType: 'MOT',
                    lineItems: approvedLineItems,
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
                    associatedJobId: mainJobId,
                    vehicleRegistration: vehicle?.registration || '',
                    jobType: 'MOT',
                    lineItems: approvedLineItems.filter(li => li.description === 'MOT'),
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
                    associatedJobId: motJobId,
                    vehicleRegistration: vehicle?.registration || '',
                    jobType: 'Standard',
                    lineItems: otherLineItems,
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
                    purchaseOrderIds: newPurchaseOrderIds,                    
                    vehicleRegistration: vehicle?.registration || '',
                    jobType: 'Standard',
                    lineItems: approvedLineItems,
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
    
        const combinedPurchaseOrderIds = [...(job.purchaseOrderIds || []), ...linkedPOIds];
        const uniquePurchaseOrderIds = [...new Set(combinedPurchaseOrderIds)];
    
        const existingLineItemIds = new Set((job.lineItems || []).map(li => li.id));
        const newItemsFromEstimate = approvedItems.filter(item => !existingLineItemIds.has(item.id));

        const updatedJob: T.Job = {
            ...job,
            estimatedHours: (job.estimatedHours || 0) + additionalLaborHours,
            purchaseOrderIds: uniquePurchaseOrderIds,
            lineItems: [...(job.lineItems || []), ...newItemsFromEstimate],
            partsStatus: (uniquePurchaseOrderIds.length > 0) ? job.partsStatus : 'Not Required',
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
        handleDeletePurchaseOrder,
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