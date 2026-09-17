import { describe, it, expect } from 'vitest';
import { getScoredServicePackages } from '../../utils/servicePackageScoring';
import { ServicePackage } from '../../types';

describe('getScoredServicePackages', () => {
    const mockPackages: ServicePackage[] = [
        {
            id: 'pkg-1',
            name: 'Porsche 911 Minor Service',
            description: 'Standard minor service for 911',
            applicableMake: 'PORSCHE',
            applicableModel: '911',
            applicableEngineSize: 3000,
            entityId: 'ent_porsche',
            active: true,
            items: []
        },
        {
            id: 'pkg-2',
            name: 'Generic MOT',
            description: 'Annual MOT test',
            applicableMake: '',
            applicableModel: '',
            entityId: 'ent_porsche',
            active: true,
            items: []
        }
    ];

    it('handles vehicles where model is numeric (e.g. 911 for VOI 59) without throwing', () => {
        const vehicleWithNumericModel = {
            id: 'veh_5392',
            registration: 'VOI 59',
            make: 'PORSCHE',
            model: 911 as any, // in DB it was stored as number 911
            cc: 3000
        };

        expect(() => {
            const results = getScoredServicePackages(mockPackages, vehicleWithNumericModel as any);
            expect(results.length).toBe(2);
            expect(results[0].status).toBe('exact');
            expect(results[0].score).toBe(5);
        }).not.toThrow();
    });

    it('handles vehicle with undefined or null fields safely', () => {
        const partialVehicle = {
            make: 'PORSCHE',
            model: undefined,
            cc: null
        };

        expect(() => {
            const results = getScoredServicePackages(mockPackages, partialVehicle as any);
            expect(results.length).toBe(2);
        }).not.toThrow();
    });
});
