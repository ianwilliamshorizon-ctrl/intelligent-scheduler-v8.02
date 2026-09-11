import { describe, it, expect } from 'vitest';
import { generateCustomerId } from '../../core/utils/customerUtils';
import { Customer, Inquiry } from '../../types';

describe('Inquiry New Customer Creation & Safe Matching', () => {
    const existingCustomers: Customer[] = [
        {
            id: 'SMIT0001',
            forename: 'John',
            surname: 'Smith',
            email: 'john.smith@example.com',
            phone: '01234567890',
            mobile: '07123456789',
            category: 'Retail',
            isBusinessCustomer: false,
            createdDate: '2026-01-01T00:00:00.000Z'
        },
        {
            id: 'WILL0001',
            forename: 'Ian',
            surname: 'Williams',
            email: 'ian@example.com',
            phone: '01987654321',
            mobile: '07987654321',
            category: 'Retail',
            isBusinessCustomer: false,
            createdDate: '2026-01-01T00:00:00.000Z'
        }
    ];

    it('generates a sequential customer ID for new customer even with a common surname', () => {
        const newId = generateCustomerId('Smith', existingCustomers);
        expect(newId).toBe('SMIT0002');
    });

    it('does not hijack an existing customer by name alone in customer resolution', () => {
        // Inquiry with same name as existing customer, but different contact details (new customer)
        const inquiry: Inquiry = {
            id: 'inq-new-1',
            createdAt: new Date().toISOString(),
            fromName: 'John Smith',
            fromEmail: 'john.smith.new@gmail.com',
            fromPhone: '07999888777',
            message: 'First time visiting the workshop for quote',
            takenByUserId: 'user-1',
            status: 'Inbox'
        };

        const inquiryEmail = (inquiry.fromEmail || '').toLowerCase().trim();
        const inquiryPhone = (inquiry.fromPhone || '').replace(/\s/g, '');

        // Safe matcher only checks email or phone, not name alone
        const matched = (inquiryEmail || inquiryPhone) ? existingCustomers.find(c => {
            if (inquiryEmail && c.email?.toLowerCase().trim() === inquiryEmail) return true;
            if (inquiryPhone && (c.phone?.replace(/\s/g, '') === inquiryPhone || c.mobile?.replace(/\s/g, '') === inquiryPhone)) return true;
            return false;
        }) : null;

        // Must NOT match SMIT0001 since it is a different person
        expect(matched).toBeUndefined();

        // Generates new customer with unique ID
        const names = (inquiry.fromName || '').trim().split(/\s+/);
        const surname = names.slice(1).join(' ') || names[0];
        const newCustId = generateCustomerId(surname, existingCustomers);
        expect(newCustId).toBe('SMIT0002');
    });

    it('correctly matches existing customer when exact email or phone matches', () => {
        const inquiry: Inquiry = {
            id: 'inq-existing-1',
            createdAt: new Date().toISOString(),
            fromName: 'John',
            fromEmail: 'john.smith@example.com', // exact match
            fromPhone: '07123456789', // exact match
            message: 'Need annual service',
            takenByUserId: 'user-1',
            status: 'Inbox'
        };

        const inquiryEmail = (inquiry.fromEmail || '').toLowerCase().trim();
        const inquiryPhone = (inquiry.fromPhone || '').replace(/\s/g, '');

        const matched = (inquiryEmail || inquiryPhone) ? existingCustomers.find(c => {
            if (inquiryEmail && c.email?.toLowerCase().trim() === inquiryEmail) return true;
            if (inquiryPhone && (c.phone?.replace(/\s/g, '') === inquiryPhone || c.mobile?.replace(/\s/g, '') === inquiryPhone)) return true;
            return false;
        }) : null;

        expect(matched).toBeDefined();
        expect(matched?.id).toBe('SMIT0001');
    });
});
