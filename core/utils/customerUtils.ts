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
 * Returns a formatted name for UI display.
 */
export const getCustomerDisplayName = (customer?: Customer): string => {
    if (!customer) return 'Unknown Customer';
    if (customer.isBusinessCustomer && customer.companyName) {
        return `${customer.companyName} (${customer.forename} ${customer.surname})`;
    }
    const fullName = `${customer.title || ''} ${customer.forename} ${customer.surname}`.trim();
    return fullName || 'Unnamed Customer';
};