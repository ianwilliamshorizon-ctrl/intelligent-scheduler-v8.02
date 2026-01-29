import { Estimate, Invoice, RentalBooking, Job, PurchaseOrder, Purchase } from '../types';

/**
 * Helper function to find the next sequential number for a given prefix.
 */
const getNextSequence = (items: any[], entityShortCode: string, prefix: string, key: string): string => {
    if (!entityShortCode) {
        console.error(`Cannot generate ID with prefix ${prefix} because entityShortCode is missing.`);
        return 'ERROR';
    }
    const fullPrefix = `${entityShortCode.toUpperCase()}${prefix}`;
    const relevantItems = items.filter(item => item[key] && typeof item[key] === 'string' && item[key].startsWith(fullPrefix));
    
    let maxNumber = 0;
    relevantItems.forEach(item => {
        const numberPart = parseInt(item[key].substring(fullPrefix.length), 10);
        if (!isNaN(numberPart) && numberPart > maxNumber) {
            maxNumber = numberPart;
        }
    });

    const newNumber = maxNumber + 1;
    return String(newNumber).padStart(5, '0');
};

/**
 * Generates a unique sequential estimate number with an entity prefix.
 * Format: [3-letter entity code]991[5-digit sequence]
 */
export const generateEstimateNumber = (allEstimates: Estimate[], entityShortCode: string): string => {
    const prefix = '991';
    const sequence = getNextSequence(allEstimates, entityShortCode, prefix, 'estimateNumber');
    return `${entityShortCode}${prefix}${sequence}`;
};

/**
 * Generates a unique sequential job ID with an entity prefix.
 * Format: [3-letter entity code]992[5-digit sequence]
 */
export const generateJobId = (allJobs: Job[], entityShortCode: string): string => {
    const prefix = '992';
    const sequence = getNextSequence(allJobs, entityShortCode, prefix, 'id');
    return `${entityShortCode}${prefix}${sequence}`;
};


/**
 * Generates a unique sequential invoice ID with an entity prefix.
 * Format: [3-letter entity code]911[5-digit sequence]
 */
export const generateInvoiceId = (allInvoices: Invoice[], entityShortCode: string): string => {
    const prefix = '911';
    const sequence = getNextSequence(allInvoices, entityShortCode, prefix, 'id');
    return `${entityShortCode}${prefix}${sequence}`;
};

/**
 * Generates a unique sequential purchase order ID with an entity prefix.
 * Format: [3-letter entity code]944[5-digit sequence]
 */
export const generatePurchaseOrderId = (allPurchaseOrders: PurchaseOrder[], entityShortCode: string): string => {
    const prefix = '944';
    const sequence = getNextSequence(allPurchaseOrders, entityShortCode, prefix, 'id');
    return `${entityShortCode}${prefix}${sequence}`;
};

// FIX: Added missing generatePurchaseId function for legacy components.
/**
 * Generates a unique sequential purchase ID with an entity prefix.
 * Format: [3-letter entity code]945[5-digit sequence]
 */
export const generatePurchaseId = (allPurchases: Purchase[], entityShortCode: string): string => {
    const prefix = '945'; // Different from PO's 944
    const sequence = getNextSequence(allPurchases, entityShortCode, prefix, 'id');
    return `${entityShortCode}${prefix}${sequence}`;
};


/**
 * Generates a unique sequential rental booking ID starting with 'BS'.
 * It finds the highest existing number and increments it.
 * @param allBookings An array of all existing rental bookings.
 * @returns A unique rental booking ID string (e.g., "BS00001").
 */
export const generateRentalBookingId = (allBookings: RentalBooking[]): string => {
    const prefix = 'BS';
    const existingNumbers = allBookings
        .map(b => parseInt(b.id.replace(prefix, ''), 10))
        .filter(n => !isNaN(n));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    
    const newNumber = maxNumber + 1;
    
    return `${prefix}${String(newNumber).padStart(5, '0')}`;
};
