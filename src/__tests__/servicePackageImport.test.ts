import { describe, it, expect } from 'vitest';
import { 
    parseServicePackagesFromRows, 
    findBusinessEntity, 
    generateServicePackagesCsvTemplate 
} from '../../utils/servicePackageImportUtils';
import { BusinessEntity, TaxRate, Part } from '../../types';

describe('Service Package Import Utility', () => {
    const mockEntities: BusinessEntity[] = [
        { id: 'ent_1', name: 'Brookspeed Southampton', shortCode: 'SOUTH', laborRate: 95, laborCostRate: 35 },
        { id: 'ent_2', name: 'Brookspeed Race Team', shortCode: 'RACE', laborRate: 120, laborCostRate: 45 }
    ];

    const mockTaxRates: TaxRate[] = [
        { id: 'tax_1', code: 'T0', name: 'Zero Rated / Exempt', rate: 0 },
        { id: 'tax_2', code: 'T1', name: 'Standard VAT', rate: 20 }
    ];

    const mockParts: Part[] = [
        { 
            id: 'p_1', 
            partNumber: 'MOB-0W40', 
            description: 'Mobil 1 0W-40 Synthetic Oil', 
            salePrice: 14.50, 
            costPrice: 8.20, 
            stockQuantity: 20, 
            isStockItem: true, 
            taxCodeId: 'tax_2' 
        }
    ];

    it('matches business entity by exact name, shortcode, or substring', () => {
        expect(findBusinessEntity('Brookspeed Southampton', mockEntities)?.id).toBe('ent_1');
        expect(findBusinessEntity('SOUTH', mockEntities)?.id).toBe('ent_1');
        expect(findBusinessEntity('race', mockEntities)?.id).toBe('ent_2');
        expect(findBusinessEntity('', mockEntities, 'ent_1')?.id).toBe('ent_1');
    });

    it('successfully parses multi-row service package with labour and parts missing part numbers', () => {
        const rows = [
            {
                'Package Name': 'Major Porsche Service',
                'Business Entity': 'Brookspeed Southampton',
                'Package Description': 'Full annual service',
                'Vehicle Make': 'Porsche',
                'Vehicle Model': '911',
                'Item Type': 'Labour',
                'Item Description': 'Major Service Labour',
                'Part Number': '', // Empty part number
                'Quantity': '4.5',
                'Unit Price': '95',
                'Unit Cost': '35',
                'Tax Code': 'T1'
            },
            {
                'Package Name': 'Major Porsche Service',
                'Business Entity': 'Brookspeed Southampton',
                'Item Type': 'Part',
                'Item Description': 'Mobil 1 ESP 0W-40',
                'Part Number': 'MOB-0W40',
                'Quantity': '8',
                'Unit Price': '14.50',
                'Unit Cost': '8.20',
                'Tax Code': 'T1'
            },
            {
                'Package Name': 'Major Porsche Service',
                'Business Entity': 'Brookspeed Southampton',
                'Item Type': 'Part',
                'Item Description': 'Sump Plug Washer',
                'Part Number': '', // Completely missing part number!
                'Quantity': '1',
                'Unit Price': '2.50',
                'Unit Cost': '0.40',
                'Tax Code': 'T1'
            }
        ];

        const summary = parseServicePackagesFromRows(rows, mockEntities, mockTaxRates, mockParts);

        expect(summary.results.length).toBe(1);
        const result = summary.results[0];
        expect(result.validation.isValid).toBe(true);
        expect(result.validation.hasLabour).toBe(true);
        expect(result.validation.hasQuantities).toBe(true);
        expect(result.validation.hasBusinessEntity).toBe(true);
        expect(result.totalLabourHours).toBe(4.5);
        expect(result.labourItemCount).toBe(1);
        expect(result.partItemCount).toBe(2);
        expect(result.partsWithoutPartNumberCount).toBe(1); // One part has no part number
        expect(result.pkg.name).toBe('Major Porsche Service');
        expect(result.pkg.entityId).toBe('ent_1');
        expect(result.pkg.costItems?.length).toBe(3);
    });

    it('fails validation when package has no labour item', () => {
        const rows = [
            {
                'Package Name': 'Parts Only Kit',
                'Business Entity': 'Brookspeed Southampton',
                'Item Type': 'Part',
                'Item Description': 'Mobil 1 ESP 0W-40',
                'Quantity': '4',
                'Unit Price': '15'
            }
        ];

        const summary = parseServicePackagesFromRows(rows, mockEntities, mockTaxRates, mockParts);
        expect(summary.results.length).toBe(1);
        const result = summary.results[0];
        expect(result.validation.isValid).toBe(false);
        expect(result.validation.hasLabour).toBe(false);
        expect(result.validation.errors.some(e => e.includes('Labour'))).toBe(true);
    });

    it('fails validation when item has invalid or missing quantity', () => {
        const rows = [
            {
                'Package Name': 'Brake Check',
                'Business Entity': 'Brookspeed Southampton',
                'Item Type': 'Labour',
                'Item Description': 'Brake Inspection',
                'Quantity': '0' // Zero quantity
            }
        ];

        const summary = parseServicePackagesFromRows(rows, mockEntities, mockTaxRates, mockParts);
        expect(summary.results.length).toBe(1);
        const result = summary.results[0];
        expect(result.validation.isValid).toBe(false);
        expect(result.validation.errors.some(e => e.includes('quantity'))).toBe(true);
    });

    it('generates a valid CSV template containing required columns and sample rows', () => {
        const csv = generateServicePackagesCsvTemplate(mockEntities);
        expect(csv).toContain('Package Name');
        expect(csv).toContain('Business Entity');
        expect(csv).toContain('Item Type');
        expect(csv).toContain('Quantity');
        expect(csv).toContain('Brookspeed Southampton');
        expect(csv).toContain('Labour');
        expect(csv).toContain('Part');
    });
});
