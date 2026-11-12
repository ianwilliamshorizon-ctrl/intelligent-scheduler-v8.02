import { describe, it, expect } from 'vitest';
import {
    detectPackageTier,
    filterServicePackagesForCatalog
} from '../../components/management/PrintableServicePackageCatalogModal';
import { ServicePackage } from '../../types';

const samplePackages: ServicePackage[] = [
    {
        id: 'p1',
        entityId: 'ent_porsche',
        name: 'Porsche 911 (991) Major Service - Bronze',
        description: 'Baseline major lubrication change.',
        applicableMake: 'Porsche',
        applicableModel: '911 (991)',
        totalPrice: 495
    },
    {
        id: 'p2',
        entityId: 'ent_porsche',
        name: 'Porsche 911 (991) Major Service - Silver',
        description: 'True 4-year compliance service.',
        applicableMake: 'Porsche',
        applicableModel: '911 (991)',
        totalPrice: 795
    },
    {
        id: 'p3',
        entityId: 'ent_porsche',
        name: 'Porsche Macan Minor Service - Bronze',
        description: 'Routine oil and filter service.',
        applicableMake: 'Porsche',
        applicableModel: 'Macan',
        totalPrice: 295
    },
    {
        id: 'p4',
        entityId: 'ent_audi',
        name: 'Audi RS4 Major Service - Bronze',
        description: 'Audi V6 / V8 major service.',
        applicableMake: 'Audi',
        applicableModel: 'RS4',
        totalPrice: 450
    },
    {
        id: 'p5',
        entityId: 'ent_trimming',
        name: 'Convertible Hood Clean & Seal',
        description: 'Fabric roof deep clean and waterproofing.',
        applicableMake: 'Universal',
        applicableModel: 'All',
        totalPrice: 180
    }
];

describe('Service Package PDF Catalog Filters', () => {
    it('detects package tier accurately from name or description', () => {
        expect(detectPackageTier(samplePackages[0])).toBe('bronze');
        expect(detectPackageTier(samplePackages[1])).toBe('silver');
        expect(detectPackageTier(samplePackages[4])).toBe('standard');
    });

    it('filters by Entity + Bronze tier (e.g. Brookspeed Porsche & Performance Bronze packages)', () => {
        const result = filterServicePackagesForCatalog(samplePackages, {
            entityId: 'ent_porsche',
            tier: 'bronze',
            make: 'all',
            model: 'all',
            keyword: ''
        });
        expect(result.map(p => p.id)).toEqual(['p1', 'p3']);
    });

    it('supports Make, Model, and Keyword filters together', () => {
        const byModel = filterServicePackagesForCatalog(samplePackages, {
            entityId: 'ent_porsche',
            tier: 'all',
            make: 'Porsche',
            model: '911 (991)',
            keyword: ''
        });
        expect(byModel.map(p => p.id)).toEqual(['p1', 'p2']);

        const byKeyword = filterServicePackagesForCatalog(samplePackages, {
            entityId: 'all',
            tier: 'all',
            make: 'all',
            model: 'all',
            keyword: 'Hood'
        });
        expect(byKeyword.map(p => p.id)).toEqual(['p5']);
    });
});

