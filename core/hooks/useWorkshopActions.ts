import React, { useCallback } from 'react';
import { useData } from '../state/DataContext';
import { useApp } from '../state/AppContext';
import * as T from '../../types';
import { generateSequenceId, saveDocument, deleteDocument } from '../db';
import { formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { calculateJobStatus, calculateJobPartsStatus } from '../utils/jobUtils';
import useToaster from '../../hooks/useToaster';

const syncingJobs = new Set<string>();

export const useWorkshopActions = (handleGenerateInvoice?: (jobId: string) => void) => {
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    const { showSuccess, showError } = useToaster();
    
    const { 
        jobs, setJobs,
        estimates, setEstimates,
        purchaseOrders, setPurchaseOrders,
        inquiries, setInquiries,
        parts, setParts,
        businessEntities, 
        vehicles, setVehicles,
        customers, servicePackages
    } = data;

    const resolveSupplierId = useCallback((li: T.EstimateLineItem) => {
        // 1. Explicitly set on line item
        if (li.supplierId && li.supplierId !== '') return li.supplierId;

        // 2. Default on Part record
        const part = parts.find(p => p.id === li.partId || (p.partNumber === li.partNumber && p.partNumber));
        if (part?.defaultSupplierId) return part.defaultSupplierId;

        // 3. From original Service Package definition
        if (li.servicePackageId) {
            const pkg = servicePackages.find(p => p.id === li.servicePackageId);
            const costItem = pkg?.costItems?.find(ci => 
                (ci.partNumber === li.partNumber && li.partNumber) || 
                (ci.description === li.description && li.description)
            );
            if (costItem?.supplierId) return costItem.supplierId;
        }

        return null;
    }, [parts, servicePackages]);

    const getCollectionName = (item: any): string => {
        if ('estimateNumber' in item) return 'brooks_estimates';
        if ('vehicleRegistrationRef' in item || 'supplierId' in item || 'purchaseOrderLineItemId' in item) return 'brooks_purchaseOrders';
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

        // 1. Update local state immediately for responsiveness
        setter(prev => {
            const index = prev.findIndex(i => i.id === item.id);
            if (index >= 0) {
                const newArr = [...prev];
                newArr[index] = { ...newArr[index], ...item };
                return newArr;
            } else {
                return [...prev, item];
            }
        });

        // 2. Persist to Firestore (Independent of React batching)
        try {
            await saveDocument(col, item);
            return item;
        } catch (error) {
            console.error(`[handleSaveItem Error] Failed to persist to ${col}:`, error);
            throw error;
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
             // To give hours back to the scheduler, we must unallocate all segments
             const unallocatedSegments = (job.segments || []).map(s => ({
                 ...s,
                 status: 'Unallocated' as const,
                 engineerId: null,
                 allocatedLift: null,
                 scheduledStartSegment: null,
                 date: null
             }));

             // If vehicle is already on site, move to Awaiting Collection since job is cancelled
             const nextVehicleStatus = job.vehicleStatus === 'On Site' ? 'Awaiting Collection' : job.vehicleStatus;

             const updatedJob: T.Job = { 
                 ...job, 
                 status: 'Cancelled',
                 segments: unallocatedSegments,
                 vehicleStatus: nextVehicleStatus
             };
             
             await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
             
             setConfirmation({
                 isOpen: true,
                 title: 'Job Cancelled',
                 message: job.vehicleStatus === 'On Site' 
                    ? `Job #${jobId} cancelled. Vehicle moved to 'Awaiting Collection' since it was on site.`
                    : `Job #${jobId} has been cancelled and its scheduled hours have been released.`,
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
    
        showSuccess(`Purchase Order #${purchaseOrderId} has been permanently deleted.`);
    };

    const updateLinkedInquiryStatus = async (estimateId: string, newStatus: T.Inquiry['status'], extraUpdates: Partial<T.Inquiry> = {}) => {
        const targetInquiry = inquiries.find(i => i.linkedEstimateId === estimateId && i.status !== 'Closed');
        if (targetInquiry) {
            await handleSaveItem(setInquiries, { ...targetInquiry, status: newStatus, ...extraUpdates } as T.Inquiry);
        }
    };

    const getMaxPONumber = () => {
        const poNumbers = (purchaseOrders || []).map(po => {
            // Match digits from the end of the ID
            const numPart = po.id.match(/\d+$/);
            return numPart ? parseInt(numPart[0], 10) : 0;
        });
        const currentMax = Math.max(0, ...poNumbers);
        // Ensure we at least start from a reasonable floor if collection is empty
        return currentMax > 0 ? currentMax : 1000; 
    };

    const syncPurchaseOrdersFromEstimate = async (estimate: T.Estimate, options?: { forceNew?: boolean }) => {
        if (!estimate || !estimate.jobId) {
            console.warn("⚠️ syncPurchaseOrdersFromEstimate: Missing estimate or jobId", estimate);
            return;
        }

        if (syncingJobs.has(estimate.jobId)) {
            console.log(`⏩ Sync already in progress for job ${estimate.jobId}, skipping.`);
            return;
        }

        syncingJobs.add(estimate.jobId);
        console.log(`🔄 Starting PO Sync for Job: ${estimate.jobId} (ForceNew: ${!!options?.forceNew})`);

        try {
            const job = jobs.find(j => j.id === estimate.jobId);
            const poIds = job?.purchaseOrderIds || [];
            
            // 1. Filter items that need ordering
            const activeItemsForPO = (estimate.lineItems || []).filter(li => {
                // Labor exclusion
                if (li.isLabor || li.type === 'labor' || li.description?.toLowerCase().includes('labour')) return false;
                
                // Stock exclusion: Check both the item flag and the part's current status
                const part = parts.find(p => p.id === li.partId || (p.partNumber === li.partNumber && p.partNumber));
                const isActuallyStock = li.fromStock || (part?.isStockItem && part.stockQuantity > 0);
                if (isActuallyStock) return false;

                // User requirement: Do not re-order items that are already received
                if ((li.receivedQuantity || 0) > 0) return false;

                // User requirement: Do not re-order if already linked to an active (Ordered/Received) PO
                if (li.purchaseOrderLineItemId) {
                    const linkedPO = purchaseOrders.find(po => po.lineItems?.some(poi => poi.id === li.purchaseOrderLineItemId));
                    if (linkedPO && linkedPO.status !== 'Draft' && linkedPO.status !== 'Cancelled') return false;
                }

                // Structure: Only package components or standalone items
                if (li.servicePackageId && !li.isPackageComponent) return false;

                return true;
            });

            console.log(`📊 Found ${activeItemsForPO.length} items candidate for PO.`);

            // 2. Map to keep track of POs we are using/creating in this sync session
            const sessionPOsBySupplier = new Map<string, T.PurchaseOrder>();
            let poChanged = false;

            // 3. Get existing PO pool ONLY if not forcing new
            const existingLinkedPOs = !options?.forceNew 
                ? purchaseOrders.filter(po => 
                    (po.jobId === estimate.jobId || poIds.includes(po.id)) && 
                    po.status === 'Draft'
                )
                : [];

            const entityId = estimate.entityId || job?.entityId;
            const entity = businessEntities.find(e => e.id === entityId);
            const entityShortCode = (entity?.shortCode || 'UNK').toUpperCase();
            const vehicle = vehicles.find(v => v.id === estimate.vehicleId);

            for (const li of activeItemsForPO) {
                const resolvedSupplierId = resolveSupplierId(li);
                const sIdKey = (resolvedSupplierId && resolvedSupplierId !== '') ? resolvedSupplierId : 'PENDING_SUPPLIER';
                
                // If we are forcing new POs and it was linked to a Draft PO (which we've filtered for above), 
                // clear it to ensure a fresh PO is created but only for those that need it
                if (options?.forceNew) li.purchaseOrderLineItemId = undefined;

                let targetPO: T.PurchaseOrder | null = null;

                // A. Check our session map first (to bundle items for same supplier together in one go)
                targetPO = sessionPOsBySupplier.get(sIdKey) || null;

                // B. If not in session map and not forcing new, look in existing POs
                if (!targetPO && !options?.forceNew) {
                    targetPO = existingLinkedPOs.find(po => {
                        const poSupId = po.supplierId || 'PENDING_SUPPLIER';
                        return poSupId === sIdKey;
                    }) || null;
                    
                    if (targetPO) sessionPOsBySupplier.set(sIdKey, targetPO);
                }

                if (targetPO) {
                    // C. Add or update line item in target PO
                    const poiIndex = (targetPO.lineItems || []).findIndex(poi => 
                        (li.purchaseOrderLineItemId && poi.id === li.purchaseOrderLineItemId) || 
                        poi.jobLineItemId === li.id
                    );

                    const newPoiData = {
                        id: li.purchaseOrderLineItemId || crypto.randomUUID(),
                        jobLineItemId: li.id,
                        description: li.description || '',
                        partNumber: li.partNumber || '',
                        quantity: li.quantity,
                        unitPrice: li.unitCost || 0,
                        receivedQuantity: li.receivedQuantity || 0,
                        taxCodeId: li.taxCodeId || ''
                    };

                    if (poiIndex !== -1) {
                        const existingPoi = targetPO.lineItems[poiIndex];
                        if (JSON.stringify(existingPoi) !== JSON.stringify(newPoiData)) {
                            targetPO.lineItems[poiIndex] = newPoiData;
                            poChanged = true;
                        }
                    } else {
                        if (!targetPO.lineItems) targetPO.lineItems = [];
                        targetPO.lineItems.push(newPoiData);
                        li.purchaseOrderLineItemId = newPoiData.id;
                        poChanged = true;
                    }
                    
                    if (targetPO.jobId !== estimate.jobId) {
                        targetPO.jobId = estimate.jobId;
                        poChanged = true;
                    }
                } else {
                    // D. Create New PO for this supplier
                    const nextNum = getMaxPONumber() + 1;
                    const entityPrefix = entityShortCode || 'BRK';
                    
                    // Logic to handle the 944 sequence correctly
                    // If nextNum already looks like 944XXXXXX (from existing data), use it as is.
                    // Otherwise (e.g. starting fresh), prepend 944.
                    const finalNumStr = nextNum >= 944000000 ? String(nextNum) : `944${String(nextNum).padStart(6, '0')}`;
                    const newPOId = `${entityPrefix}${finalNumStr}`;
                    
                    const newPoiId = crypto.randomUUID();
                    const newPO: T.PurchaseOrder = { 
                        id: newPOId, 
                        entityId: entityId, 
                        supplierId: sIdKey === 'PENDING_SUPPLIER' ? '' : sIdKey, 
                        vehicleRegistrationRef: vehicle?.registration || 'N/A', 
                        orderDate: formatDate(new Date()), 
                        status: 'Draft', 
                        jobId: estimate.jobId, 
                        createdByUserId: currentUser.id, 
                        lineItems: [{ 
                            id: newPoiId, 
                            jobLineItemId: li.id, 
                            description: li.description || '', 
                            partNumber: li.partNumber || '', 
                            quantity: li.quantity, 
                            unitPrice: li.unitCost || 0, 
                            receivedQuantity: li.receivedQuantity || 0, 
                            taxCodeId: li.taxCodeId || '' 
                        }] 
                    };
                    li.purchaseOrderLineItemId = newPoiId;
                    sessionPOsBySupplier.set(sIdKey, newPO);
                    poChanged = true;
                    console.log(`🆕 Created New Session PO: ${newPO.id} for supplier ${sIdKey}`);
                }
            }

            // 4. Save all session POs that were adjusted
            if (poChanged || sessionPOsBySupplier.size > 0) {
                const allActivePOIds = new Set(poIds);
                
                for (const po of sessionPOsBySupplier.values()) {
                    await handleSaveItem(setPurchaseOrders, po, 'brooks_purchaseOrders');
                    allActivePOIds.add(po.id);
                }

                // 5. Update Job & Estimate
                const currentJob = jobs.find(j => j.id === estimate.jobId);
                if (currentJob) {
                    const updatedJob = { ...currentJob, purchaseOrderIds: Array.from(allActivePOIds) };
                    await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
                }
                await handleSaveItem(setEstimates, estimate, 'brooks_estimates');
                console.log("✅ PO Sync Complete.");
            } else {
                console.log("ℹ️ No changes detected in PO synchronization.");
            }
        } catch (err) {
            console.error("❌ PO Sync Failed:", err);
            showError("An error occurred while synchronizing purchase orders.");
        } finally {
            syncingJobs.delete(estimate.jobId);
        }
    };

    const handleSaveEstimate = async (estimate: T.Estimate) => {
        const isNew = !estimates.some(e => e.id === estimate.id);
        
        if (estimate.jobId) {
            await syncPurchaseOrdersFromEstimate(estimate);
        }

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
                status: 'New',
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

    const handleSavePurchaseOrder = async (po: T.PurchaseOrder, updatedParts?: T.Part[], updatedEstimate?: T.Estimate) => {
        // 1. Save the PO
        await handleSaveItem(setPurchaseOrders, po);
    
        // 2. Refresh other locally changed records
        if (updatedParts && updatedParts.length > 0) {
            for (const part of updatedParts) {
                await handleSaveItem(setParts, part);
            }
        }
    
        if (updatedEstimate) {
            await handleSaveItem(setEstimates, updatedEstimate);
        }

        // 3. BIDIRECTIONAL: Sync the overall Job parts status
        if (po.jobId) {
            const job = jobs.find(j => j.id === po.jobId);
            if (job) {
                const estimate = updatedEstimate || estimates.find(e => e.id === job.estimateId);
                // We need the absolute latest PO list to calculate accurately
                const latestPOs = purchaseOrders.map(p => p.id === po.id ? po : p);
                if (!purchaseOrders.some(p => p.id === po.id)) latestPOs.push(po);

                const newPartsStatus = calculateJobPartsStatus(estimate || null, latestPOs);
                
                if (job.partsStatus !== newPartsStatus) {
                    const updatedJob = { ...job, partsStatus: newPartsStatus };
                    await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
                }
            }
        }
    };

    const handleApproveEstimate = async (estimate: T.Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => {
        // --- 1. Initialize local state to avoid redeclaration errors ---
        let allGeneratedPOIds: string[] = [];

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
        // Unified PO creation helper for this hook
        const createPOs = async (targetJobId: string, entityShortCode: string, itemsForPO: T.EstimateLineItem[], options?: { forceNew?: boolean }) => {
            const partItems = itemsForPO.filter(li => 
                !li.fromStock &&
                !li.isLabor && 
                li.type !== 'labor' &&
                !li.description?.toLowerCase().includes('labour') &&
                (!li.servicePackageId || li.isPackageComponent === true)
            );
            const poIds: string[] = [];
            if (partItems.length > 0) {
                const partsBySupplier: Record<string, T.EstimateLineItem[]> = {};
                partItems.forEach(item => {
                    const resolvedSupplierId = resolveSupplierId(item);
                    const sId = resolvedSupplierId || 'PENDING_SUPPLIER';
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
                    await saveDocument('brooks_purchaseOrders', newPO);
                    poIds.push(newPOId);
                }
            }
            return poIds;
        };

        if (estimate.jobId && !scheduledDate) {
            const existingJob = jobs.find(j => j.id === estimate.jobId);
            if (existingJob) {
                const entity = businessEntities.find(e => e.id === existingJob.entityId);
                allGeneratedPOIds = await createPOs(existingJob.id, entity?.shortCode || 'UNK', approvedLineItems);
                
                let jobToSave: T.Job | null = null;
                setJobs(prevJobs => {
                    const jobIndex = prevJobs.findIndex(j => j.id === existingJob.id);
                    if (jobIndex === -1) return prevJobs;
        
                    const job = prevJobs[jobIndex];
                    
                    const currentPOIds = new Set(job.purchaseOrderIds || []);
                    allGeneratedPOIds.forEach(id => currentPOIds.add(id));
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
                        linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...allGeneratedPOIds],
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
                    segments: [{ id: crypto.randomUUID(), description: 'MOT', segmentId: crypto.randomUUID(), date: scheduledDate, duration: 1, status: 'Unallocated', allocatedLift: 'MOT', scheduledStartSegment: null, engineerId: null }], 
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
                    segments: [{ id: crypto.randomUUID(), description: 'MOT', segmentId: crypto.randomUUID(), date: scheduledDate, duration: 1, status: 'Unallocated', allocatedLift: 'MOT', scheduledStartSegment: null, engineerId: null }],
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

                // Update PO Tracker
                allGeneratedPOIds = await createPOs(mainJobId, entityShortCode, otherLineItems);
                
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
                    partsStatus: allGeneratedPOIds.length > 0 ? 'Awaiting Order' : 'Not Required',
                    purchaseOrderIds: allGeneratedPOIds,
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
                // Update PO Tracker
                allGeneratedPOIds = await createPOs(newJobId, entityShortCode, approvedLineItems);
                
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
                    partsStatus: allGeneratedPOIds.length > 0 ? 'Awaiting Order' : 'Not Required', 
                    purchaseOrderIds: allGeneratedPOIds,                    
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
                  await handleSaveItem(setInquiries, { 
                      ...existingInquiry, 
                      status: 'Approved', 
                      linkedJobId: updatedEstimate.jobId,
                      linkedPurchaseOrderIds: [...(existingInquiry.linkedPurchaseOrderIds || []), ...allGeneratedPOIds]
                  }, 'brooks_inquiries');
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
                    id: crypto.randomUUID(),
                    description: 'Supplementary Work',
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
                ? { ...s, status: 'QC Complete' as const, engineerCompletedAt: new Date().toISOString(), qcCompletedByUserId: currentUser.id } 
                : s
        );

        const newStatus = calculateJobStatus(newSegments);
        const updatedJob = { ...job, segments: newSegments, status: newStatus } as T.Job;
        await handleSaveItem(setJobs, updatedJob, 'brooks_jobs');

        if (job.associatedJobId) {
            const associatedMOT = jobs.find(j => j.id === job.associatedJobId && j.jobType === 'MOT');
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
                const associatedMOT = jobs.find(j => j.id === job.associatedJobId && j.jobType === 'MOT');
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
        updateLinkedInquiryStatus,
        syncPurchaseOrdersFromEstimate
    };
};