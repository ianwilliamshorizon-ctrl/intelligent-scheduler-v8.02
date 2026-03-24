import { Job, JobSegment, Estimate, PurchaseOrder } from '../../types';

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

    // 1. Identify "Material Line Items" that actually require a part
    // Skip Labor, Skip items with no identification, Skip Service Package headers
    const materialItems = estimate.lineItems.filter(li => {
        const isPart = (li.partId || li.description?.trim() || li.partNumber?.trim());
        const isPackageHeader = (li.servicePackageId && !li.isPackageComponent);
        return !li.isLabor && isPart && !isPackageHeader;
    });
    
    if (materialItems.length === 0) return 'Not Required';

    // 2. Separate into Stock items and Ordered items
    const fromStockItems = materialItems.filter(li => li.fromStock);
    const toOrderItems = materialItems.filter(li => !li.fromStock);
    
    if (toOrderItems.length === 0) return 'Fully Received'; // All from stock

    // 3. Check for Unordered Items
    const unorderedItems = toOrderItems.filter(li => !li.purchaseOrderLineItemId);
    
    // Check if linked PO line items actually exist (cleaning broken links on the fly)
    const allPoItems = purchaseOrders.flatMap(po => (po.lineItems || []).map(li => ({ ...li, poStatus: po.status })));
    
    const linkedItems = toOrderItems.filter(li => 
        li.purchaseOrderLineItemId && allPoItems.some(poi => poi.id === li.purchaseOrderLineItemId && poi.poStatus !== 'Cancelled')
    );
    
    const actuallyUnordered = toOrderItems.filter(li => 
        !li.purchaseOrderLineItemId || !allPoItems.some(poi => poi.id === li.purchaseOrderLineItemId && poi.poStatus !== 'Cancelled')
    );

    if (actuallyUnordered.length > 0) return 'Awaiting Order';

    // 4. Check Receipt Status of Linked Items
    const statusMap = linkedItems.map(li => {
        const poi = allPoItems.find(p => p.id === li.purchaseOrderLineItemId);
        if (!poi) return 'Awaiting Order';
        
        if (poi.poStatus === 'Received' || poi.poStatus === 'Finalized' || (poi.receivedQuantity || 0) >= poi.quantity) {
            return 'Received';
        }
        if ((poi.receivedQuantity || 0) > 0 || poi.poStatus === 'Partially Received') {
            return 'Partially Received';
        }
        if (poi.poStatus === 'Draft') return 'Draft';
        if (poi.poStatus === 'Ordered') return 'Ordered';
        return 'Awaiting Parts';
    });

    if (statusMap.some(s => s === 'Draft')) return 'Awaiting Order';
    if (statusMap.every(s => s === 'Received')) return 'Fully Received';
    if (statusMap.some(s => s === 'Partially Received' || s === 'Received')) return 'Partially Received';
    if (statusMap.every(s => s === 'Ordered')) return 'Ordered';

    return 'Awaiting Parts';
};