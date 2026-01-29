

export interface VehicleDetails {
    make: string;
    model: string; // Note: DVLA API does not provide the specific model variant.
    colour?: string;
    fuelType?: string;
    engineCapacity?: number;
    motExpiryDate?: string;
    yearOfManufacture?: number;
    monthOfFirstRegistration?: string;
    taxStatus?: string;
    taxDueDate?: string;
}

// Fallback mock database for demo purposes if API key is missing
const mockVehicleDatabase: { [key: string]: VehicleDetails } = {
    'REG456': { make: 'Porsche', model: '911 GT3', colour: 'Blue', fuelType: 'Petrol', engineCapacity: 3996 },
    'REG123': { make: 'Ford', model: 'Transit', colour: 'White', fuelType: 'Diesel', engineCapacity: 1995 },
    'REG789': { make: 'Audi', model: 'RS6', colour: 'Grey', fuelType: 'Petrol', engineCapacity: 3993 },
    'WP19WML': { make: 'Volkswagen', model: 'Golf R', colour: 'Blue', fuelType: 'Petrol', engineCapacity: 1984 },
};

const getApiKey = () => {
    try {
        // @ts-ignore
        return (typeof process !== 'undefined' && process.env) ? process.env.DVLA_API_KEY : undefined;
    } catch (e) {
        return undefined;
    }
};

/**
 * Calls the DVLA Vehicle Enquiry API to look up vehicle details by VRM.
 * @param vrm The Vehicle Registration Mark (number plate).
 * @returns A promise that resolves with vehicle details.
 */
export const lookupVehicleByVRM = async (vrm: string): Promise<VehicleDetails> => {
    const registrationNumber = vrm.replace(/\s/g, '').toUpperCase();
    const apiKey = getApiKey();

    // Use mock if no API key is configured to prevent crashing in demo/preview environments
    if (!apiKey) {
        console.warn("DVLA_API_KEY not set. Using mock data fallback.");
        return new Promise((resolve) => {
            setTimeout(() => {
                if (mockVehicleDatabase[registrationNumber]) {
                    resolve(mockVehicleDatabase[registrationNumber]);
                } else {
                    // Simulate a generic success for unknown vehicles in mock mode
                    resolve({ 
                        make: '', 
                        model: '',
                        colour: '',
                        fuelType: '',
                        engineCapacity: 0 
                    });
                }
            }, 1000);
        });
    }

    try {
        const response = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ registrationNumber })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 404) {
                throw new Error(`Vehicle with registration "${vrm}" not found.`);
            }
            throw new Error(errorData.title || `DVLA API Error: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            make: data.make,
            model: '', // DVLA API does not provide specific model variants
            colour: data.artColour, 
            fuelType: data.fuelType,
            engineCapacity: data.engineCapacity,
            motExpiryDate: data.motExpiryDate,
            yearOfManufacture: data.yearOfManufacture,
            monthOfFirstRegistration: data.monthOfFirstRegistration,
            taxStatus: data.taxStatus,
            taxDueDate: data.taxDueDate,
        };

    } catch (error: any) {
        console.error("DVLA Lookup Error:", error);
        throw new Error(error.message || "Failed to look up vehicle details.");
    }
};