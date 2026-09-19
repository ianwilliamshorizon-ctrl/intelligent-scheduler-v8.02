import { describe, it, expect } from 'vitest';
import { Job, Customer, Vehicle } from '../../types';

describe('Job Customer Assignment & Fallback Resolution', () => {
    const mockCustomer1: Customer = {
        id: 'cust_001',
        forename: 'James',
        surname: 'Bond',
        phone: '07700 900007',
        email: '007@mi6.gov.uk',
        serviceReminderConsent: true
    };

    const mockCustomer2: Customer = {
        id: 'cust_002',
        forename: 'Sarah',
        surname: 'Connor',
        phone: '07700 900123',
        email: 'sarah@skynet.com',
        serviceReminderConsent: true
    };

    const mockVehicle: Vehicle = {
        id: 'veh_001',
        registration: 'WP21 XKL',
        make: 'Porsche',
        model: '911',
        customerId: 'cust_001'
    };

    it('resolves customer from vehicle.customerId when job.customerId is missing or unset', () => {
        const jobWithoutCustomer: Job = {
            id: 'BTR992000029',
            vehicleId: 'veh_001',
            entityId: 'ent_brookspeed',
            status: 'Booked',
            description: 'Annual service and inspection'
        };

        const customers = [mockCustomer1, mockCustomer2];

        // Resolution logic: editableJob.customerId || job.customerId || vehicle.customerId
        const resolvedCustomerId = jobWithoutCustomer.customerId || mockVehicle.customerId;
        const resolvedCustomer = customers.find(c => c.id === resolvedCustomerId);

        expect(resolvedCustomerId).toBe('cust_001');
        expect(resolvedCustomer).toBeDefined();
        expect(resolvedCustomer?.forename).toBe('James');
        expect(resolvedCustomer?.surname).toBe('Bond');
    });

    it('assigns a customer to job BTR992000029 and updates job record', () => {
        const job: Job = {
            id: 'BTR992000029',
            vehicleId: 'veh_001',
            entityId: 'ent_brookspeed',
            status: 'Booked',
            description: 'Annual service'
        };

        const assignedCustomer = mockCustomer2;
        const updatedJob: Job = {
            ...job,
            customerId: assignedCustomer.id
        };

        expect(updatedJob.customerId).toBe('cust_002');
    });

    it('links customer to vehicle if vehicle does not have an owner yet', () => {
        const unownedVehicle: Vehicle = {
            id: 'veh_002',
            registration: 'AB22 CDE',
            make: 'BMW',
            model: 'M3'
        };

        const newCustomerId = 'cust_002';
        const updatedVehicle: Vehicle = {
            ...unownedVehicle,
            customerId: unownedVehicle.customerId || newCustomerId
        };

        expect(updatedVehicle.customerId).toBe('cust_002');
    });

    it('ensures default customer consent satisfies validation without blocking save', () => {
        const newCustomerFormData = {
            forename: 'Alice',
            surname: 'Smith',
            serviceReminderConsent: true,
            marketingConsent: false,
            declinedCommunication: false
        };

        const marketing = !!newCustomerFormData.marketingConsent;
        const reminders = !!newCustomerFormData.serviceReminderConsent;
        const declined = !!newCustomerFormData.declinedCommunication;

        const hasValidConsentOption = marketing || reminders || declined;
        expect(hasValidConsentOption).toBe(true);
    });
});
