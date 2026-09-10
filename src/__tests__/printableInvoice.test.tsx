import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableInvoice from '../../components/PrintableInvoice';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate } from '../../types';

describe('PrintableInvoice - Multi-Page Print Layout', () => {
    const mockEntity: BusinessEntity = {
        id: 'ent-1',
        name: 'Brookspeed Automotive Ltd',
        addressLine1: 'Unit 4, Speedwell Industrial Estate',
        city: 'Eastleigh',
        postcode: 'SO53 4NF',
        phone: '02380 641672',
        email: 'accounts@brookspeed.com',
        vatNumber: 'GB123456789',
        companyNumber: '09876543',
        invoiceFooterText: 'Registered in England & Wales. Thank you for your custom.'
    };

    const mockCustomer: Customer = {
        id: 'cust-1',
        forename: 'Gordon',
        surname: 'Freeman',
        addressLine1: 'Black Mesa Research Facility',
        city: 'Southampton',
        postcode: 'SO14 3ZH',
        phone: '02380 000111',
        mobile: '07700 900123'
    };

    const mockVehicle: Vehicle = {
        id: 'veh-1',
        registration: 'HL24 RCK',
        make: 'Porsche',
        model: '911 GT3',
        year: 2024,
        colour: 'Guards Red',
        customerId: 'cust-1'
    };

    const mockJob: Job = {
        id: 'job-1',
        jobNumber: 'JOB-99001',
        description: 'Complete major service and brake overhaul',
        status: 'Complete',
        mileage: 12500
    };

    const mockTaxRates: TaxRate[] = [
        { id: 'tax-std', name: 'Standard VAT', rate: 20, code: 'T1' }
    ];

    const mockInvoice: any = {
        id: 'inv-1001',
        invoiceNumber: 'INV-1001',
        issueDate: '2026-09-10',
        dueDate: '2026-09-24',
        entityId: 'ent-1',
        jobId: 'job-1',
        customerId: 'cust-1',
        vehicleId: 'veh-1',
        status: 'Sent',
        lineItems: [
            {
                id: 'li-1',
                description: 'Major Annual Service & Diagnostics',
                quantity: 4,
                unitPrice: 120,
                isLabor: true,
                type: 'labor',
                taxCodeId: 'tax-std'
            },
            {
                id: 'li-2',
                description: 'Mobil 1 Super Synthetic Engine Oil 0W-40 (8L)',
                quantity: 1,
                unitPrice: 110,
                partNumber: 'OIL-MOB-01',
                isLabor: false,
                taxCodeId: 'tax-std'
            },
            {
                id: 'li-3',
                description: 'Brembo High Performance Front Brake Discs',
                quantity: 2,
                unitPrice: 280,
                partNumber: 'BRK-DISC-02',
                isLabor: false,
                taxCodeId: 'tax-std'
            },
            {
                id: 'li-4',
                description: 'Ferodo DS2500 Brake Pads Front Axle',
                quantity: 1,
                unitPrice: 195,
                partNumber: 'PAD-FER-03',
                isLabor: false,
                taxCodeId: 'tax-std'
            }
        ]
    };

    it('renders within a printable table wrapper with thead, tbody, and tfoot', () => {
        render(
            <PrintableInvoice
                invoice={mockInvoice}
                customer={mockCustomer}
                vehicle={mockVehicle}
                entity={mockEntity}
                job={mockJob}
                taxRates={mockTaxRates}
                servicePackages={[]}
                inspectionTemplates={[]}
                inspectionDiagrams={[]}
            />
        );

        const tableWrapper = document.querySelector('table.printable-page-wrapper');
        expect(tableWrapper).toBeInTheDocument();

        const thead = tableWrapper?.querySelector('thead.print-header-group');
        expect(thead).toBeInTheDocument();

        const tfoot = tableWrapper?.querySelector('tfoot.print-footer-group');
        expect(tfoot).toBeInTheDocument();

        const tbody = tableWrapper?.querySelector('tbody.print-body-group');
        expect(tbody).toBeInTheDocument();
    });

    it('renders letterhead and invoice reference in repeating thead', () => {
        render(
            <PrintableInvoice
                invoice={mockInvoice}
                customer={mockCustomer}
                vehicle={mockVehicle}
                entity={mockEntity}
                job={mockJob}
                taxRates={mockTaxRates}
                servicePackages={[]}
                inspectionTemplates={[]}
                inspectionDiagrams={[]}
            />
        );

        const thead = document.querySelector('thead.print-header-group');
        expect(thead).toHaveTextContent('Brookspeed Automotive Ltd');
        expect(thead).toHaveTextContent('INV-1001');
        expect(thead).toHaveTextContent('HL24 RCK');
    });

    it('renders running page footer with page counter and legal entity info in tfoot', () => {
        render(
            <PrintableInvoice
                invoice={mockInvoice}
                customer={mockCustomer}
                vehicle={mockVehicle}
                entity={mockEntity}
                job={mockJob}
                taxRates={mockTaxRates}
                servicePackages={[]}
                inspectionTemplates={[]}
                inspectionDiagrams={[]}
            />
        );

        const tfoot = document.querySelector('tfoot.print-footer-group');
        expect(tfoot).toHaveTextContent('Brookspeed Automotive Ltd');
        expect(tfoot).toHaveTextContent('Company Reg No: 09876543');
        expect(tfoot).toHaveTextContent('VAT Reg: GB123456789');
        expect(tfoot).toHaveTextContent('Registered in England & Wales. Thank you for your custom.');
        expect(tfoot?.querySelector('.page-counter')).toBeInTheDocument();
    });

    it('renders customer, vehicle, items, and financial totals inside tbody', () => {
        render(
            <PrintableInvoice
                invoice={mockInvoice}
                customer={mockCustomer}
                vehicle={mockVehicle}
                entity={mockEntity}
                job={mockJob}
                taxRates={mockTaxRates}
                servicePackages={[]}
                inspectionTemplates={[]}
                inspectionDiagrams={[]}
            />
        );

        const tbody = document.querySelector('tbody.print-body-group');
        expect(tbody).toHaveTextContent('Gordon Freeman');
        expect(tbody).toHaveTextContent('Major Annual Service & Diagnostics');
        expect(tbody).toHaveTextContent('Mobil 1 Super Synthetic Engine Oil 0W-40 (8L)');
        expect(tbody).toHaveTextContent('Brembo High Performance Front Brake Discs');
        expect(tbody).toHaveTextContent('TOTAL DUE:');
        expect(tbody?.querySelector('.page-break-inside-avoid')).toBeInTheDocument();
    });
});
