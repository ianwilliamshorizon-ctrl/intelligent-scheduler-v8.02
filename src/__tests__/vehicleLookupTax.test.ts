import { describe, it, expect, vi } from 'vitest';
import { lookupVehicleByVRM } from '../../services/vehicleLookupService';

describe('DVLA Vehicle Lookup Service - Tax Due Date & Status Extraction', () => {
    it('extracts taxDueDate and taxStatus from UKVD/DVLA response', async () => {
        const mockApiResponse = {
            Results: {
                DvlaMake: 'VOLKSWAGEN',
                DvlaModel: 'TRANSPORTER',
                YearOfManufacture: '2019',
                TaxDueDate: '2026-10-01',
                TaxStatus: 'Taxed',
                EngineCapacityCc: 1968,
                CurrentColour: 'White',
            }
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockApiResponse)
            })
        ) as any;

        try {
            const vehicle = await lookupVehicleByVRM('GN19 KBV');
            expect(vehicle.make).toBe('Volkswagen');
            expect(vehicle.model).toBe('Transporter');
            expect(vehicle.taxDueDate).toBe('2026-10-01');
            expect(vehicle.taxStatus).toBe('Taxed');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('extracts alternative tax expiry field names (e.g. DateOfTaxExpiry or TaxExpiryDate)', async () => {
        const mockApiResponse = {
            Results: {
                Make: 'FORD',
                Model: 'TRANSIT',
                DateOfTaxExpiry: '2026-11-15T00:00:00',
                VehicleTaxStatus: 'SORN',
            }
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockApiResponse)
            })
        ) as any;

        try {
            const vehicle = await lookupVehicleByVRM('TR12 ABC');
            expect(vehicle.taxDueDate).toBe('2026-11-15');
            expect(vehicle.taxStatus).toBe('Sorn');
        } finally {
            global.fetch = originalFetch;
        }
    });
});
