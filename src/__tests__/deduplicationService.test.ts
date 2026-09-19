import { describe, it, expect } from 'vitest';
import { 
    findDuplicateCustomers, 
    findDuplicateVehicles, 
    mergeCustomerData, 
    mergeVehicleData, 
    normalizePhone, 
    normalizeVRM,
    getCustomerDependencyCounts,
    getVehicleDependencyCounts 
} from '../../core/utils/deduplicationUtils';
import { Customer, Vehicle } from '../../types';

describe('Deduplication Utilities', () => {
    describe('Normalization Helpers', () => {
        it('normalizes UK phone numbers properly', () => {
            expect(normalizePhone('07700 900123')).toBe('7700900123');
            expect(normalizePhone('+44 7700 900 123')).toBe('7700900123');
            expect(normalizePhone('(023) 8061 2345')).toBe('2380612345');
        });

        it('normalizes VRMs properly', () => {
            expect(normalizeVRM('ab12 cde')).toBe('AB12CDE');
            expect(normalizeVRM('  W015 SOT  ')).toBe('W015SOT');
        });
    });

    describe('Customer Duplicate Finder', () => {
        const sampleCustomers: Customer[] = [
            {
                id: 'CUST001',
                forename: 'John',
                surname: 'Smith',
                email: 'john.smith@example.com',
                mobile: '07700900111',
                addressLine1: '10 High Street',
                city: 'Eastleigh',
                postcode: 'SO50 5AA'
            },
            {
                id: 'CUST002',
                forename: 'John',
                surname: 'Smith',
                email: 'JOHN.SMITH@example.com',
                mobile: '07700900999',
                addressLine1: '',
                city: '',
                postcode: 'SO50 5AA'
            },
            {
                id: 'CUST003',
                forename: 'Sarah',
                surname: 'Jenkins',
                email: 'sarah.j@example.com',
                mobile: '+44 7700 900 111',
                addressLine1: '15 Low Road',
                city: 'Winchester',
                postcode: 'SO22 6AA'
            },
            {
                id: 'CUST004',
                forename: 'Unique',
                surname: 'Person',
                email: 'unique@example.com',
                mobile: '07800000000',
                addressLine1: '1 Unique Way',
                city: 'Romsey',
                postcode: 'SO51 8AA'
            }
        ];

        it('finds duplicates by email (case-insensitive)', () => {
            const groups = findDuplicateCustomers(sampleCustomers, 'email');
            expect(groups).toHaveLength(1);
            expect(groups[0].customers).toHaveLength(2);
            expect(groups[0].customers.map(c => c.id)).toEqual(['CUST001', 'CUST002']);
        });

        it('finds duplicates by phone/mobile', () => {
            const groups = findDuplicateCustomers(sampleCustomers, 'phone');
            expect(groups).toHaveLength(1);
            expect(groups[0].customers).toHaveLength(2);
            expect(groups[0].customers.map(c => c.id)).toEqual(['CUST001', 'CUST003']);
        });

        it('finds duplicates by full name', () => {
            const groups = findDuplicateCustomers(sampleCustomers, 'name');
            expect(groups).toHaveLength(1);
            expect(groups[0].customers).toHaveLength(2);
            expect(groups[0].customers.map(c => c.id)).toEqual(['CUST001', 'CUST002']);
        });

        it('finds duplicates by surname and postcode', () => {
            const groups = findDuplicateCustomers(sampleCustomers, 'postcode_name');
            expect(groups).toHaveLength(1);
            expect(groups[0].customers).toHaveLength(2);
            expect(groups[0].customers.map(c => c.id)).toEqual(['CUST001', 'CUST002']);
        });
    });

    describe('Vehicle Duplicate Finder', () => {
        const sampleVehicles: Vehicle[] = [
            {
                id: 'veh-1',
                registration: 'AB12 CDE',
                make: 'PORSCHE',
                model: '911',
                vin: 'WP0ZZZ99ZMS111111'
            },
            {
                id: 'veh-2',
                registration: 'ab12cde',
                make: 'Porsche',
                model: '911 Carrera',
                vin: ''
            },
            {
                id: 'veh-3',
                registration: 'XY65 ZZZ',
                make: 'BMW',
                model: 'M3',
                vin: 'WP0ZZZ99ZMS111111'
            }
        ];

        it('finds duplicate vehicles by registration', () => {
            const groups = findDuplicateVehicles(sampleVehicles, 'vrm');
            expect(groups).toHaveLength(1);
            expect(groups[0].vehicles).toHaveLength(2);
            expect(groups[0].vehicles.map(v => v.id)).toEqual(['veh-1', 'veh-2']);
        });

        it('finds duplicate vehicles by VIN', () => {
            const groups = findDuplicateVehicles(sampleVehicles, 'vin');
            expect(groups).toHaveLength(1);
            expect(groups[0].vehicles).toHaveLength(2);
            expect(groups[0].vehicles.map(v => v.id)).toEqual(['veh-1', 'veh-3']);
        });
    });

    describe('Customer Merge Logic', () => {
        it('preserves master data and pulls in missing fields from secondary', () => {
            const master: Customer = {
                id: 'CUST001',
                forename: 'John',
                surname: 'Smith',
                addressLine1: '10 High Street',
                city: 'Eastleigh',
                postcode: 'SO50 5AA'
            };

            const duplicate: Customer = {
                id: 'CUST002',
                forename: 'John',
                surname: 'Smith',
                email: 'john.smith@example.com',
                mobile: '07700900111',
                phone: '02380123456',
                companyName: 'Smith Plumbing',
                isBusinessCustomer: true
            };

            const merged = mergeCustomerData(master, [duplicate]);

            expect(merged.id).toBe('CUST001');
            expect(merged.addressLine1).toBe('10 High Street');
            expect(merged.email).toBe('john.smith@example.com');
            expect(merged.mobile).toBe('07700900111');
            expect(merged.phone).toBe('02380123456');
            expect(merged.companyName).toBe('Smith Plumbing');
            expect(merged.isBusinessCustomer).toBe(true);
            expect((merged as any).addressline1).toBe('10 High Street');
            expect((merged as any).companyname).toBe('Smith Plumbing');
        });
    });

    describe('Vehicle Merge Logic', () => {
        it('preserves master vehicle data and merges missing technical attributes', () => {
            const master: Vehicle = {
                id: 'veh-1',
                registration: 'AB12 CDE',
                make: 'PORSCHE',
                model: '911'
            };

            const duplicate: Vehicle = {
                id: 'veh-2',
                registration: 'AB12 CDE',
                make: 'PORSCHE',
                model: '911',
                vin: 'WP0ZZZ99ZMS123456',
                engineNumber: 'ENG998877',
                colour: 'Guards Red',
                fuelType: 'Petrol',
                transmissionType: 'Manual',
                cc: 3800
            };

            const merged = mergeVehicleData(master, [duplicate]);

            expect(merged.id).toBe('veh-1');
            expect(merged.registration).toBe('AB12 CDE');
            expect(merged.vin).toBe('WP0ZZZ99ZMS123456');
            expect(merged.engineNumber).toBe('ENG998877');
            expect(merged.colour).toBe('Guards Red');
            expect(merged.fuelType).toBe('Petrol');
            expect(merged.transmissionType).toBe('Manual');
            expect(merged.cc).toBe(3800);
        });
    });

    describe('Dependency Counts', () => {
        it('accurately counts customer and vehicle dependencies', () => {
            const cCounts = getCustomerDependencyCounts(
                'CUST001',
                [{ id: 'v1', customerId: 'CUST001', registration: 'R1', make: 'M', model: 'M' }],
                [{ id: 'j1', customerId: 'CUST001' } as any],
                [{ id: 'e1', customerId: 'CUST001' } as any],
                [{ id: 'inv1', customerId: 'CUST001' } as any],
                [{ id: 'inq1', linkedCustomerId: 'CUST001' } as any]
            );

            expect(cCounts.vehicles).toBe(1);
            expect(cCounts.jobs).toBe(1);
            expect(cCounts.estimates).toBe(1);
            expect(cCounts.invoices).toBe(1);
            expect(cCounts.inquiries).toBe(1);
            expect(cCounts.total).toBe(5);

            const vCounts = getVehicleDependencyCounts(
                'v1',
                [{ id: 'j1', vehicleId: 'v1' } as any],
                [{ id: 'e1', vehicleId: 'v1' } as any],
                [{ id: 'inv1', vehicleId: 'v1' } as any],
                [{ id: 'inq1', linkedVehicleId: 'v1' } as any]
            );

            expect(vCounts.jobs).toBe(1);
            expect(vCounts.estimates).toBe(1);
            expect(vCounts.invoices).toBe(1);
            expect(vCounts.inquiries).toBe(1);
            expect(vCounts.total).toBe(4);
        });
    });
});
