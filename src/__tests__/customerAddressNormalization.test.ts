import { describe, it, expect } from 'vitest';
import { normalizeCustomer, isLikelyStreetAddress, getCustomerDisplayName } from '../../core/utils/customerUtils';

describe('Customer Address Normalization', () => {
    it('normalizes lowercase addressline1 and addressline2 to camelCase', () => {
        const raw = {
            id: 'ABDUL001',
            forename: 'Akram',
            surname: 'Abdullah',
            addressline1: '15 Holly Gardens',
            addressLine1: '',
            addressline2: 'West End',
            addressLine2: '',
            city: 'Southampton',
            postcode: 'so30 3ru',
            companyname: '',
            companyName: ''
        };

        const normalized = normalizeCustomer(raw);
        expect(normalized.addressLine1).toBe('15 Holly Gardens');
        expect(normalized.addressline1).toBe('15 Holly Gardens');
        expect(normalized.addressLine2).toBe('West End');
        expect(normalized.addressline2).toBe('West End');
        expect(normalized.postcode).toBe('SO30 3RU');
    });

    it('normalizes lowercase companyname to companyName', () => {
        const raw = {
            id: '911BO001',
            forename: '',
            surname: '',
            companyname: '911 Box Ltd.',
            companyName: '',
            addressline1: '2 Commonside',
            city: 'Kent',
            postcode: 'BR2 6BP'
        };

        const normalized = normalizeCustomer(raw);
        expect(normalized.companyName).toBe('911 Box Ltd.');
        expect(normalized.companyname).toBe('911 Box Ltd.');
        expect(normalized.addressLine1).toBe('2 Commonside');
    });

    it('detects and promotes street addresses sitting inside the city field', () => {
        const raw = {
            id: 'ABRAM001',
            forename: 'Robert',
            surname: 'Abrams',
            addressLine1: '',
            addressline1: '',
            city: '23 Warsash Road',
            postcode: 'SO31 9HW'
        };

        const normalized = normalizeCustomer(raw);
        expect(normalized.addressLine1).toBe('23 Warsash Road');
        expect(normalized.addressline1).toBe('23 Warsash Road');
        expect(normalized.city).toBe('');
    });

    it('correctly identifies street address strings with isLikelyStreetAddress', () => {
        expect(isLikelyStreetAddress('23 Warsash Road')).toBe(true);
        expect(isLikelyStreetAddress('15 Holly Gardens')).toBe(true);
        expect(isLikelyStreetAddress('Flat 8 Curtling Place')).toBe(true);
        expect(isLikelyStreetAddress('Unit 4 Speedwell Estate')).toBe(true);
        expect(isLikelyStreetAddress('37 Nelson Road')).toBe(true);
        expect(isLikelyStreetAddress('Southampton')).toBe(false);
        expect(isLikelyStreetAddress('Winchester')).toBe(false);
        expect(isLikelyStreetAddress('Eastleigh')).toBe(false);
        expect(isLikelyStreetAddress('')).toBe(false);
    });

    it('formats customer display names with company name when available', () => {
        const busCustomer = {
            id: 'ABL1T001',
            isBusinessCustomer: true,
            companyname: 'ABL 1Touch Repair',
            forename: 'John',
            surname: 'Doe'
        };

        const name = getCustomerDisplayName(busCustomer as any);
        expect(name).toBe('ABL 1Touch Repair (John Doe)');
    });
});
