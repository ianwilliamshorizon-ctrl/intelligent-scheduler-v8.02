import { Job, JobSegment, Estimate, PurchaseOrder, StorageLocation } from '../../types';

/**
 * Calculates the overall job status based on the status of its segments.
 * The logic prioritizes active work, then completion states, then intermediate states.
 * @param segments An array of job segments.
 * @returns The calculated overall job status.
 */
export const calculateJobStatus = (segments: JobSegment[]): Job['status'] => {
    if (!segments || segments.length === 0) return 'Unallocated';

    const activeSegments = segments.filter(s => s.status !== 'Cancelled');
    if (activeSegments.length === 0) {
        return 'Cancelled';
    }

    // 1. Is any work currently being done or paused?
    if (activeSegments.some(s => s.status === 'In Progress' || s.status === 'Paused')) {
        return 'In Progress';
    }
    
    // 2. Is all work finished and QC'd?
    if (activeSegments.every(s => s.status === 'QC Complete')) {
        return 'Complete';
    }
    
    // 3. Has all engineering work been finished?
    if (activeSegments.every(s => s.status === 'Engineer Complete' || s.status === 'QC Complete')) {
        return 'Pending QC';
    }
    
    // 4. Has *any* work been completed by an engineer, but not all?
    // This indicates the job is still in progress overall, even if no segment is *currently* active.
    if (activeSegments.some(s => s.status === 'Engineer Complete' || s.status === 'QC Complete')) {
        return 'In Progress';
    }

    // 5. Is any part of the job scheduled but not started?
    if (activeSegments.some(s => s.status === 'Allocated')) {
        return 'Allocated';
    }

    // 6. Otherwise, all segments must be Unallocated.
    return 'Unallocated';
};

/**
 * Calculates the overall parts status for a job based on its estimate and purchase orders.
 */
export const calculateJobPartsStatus = (estimate: Estimate | null, purchaseOrders: PurchaseOrder[]): string => {
    if (!estimate || !estimate.lineItems || estimate.lineItems.length === 0) return 'Not Required';

    const materialItems = estimate.lineItems.filter(li => {
        const isPart = (li.partId || li.description?.trim() || li.partNumber?.trim());
        const isPackageHeader = (li.servicePackageId && !li.isPackageComponent);
        return !li.isLabor && isPart && !isPackageHeader;
    });
    
    if (materialItems.length === 0) return 'Not Required';

    const fromStockItems = materialItems.filter(li => li.fromStock);
    const toOrderItems = materialItems.filter(li => !li.fromStock);
    
    if (toOrderItems.length === 0) return 'Fully Received';

    const allPoItems = purchaseOrders.flatMap(po => (po.lineItems || []).map(li => ({ ...li, poStatus: po.status })));
    
    const linkedItemsInfo = toOrderItems.map(li => {
        const poi = allPoItems.find(poi => 
            (li.purchaseOrderLineItemId && poi.id === li.purchaseOrderLineItemId) || 
            poi.jobLineItemId === li.id
        );
        
        if (!poi) return { id: li.id, status: 'Unordered' };
        
        if (poi.poStatus === 'Received' || poi.poStatus === 'Finalized' || (poi.receivedQuantity || 0) >= poi.quantity) {
            return { id: li.id, status: 'Received' };
        }
        if ((poi.receivedQuantity || 0) > 0 || poi.poStatus === 'Partially Received') {
            return { id: li.id, status: 'Partially Received' };
        }
        if (poi.poStatus === 'Draft') return { id: li.id, status: 'Draft' };
        if (poi.poStatus === 'Ordered') return { id: li.id, status: 'Ordered' };
        return { id: li.id, status: 'Awaiting Parts' };
    });
    
    if (linkedItemsInfo.some(i => i.status === 'Unordered')) return 'Awaiting Order';
    if (linkedItemsInfo.some(i => i.status === 'Draft')) return 'Awaiting Order';
    if (linkedItemsInfo.every(i => i.status === 'Received')) return 'Fully Received';
    if (linkedItemsInfo.some(i => i.status === 'Partially Received' || i.status === 'Received')) return 'Partially Received';
    if (linkedItemsInfo.every(i => i.status === 'Ordered')) return 'Ordered';

    return 'Awaiting Parts';
};

/**
 * Automatically applies the storage rate from a storage location to a job's line items.
 */
export const applyStorageRateToJob = (job: Job, location: StorageLocation): Job => {
    const updatedJob = { ...job };
    const lineItems = [...(updatedJob.lineItems || [])];
    
    // Check if we already have a storage line item
    const storageItemIndex = lineItems.findIndex(li => 
        (li.description || '').toLowerCase().includes('storage') && !li.isLabor
    );
    
    const rate = location.weeklyRate || 0;
    const description = `Vehicle Storage - ${location.name}`;
    
    if (storageItemIndex > -1) {
        // Update existing item
        lineItems[storageItemIndex] = {
            ...lineItems[storageItemIndex],
            unitPrice: rate,
            description: description
        };
    } else if (rate > 0) {
        // Add new item if rate > 0
        lineItems.push({
            id: `li_storage_${Date.now()}`,
            description: description,
            quantity: 1,
            unitPrice: rate,
            unitCost: 0,
            isLabor: false
        });
    }
    
    updatedJob.lineItems = lineItems;
    return updatedJob;
};