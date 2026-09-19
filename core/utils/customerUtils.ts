import { Customer } from '../../types';

/**
 * Generates a unified search string for Firestore/Local filtering.
 * Concatenates key fields into a single lowercase string.
 */
export const generateCustomerSearchField = (customer: Partial<Customer>): string => {
    return [
        customer.forename,
        customer.surname,
        customer.id,
        customer.mobile,
        customer.phone,
        customer.companyName,
        customer.postcode
    ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .trim();
};

/**
 * Generates a unique customer ID based on their surname.
 * Format: PREFIX + 4-digit sequential number (e.g., SMITH0001).
 */
export const generateCustomerId = (surname: string, allCustomers: Customer[]): string => {
    if (!surname) {
        surname = 'CUST'; 
    }

    // 1. Create the prefix (up to 4 chars to allow for 4-digit numbers in a compact ID).
    const prefix = surname.substring(0, 4).toUpperCase();

    // 2. Find all customers with the same prefix.
    const matchingCustomers = allCustomers.filter(c => c.id && c.id.startsWith(prefix));

    // 3. Find the highest existing number for that prefix.
    let maxNumber = 0;
    matchingCustomers.forEach(c => {
        // Extract numeric part regardless of prefix length
        const numberPartStr = c.id.replace(prefix, '');
        const numberPart = parseInt(numberPartStr, 10);
        if (!isNaN(numberPart) && numberPart > maxNumber) {
            maxNumber = numberPart;
        }
    });

    // 4. Increment and format as 4 digits (e.g., 0001) to match your example "CART0001"
    const newNumber = maxNumber + 1;
    const formattedNumber = String(newNumber).padStart(4, '0');

    return `${prefix}${formattedNumber}`;
};

/**
 * Detects if a string resembles a street address line (starts with number/flat/unit or contains street suffixes)
 */
export const isLikelyStreetAddress = (str?: string): boolean => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed) return false;
    // Starts with number (e.g. "23 Warsash Road", "10A High Street", "148 Church Road")
    if (/^\d+[A-Za-z]?\s+/i.test(trimmed)) return true;
    // Starts with Flat, Unit, Suite, House, Cottage, etc.
    if (/^(flat|unit|suite|apartment|apt|house|cottage|room|plot|building|floor)\b/i.test(trimmed)) return true;
    // Contains common road/street keywords
    if (/\b(road|street|avenue|ave|lane|drive|crescent|cres|gardens|gdn|close|cl|way|terrace|walk|court|ct|place|pl|hill|grove|rise|mews|row|parade|wharf)\b/i.test(trimmed)) return true;
    return false;
};

/**
 * Normalizes customer address and company fields, resolving legacy lowercase fields
 * (addressline1, addressline2, companyname) and misallocated city/address values.
 */
export const normalizeCustomer = <T extends Partial<Customer>>(raw: T): T & Customer => {
    if (!raw || typeof raw !== 'object') return raw as any;

    let addressLine1 = String(raw.addressLine1 || (raw as any).addressline1 || (raw as any).address || '').trim();
    let addressLine2 = String(raw.addressLine2 || (raw as any).addressline2 || '').trim();
    let city = String(raw.city || '').trim();
    let county = String(raw.county || '').trim();
    let postcode = String(raw.postcode || '').trim().toUpperCase();
    let companyName = String(raw.companyName || (raw as any).companyname || '').trim();

    // If addressLine1 is empty but city looks like a street address, promote city to addressLine1
    if (!addressLine1 && isLikelyStreetAddress(city)) {
        addressLine1 = city;
        city = addressLine2 && !isLikelyStreetAddress(addressLine2) ? addressLine2 : '';
        if (city === addressLine2) {
            addressLine2 = '';
        }
    }

    return {
        ...raw,
        addressLine1,
        addressLine2,
        city,
        county,
        postcode,
        companyName,
        // Also keep lowercase aliases synced for two-way legacy compatibility
        addressline1: addressLine1,
        addressline2: addressLine2,
        companyname: companyName,
    } as T & Customer;
};

/**
 * Returns a formatted name for UI display.
 */
export const getCustomerDisplayName = (customer?: Customer): string => {
    if (!customer) return 'Unknown Customer';
    const norm = normalizeCustomer(customer);
    if (norm.isBusinessCustomer && norm.companyName) {
        const contactName = `${norm.forename || ''} ${norm.surname || ''}`.trim();
        return contactName ? `${norm.companyName} (${contactName})` : norm.companyName;
    }
    const fullName = `${norm.title || ''} ${norm.forename || ''} ${norm.surname || ''}`.replace(/\s+/g, ' ').trim();
    return fullName || 'Unnamed Customer';
};