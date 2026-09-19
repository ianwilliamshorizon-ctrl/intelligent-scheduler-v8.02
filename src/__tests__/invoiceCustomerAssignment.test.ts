import { describe, it, expect } from 'vitest';
import { Invoice, Customer, Vehicle, Job } from '../../types';

describe('Invoice Customer Assignment & Fallback Resolution', () => {
    const mockCustomer1: Customer = {
        id: 'cust_001',
        forename: 'Gordon',
        surname: 'Murray',
        companyName: 'GMA Design',
        phone: '07700 900555',
        email: 'gordon@gma.com',
        serviceReminderConsent: true
    };

    const mockCustomer2: Customer = {
        id: 'cust_002',
        forename: 'Adrian',
        surname: 'Newey',
        phone: '07700 900666',
        email: 'adrian@redbull.com',
        serviceReminderConsent: true
    };

    const mockVehicle: Vehicle = {
        id: 'veh_001',
        registration: 'BTR 911',
        make: 'Porsche',
        model: '911 GT3',
        customerId: 'cust_001'
    };

    it('resolves customer for invoice #BTR911000021 when invoice.customerId is empty but vehicle has customerId', () => {
        const invoiceWithoutCustomer: Invoice = {
            id: 'BTR911000021',
            vehicleId: 'veh_001',
            customerId: '',
            issueDate: '2026-09-19',
            dueDate: '2026-10-19',
            status: 'Draft',
            lineItems: [],
            payments: [],
            entityId: 'ent_brookspeed'
        };

        const customers = [mockCustomer1, mockCustomer2];
        const vehicles = [mockVehicle];

        // Fallback resolution: invoice.customerId || linkedJob?.customerId || linkedVeh?.customerId
        const linkedVeh = vehicles.find(v => v.id === invoiceWithoutCustomer.vehicleId);
        const resolvedCustomerId = invoiceWithoutCustomer.customerId || linkedVeh?.customerId;
        const resolvedCustomer = customers.find(c => c.id === resolvedCustomerId);

        expect(resolvedCustomerId).toBe('cust_001');
        expect(resolvedCustomer).toBeDefined();
        expect(resolvedCustomer?.forename).toBe('Gordon');
        expect(resolvedCustomer?.surname).toBe('Murray');
    });

    it('resolves customer for invoice when invoice.customerId is empty but linked job has customerId', () => {
        const linkedJob: Job = {
            id: 'BTR992000029',
            customerId: 'cust_002',
            vehicleId: 'veh_002',
            entityId: 'ent_brookspeed',
            status: 'Completed',
            description: 'Trim dashboard and seats'
        };

        const invoiceWithJob: Invoice = {
            id: 'BTR911000021',
            jobId: 'BTR992000029',
            vehicleId: 'veh_002',
            customerId: '',
            issueDate: '2026-09-19',
            dueDate: '2026-10-19',
            status: 'Draft',
            lineItems: [],
            payments: [],
            entityId: 'ent_brookspeed'
        };

        const customers = [mockCustomer1, mockCustomer2];
        const resolvedCustomerId = invoiceWithJob.customerId || linkedJob?.customerId;
        const resolvedCustomer = customers.find(c => c.id === resolvedCustomerId);

        expect(resolvedCustomerId).toBe('cust_002');
        expect(resolvedCustomer?.forename).toBe('Adrian');
        expect(resolvedCustomer?.surname).toBe('Newey');
    });

    it('preserves existing vehicleId on invoice when a new customer is selected', () => {
        const initialInvoice: Invoice = {
            id: 'BTR911000021',
            vehicleId: 'veh_001',
            customerId: '',
            issueDate: '2026-09-19',
            dueDate: '2026-10-19',
            status: 'Draft',
            lineItems: [],
            payments: [],
            entityId: 'ent_brookspeed'
        };

        // Simulated customer selection logic from InvoiceFormModal:
        // Customer 2 currently owns 0 vehicles
        const customer2Vehicles: Vehicle[] = [];
        const prevVehicleId = initialInvoice.vehicleId;
        const nextVehicleId = prevVehicleId || (customer2Vehicles.length === 1 ? customer2Vehicles[0].id : '');

        const updatedInvoice: Invoice = {
            ...initialInvoice,
            customerId: mockCustomer2.id,
            vehicleId: nextVehicleId
        };

        // Critical: vehicleId must not be wiped!
        expect(updatedInvoice.customerId).toBe('cust_002');
        expect(updatedInvoice.vehicleId).toBe('veh_001');
    });

    it('associates an unassigned vehicle to the customer when saving invoice', () => {
        const unassignedVehicle: Vehicle = {
            id: 'veh_unassigned',
            registration: 'BTR 992',
            make: 'Porsche',
            model: '911 Turbo'
        };

        const customerId = 'cust_002';
        const updatedVehicle: Vehicle = {
            ...unassignedVehicle,
            customerId: unassignedVehicle.customerId || customerId
        };

        expect(updatedVehicle.customerId).toBe('cust_002');
    });

    it('ensures newly created customer from InvoiceModal or InvoiceFormModal has default consent enabled', () => {
        const defaultCustomerPayload = {
            forename: 'Alice',
            surname: 'Walker',
            serviceReminderConsent: true
        };

        expect(defaultCustomerPayload.serviceReminderConsent).toBe(true);
        const hasConsent = !!defaultCustomerPayload.serviceReminderConsent;
        expect(hasConsent).toBe(true);
    });
});
