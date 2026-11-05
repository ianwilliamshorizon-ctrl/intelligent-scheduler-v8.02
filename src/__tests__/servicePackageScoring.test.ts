import { describe, it, expect } from 'vitest';
import { getScoredServicePackages } from '../../utils/servicePackageScoring';
import { ServicePackage } from '../../types';

describe('getScoredServicePackages - Graded Matching Engine', () => {
    const mockPackages: ServicePackage[] = [
        {
            id: 'pkg-1',
            name: 'Porsche 911 Minor Service',
            description: 'Standard minor service for 911',
            applicableMake: 'PORSCHE',
            applicableModel: '911',
            applicableEngineSize: 3000,
            entityId: 'ent_porsche'
        },
        {
            id: 'pkg-2',
            name: 'Generic MOT',
            description: 'Annual MOT test',
            applicableMake: '',
            applicableModel: '',
            entityId: 'ent_porsche'
        },
        {
            id: 'pkg-macan-bronze',
            name: 'Porsche Macan 3.0 S / GTS (V6 Petrol Twin-Turbo) Minor Service - Bronze',
            description: 'Bronze tier minor service for Macan GTS / S',
            applicableMake: 'Porsche',
            applicableModel: 'Macan',
            applicableVariant: '3.0 S / GTS (V6 Petrol Twin-Turbo)',
            entityId: 'ent_porsche'
        },
        {
            id: 'pkg-macan-gold',
            name: 'Porsche Macan 3.0 S / GTS (V6 Petrol Twin-Turbo) Minor Service - Gold',
            description: 'Gold tier minor service for Macan GTS / S',
            applicableMake: 'Porsche',
            applicableModel: 'Macan',
            applicableVariant: '3.0 S / GTS (V6 Petrol Twin-Turbo)',
            entityId: 'ent_porsche'
        },
        {
            id: 'pkg-cayenne',
            name: 'Porsche Cayenne 3.0 Major Service',
            description: 'Major service for Cayenne',
            applicableMake: 'Porsche',
            applicableModel: 'Cayenne',
            entityId: 'ent_porsche'
        },
        {
            id: 'pkg-audi',
            name: 'Audi A4 2.0 TDI Service',
            description: 'Service for Audi A4',
            applicableMake: 'Audi',
            applicableModel: 'A4',
            entityId: 'ent_audi'
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

        const results = getScoredServicePackages(mockPackages, vehicleWithNumericModel as any);
        expect(results.length).toBe(mockPackages.length);
        const porsche911 = results.find(r => r.pkg.id === 'pkg-1');
        expect(porsche911).toBeDefined();
        expect(porsche911?.grade).toBe('exact');
        expect(porsche911?.status).toBe('exact');
        expect(porsche911?.score).toBeGreaterThan(0);
    });

    it('correctly grades Exact Match for Porsche Macan GTS Petrol', () => {
        const vehicle = {
            make: 'Porsche',
            model: 'Macan GTS',
            fuelType: 'Petrol',
            cc: 2997
        };

        const results = getScoredServicePackages(mockPackages, vehicle as any);
        const macanPkg = results.find(r => r.pkg.id === 'pkg-macan-bronze');
        expect(macanPkg).toBeDefined();
        expect(macanPkg?.grade).toBe('exact');
        expect(macanPkg?.gradeLabel).toBe('★ Exact Match');
        expect(macanPkg?.fuelConflict).toBe(false);
    });

    it('flags Fuel Conflict when vehicle is Diesel but package is Petrol', () => {
        const vehicle = {
            make: 'Porsche',
            model: 'Macan',
            fuelType: 'Diesel'
        };

        const results = getScoredServicePackages(mockPackages, vehicle as any);
        const macanPkg = results.find(r => r.pkg.id === 'pkg-macan-bronze');
        expect(macanPkg).toBeDefined();
        expect(macanPkg?.grade).toBe('model');
        expect(macanPkg?.fuelConflict).toBe(true);
        expect(macanPkg?.fuelConflictNotice).toContain('Vehicle is Diesel');
    });

    it('grades Make Match (Partial) for different model in same make', () => {
        const vehicle = {
            make: 'Porsche',
            model: 'Macan',
            fuelType: 'Petrol'
        };

        const results = getScoredServicePackages(mockPackages, vehicle as any);
        const cayennePkg = results.find(r => r.pkg.id === 'pkg-cayenne');
        expect(cayennePkg).toBeDefined();
        expect(cayennePkg?.grade).toBe('make');
        expect(cayennePkg?.status).toBe('make');
    });

    it('grades Universal for generic workshop packages', () => {
        const vehicle = {
            make: 'Porsche',
            model: 'Macan'
        };

        const results = getScoredServicePackages(mockPackages, vehicle as any);
        const motPkg = results.find(r => r.pkg.id === 'pkg-2');
        expect(motPkg).toBeDefined();
        expect(motPkg?.grade).toBe('generic');
        expect(motPkg?.gradeLabel).toBe('Universal');
    });

    it('rejects Conflicting Brands (e.g. Audi package for Porsche vehicle)', () => {
        const vehicle = {
            make: 'Porsche',
            model: 'Macan'
        };

        const results = getScoredServicePackages(mockPackages, vehicle as any);
        const audiPkg = results.find(r => r.pkg.id === 'pkg-audi');
        expect(audiPkg).toBeDefined();
        expect(audiPkg?.grade).toBe('other');
        expect(audiPkg?.score).toBe(0);
    });

    it('boosts Bronze package to top when user requested Bronze', () => {
        const vehicle = {
            make: 'Porsche',
            model: 'Macan GTS',
            fuelType: 'Petrol'
        };

        const results = getScoredServicePackages(mockPackages, vehicle as any, 'Customer wants Bronze minor service');
        expect(results[0].pkg.id).toBe('pkg-macan-bronze');
        expect(results[0].narrativeMatched).toBe(true);
    });

    it('handles vehicle with undefined or null fields safely', () => {
        const partialVehicle = {
            make: 'PORSCHE',
            model: undefined,
            cc: null
        };

        expect(() => {
            const results = getScoredServicePackages(mockPackages, partialVehicle as any);
            expect(results.length).toBe(mockPackages.length);
        }).not.toThrow();
    });
});
