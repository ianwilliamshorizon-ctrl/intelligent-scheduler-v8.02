
import { Vehicle } from '../types';

const API_KEY = import.meta.env.VITE_VEHICLE_DATA_GLOBAL_API_KEY;
const API_BASE_URL = 'https://api.vehicledataglobal.com/v1';

interface VehicleDataGlobalResponse {
    registration: string;
    make: string;
    model: string;
    year?: number;
    vin?: string;
    colour?: string;
    fuelType?: string;
    engineNumber?: string;
    cc?: number;
    transmissionType?: 'Manual' | 'Automatic' | 'Other';
    motExpiryDate?: string;
    imageUrl?: string;
}

export const lookupVehicleByVRM = async (vrm: string): Promise<Partial<Vehicle>> => {
    if (!API_KEY) {
        throw new Error('VITE_VEHICLE_DATA_GLOBAL_API_KEY is not set in .env');
    }

    const response = await fetch(`${API_BASE_URL}/lookup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ registration: vrm })
    });

    if (!response.ok) {
        throw new Error(`Vehicle lookup failed with status: ${response.status}`);
    }

    const data: VehicleDataGlobalResponse = await response.json();

    return {
        registration: data.registration,
        make: data.make,
        model: data.model,
        year: data.year,
        vin: data.vin,
        colour: data.colour,
        fuelType: data.fuelType,
        engineNumber: data.engineNumber,
        cc: data.cc,
        transmissionType: data.transmissionType,
        motExpiryDate: data.motExpiryDate,
        images: data.imageUrl ? [{ id: '1', dataUrl: data.imageUrl, isPrimaryDiagram: true, uploadedAt: new Date().toISOString() }] : []
    };
};

export const getVehicleImage = async (vrm: string): Promise<string | null> => {
    if (!API_KEY) {
        throw new Error('VITE_VEHICLE_DATA_GLOBAL_API_KEY is not set in .env');
    }

    const response = await fetch(`${API_BASE_URL}/image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ registration: vrm })
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    return data.imageUrl || null;
};
