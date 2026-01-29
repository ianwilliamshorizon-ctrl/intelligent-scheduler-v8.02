

export interface AddressDetails {
    addressLine1: string;
    addressLine2: string;
    city: string;
}

// Mock database of Postcodes
const postcodeDatabase: { [key: string]: AddressDetails } = {
    'RG213AA': { addressLine1: '123 Oak Lane', addressLine2: '', city: 'Basingstoke' },
    'RG11BB': { addressLine1: '45 Maple Drive', addressLine2: 'Apt 2', city: 'Reading' },
    'SO143AJ': { addressLine1: 'Brookspeed', addressLine2: '14-15 Test Lane', city: 'Southampton' },
    'SW1A0AA': { addressLine1: 'House of Commons', addressLine2: '', city: 'London' },
};

/**
 * Simulates calling an external API to look up an address by postcode.
 * @param postcode The postcode to look up.
 * @returns A promise that resolves with address details or rejects if not found.
 */
export const lookupAddressByPostcode = (postcode: string): Promise<AddressDetails> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const upperPostcode = postcode.toUpperCase().replace(/\s/g, ''); // Normalize postcode
            if (postcodeDatabase[upperPostcode]) {
                resolve(postcodeDatabase[upperPostcode]);
            } else {
                reject(new Error(`Address for postcode "${postcode}" not found.`));
            }
        }, 1000); // Simulate network delay
    });
};