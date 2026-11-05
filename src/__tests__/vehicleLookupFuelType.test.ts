import { describe, it, expect, vi } from 'vitest';
import { lookupVehicleByVRM, normalizeFuelType } from '../../services/vehicleLookupService';

describe('DVLA Vehicle Lookup Service - Fuel Type Extraction & Normalization', () => {
    it('normalizes UK DVLA "HEAVY OIL" to "Diesel"', () => {
        expect(normalizeFuelType('HEAVY OIL')).toBe('Diesel');
        expect(normalizeFuelType('heavy oil')).toBe('Diesel');
        expect(normalizeFuelType('DIESEL')).toBe('Diesel');
        expect(normalizeFuelType('PETROL')).toBe('Petrol');
        expect(normalizeFuelType('HYBRID ELECTRIC')).toBe('Hybrid');
        expect(normalizeFuelType('ELECTRICITY')).toBe('Electric');
    });

    it('extracts Diesel correctly when DVLA returns DvlaFuelType: HEAVY OIL', async () => {
        const mockApiResponse = {
            Results: {
                DvlaMake: 'PORSCHE',
                DvlaModel: 'MACAN S DIESEL',
                YearOfManufacture: '2016',
                DvlaFuelType: 'HEAVY OIL',
                EngineCapacityCc: 2967
            }
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockApiResponse)
            })
        ) as any;

        try {
            const vehicle = await lookupVehicleByVRM('WP16 ABC');
            expect(vehicle.make).toBe('Porsche');
            expect(vehicle.model).toBe('Macan S Diesel');
            expect(vehicle.fuelType).toBe('Diesel');
            expect(vehicle.fuelType).not.toBe('Petrol');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('falls back to MOT history fuelType if missing in primary payload', async () => {
        const vehicleDetailsResponse = {
            Results: {
                Make: 'BMW',
                Model: '330D',
                YearOfManufacture: '2018'
            }
        };

        const motHistoryResponse = {
            Results: {
                MotHistoryDetails: {
                    FuelType: 'Diesel',
                    MotDueDate: '2027-01-01'
                }
            }
        };

        const originalFetch = global.fetch;
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve({
                json: () => Promise.resolve(callCount === 1 ? vehicleDetailsResponse : motHistoryResponse)
            });
        }) as any;

        try {
            const vehicle = await lookupVehicleByVRM('BM18 DZZ');
            expect(vehicle.fuelType).toBe('Diesel');
        } finally {
            global.fetch = originalFetch;
        }
    });
});

