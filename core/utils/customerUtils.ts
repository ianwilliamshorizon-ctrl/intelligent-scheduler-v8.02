import { Customer } from '../../types';

/**
 * Generates a unique customer ID based on their surname.
 * The format is the first 5 letters of the surname (or the whole surname if shorter),
 * followed by a 3-digit sequential number (e.g., SMITH001 or JO001).
 * @param surname The customer's surname.
 * @param allCustomers An array of all existing customers to check for uniqueness.
 * @returns A unique customer ID string.
 */
export const generateCustomerId = (surname: string, allCustomers: Customer[]): string => {
    if (!surname) {
        surname = 'CUST'; // Fallback for empty surname
    }

    // 1. Create the prefix from the surname (up to 5 chars, uppercase).
    const prefix = surname.substring(0, 5).toUpperCase();

    // 2. Find all customers with the same prefix.
    const matchingCustomers = allCustomers.filter(c => c.id && c.id.startsWith(prefix));

    // 3. Find the highest existing number for that prefix.
    let maxNumber = 0;
    matchingCustomers.forEach(c => {
        // The numeric part starts after the prefix.
        const numberPartStr = c.id.substring(prefix.length);
        const numberPart = parseInt(numberPartStr, 10);
        if (!isNaN(numberPart) && numberPart > maxNumber) {
            maxNumber = numberPart;
        }
    });

    // 4. The new number is the highest existing number + 1.
    const newNumber = maxNumber + 1;

    // 5. Format the new number as a 3-digit string with leading zeros.
    const formattedNumber = String(newNumber).padStart(3, '0');

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
