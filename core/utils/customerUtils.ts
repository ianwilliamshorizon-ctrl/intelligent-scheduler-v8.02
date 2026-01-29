
import { Customer } from '../../types';

/**
 * Generates a unique customer ID based on their surname.
 * The format is the first 4 letters of the surname (uppercase)
 * followed by a 4-digit number (e.g., SMIT0001).
 * @param surname The customer's surname.
 * @param allCustomers An array of all existing customers to check for uniqueness.
 * @returns A unique customer ID string.
 */
export const generateCustomerId = (surname: string, allCustomers: Customer[]): string => {
    if (!surname) {
        // Fallback for empty surname
        surname = 'CUST';
    }
    // 1. Create the 4-character prefix, uppercase, padded with 'X' if too short.
    const prefix = surname.substring(0, 4).toUpperCase().padEnd(4, 'X');

    // 2. Find all customers with the same prefix.
    const matchingCustomers = allCustomers.filter(c => c.id.startsWith(prefix));

    // 3. Find the highest existing number for that prefix.
    let maxNumber = 0;
    matchingCustomers.forEach(c => {
        const numberPart = parseInt(c.id.substring(4), 10);
        if (!isNaN(numberPart) && numberPart > maxNumber) {
            maxNumber = numberPart;
        }
    });

    // 4. The new number is the highest existing number + 1.
    const newNumber = maxNumber + 1;

    // 5. Format the new number as a 4-digit string with leading zeros.
    const formattedNumber = String(newNumber).padStart(4, '0');

    // 6. Combine and return.
    return `${prefix}${formattedNumber}`;
};

export const getCustomerDisplayName = (customer?: Customer): string => {
    if (!customer) return 'Unknown Customer';
    if (customer.isBusinessCustomer && customer.companyName) {
        return `${customer.companyName} (${customer.forename} ${customer.surname})`;
    }
    return `${customer.title || ''} ${customer.forename} ${customer.surname}`.trim();
};
