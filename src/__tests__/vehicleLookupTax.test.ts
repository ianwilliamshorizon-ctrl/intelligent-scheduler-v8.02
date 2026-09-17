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

    it('parses UK date format DD/MM/YYYY and YYYY-MM correctly into ISO YYYY-MM-DD', async () => {
        const mockApiResponse = {
            Results: {
                Make: 'PORSCHE',
                Model: '911 GT3 RS',
                TaxDueDate: '01/11/2026',
                TaxStatus: 'Taxed'
            }
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockApiResponse)
            })
        ) as any;

        try {
            const vehicle = await lookupVehicleByVRM('GT3 RS');
            expect(vehicle.taxDueDate).toBe('2026-11-01');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('extracts tax return date from MotHistoryDetails fallback if missing in first payload', async () => {
        let callCount = 0;
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url: string) => {
            callCount++;
            if (url.includes('VehicleDetailsWithImage')) {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        Results: {
                            DvlaMake: 'BMW',
                            DvlaModel: 'M3'
                        }
                    })
                });
            } else {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        Results: {
                            MotHistoryDetails: {
                                TaxDueDate: '2026-12-01'
                            }
                        }
                    })
                });
            }
        }) as any;

        try {
            const vehicle = await lookupVehicleByVRM('M3 BMW');
            expect(vehicle.taxDueDate).toBe('2026-12-01');
        } finally {
            global.fetch = originalFetch;
        }
    });
});
