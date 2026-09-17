import { describe, it, expect, vi } from 'vitest';
import { lookupVehicleByVRM } from '../../services/vehicleLookupService';

describe('DVLA Vehicle Lookup Service - Engine Size Extraction', () => {
    it('extracts engine size (cc) from UKVD/DVLA response using EngineCapacityCc or EngineCapacity', async () => {
        // Mock global fetch for testing
        const mockApiResponse = {
            Results: {
                DvlaMake: 'PORSCHE',
                DvlaModel: '911 CARRERA S',
                YearOfManufacture: '2021',
                DateOfManufacture: '2021-03-15',
                EngineNumber: 'MA1012345',
                Vin: 'WP0ZZZ99ZMS123456',
                CurrentColour: 'Agate Grey',
                DvlaFuelType: 'Petrol',
                EngineCapacityCc: 2981,
                TransmissionType: 'Automatic',
            }
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockApiResponse)
            })
        ) as any;

        try {
            const vehicle = await lookupVehicleByVRM('VOI 59');
            expect(vehicle.make).toBe('Porsche');
            expect(vehicle.model).toBe('911 Carrera S');
            expect(vehicle.cc).toBe(2981);
            expect(vehicle.engineCapacityCc).toBe(2981);
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('extracts engine size when returned as string CylinderCapacity or EngineCapacity', async () => {
        const mockApiResponse = {
            Results: {
                Make: 'BMW',
                Model: 'M3 COMPETITION',
                YearOfManufacture: '2022',
                EngineCapacity: '2993 cc',
                Colour: 'Isle of Man Green',
            }
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockApiResponse)
            })
        ) as any;

        try {
            const vehicle = await lookupVehicleByVRM('BM22 M3C');
            expect(vehicle.cc).toBe(2993);
            expect(vehicle.engineCapacityCc).toBe(2993);
        } finally {
            global.fetch = originalFetch;
        }
    });
});
