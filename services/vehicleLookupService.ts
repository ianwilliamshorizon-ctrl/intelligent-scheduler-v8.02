
export interface VehicleDetails {
    make: string;
    model: string; 
    colour?: string;
    fuelType?: string;
    engineCapacity?: number;
    motExpiryDate?: string;
    yearOfManufacture?: number;
    monthOfFirstRegistration?: string;
    taxStatus?: string;
    taxDueDate?: string;
}

// Placeholder mock database
const mockVehicleDatabase: { [key: string]: VehicleDetails } = {
    'REG456': { make: 'Porsche', model: '911 GT3', colour: 'Blue', fuelType: 'Petrol', engineCapacity: 3996 },
    'REG123': { make: 'Ford', model: 'Transit', colour: 'White', fuelType: 'Diesel', engineCapacity: 1995 },
    'REG789': { make: 'Audi', model: 'RS6', colour: 'Grey', fuelType: 'Petrol', engineCapacity: 3993 },
    'WP19WML': { make: 'Volkswagen', model: 'Golf R', colour: 'Blue', fuelType: 'Petrol', engineCapacity: 1984 },
};

/**
 * Placeholder function to bypass DVLA vehicle lookup.
 * Returns mock data for specific VRMs or an empty object.
 * @param vrm The Vehicle Registration Mark (number plate).
 * @returns A promise that resolves with vehicle details.
 */
export const lookupVehicleByVRM = async (vrm: string): Promise<VehicleDetails> => {
    const registrationNumber = vrm.replace(/\s/g, '').toUpperCase();
    console.log(`DVLA lookup is bypassed. Using placeholder for ${registrationNumber}.`);

    return new Promise((resolve) => {
        setTimeout(() => {
            if (mockVehicleDatabase[registrationNumber]) {
                console.log(`Found mock data for ${registrationNumber}.`);
                resolve(mockVehicleDatabase[registrationNumber]);
            } else {
                console.log(`No mock data for ${registrationNumber}, returning empty placeholder.`);
                resolve({ 
                    make: '', 
                    model: '',
                    colour: '',
                    fuelType: '',
                    engineCapacity: 0,
                    motExpiryDate: '',
                    yearOfManufacture: undefined,
                    monthOfFirstRegistration: '',
                    taxStatus: '',
                    taxDueDate: '',
                });
            }
        }, 500); // Simulate a short delay
    });
};
