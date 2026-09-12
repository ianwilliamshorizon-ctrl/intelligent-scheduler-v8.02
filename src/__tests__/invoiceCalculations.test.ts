import { describe, it, expect } from 'vitest';
import { 
    getInvoiceGrossTotal, 
    getInvoiceNetTotal, 
    getInvoicePaymentStatus, 
    synthesizeSalesInvoiceLineItems 
} from '../../core/utils/invoiceCalculations';
import { Invoice, TaxRate, SaleVehicle, Vehicle } from '../../types';

describe('invoiceCalculations', () => {
    const mockTaxRates: TaxRate[] = [
        { id: 'tax_1', code: 'T1', name: 'Standard Rate', rate: 20 },
        { id: 'tax_0', code: 'T0', name: 'Zero Rate', rate: 0 }
    ];

    describe('getInvoiceGrossTotal', () => {
        it('calculates gross total from line items and VAT rate', () => {
            const invoice: Invoice = {
                id: 'INV-001',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [
                    { id: '1', description: 'Item 1', quantity: 2, unitPrice: 100, taxCodeId: 'tax_1' }
                ],
                payments: []
            };

            // Net: 200, VAT: 40 -> Gross: 240
            expect(getInvoiceGrossTotal(invoice, mockTaxRates)).toBe(240);
        });

        it('falls back to grandTotal if line items are empty', () => {
            const invoice: Invoice = {
                id: 'INV-002',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [],
                grandTotal: 15500,
                payments: []
            };

            expect(getInvoiceGrossTotal(invoice, mockTaxRates)).toBe(15500);
        });

        it('falls back to totalAmount if line items are empty and grandTotal is absent', () => {
            const invoice: Invoice = {
                id: 'INV-003',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [],
                totalAmount: 18750,
                payments: []
            };

            expect(getInvoiceGrossTotal(invoice, mockTaxRates)).toBe(18750);
        });

        it('falls back to linked saleVehicle.finalSalePrice if invoice line items and stored totals are zero', () => {
            const invoice: Invoice = {
                id: 'INV-004',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                saleVehicleId: 'sale_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [],
                payments: []
            };

            const saleVehicle: SaleVehicle = {
                id: 'sale_1',
                status: 'Sold',
                finalSalePrice: 22000
            };

            expect(getInvoiceGrossTotal(invoice, mockTaxRates, saleVehicle)).toBe(22000);
        });

        it('falls back to saleVehicle.price if finalSalePrice is not set', () => {
            const invoice: Invoice = {
                id: 'INV-005',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                saleVehicleId: 'sale_2',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [],
                payments: []
            };

            const saleVehicle: SaleVehicle = {
                id: 'sale_2',
                status: 'Available',
                price: 29995
            };

            expect(getInvoiceGrossTotal(invoice, mockTaxRates, saleVehicle)).toBe(29995);
        });

        it('returns 0 if invoice is null or completely empty', () => {
            expect(getInvoiceGrossTotal(null, mockTaxRates)).toBe(0);
        });
    });

    describe('getInvoicePaymentStatus', () => {
        it('marks invoice as Paid if invoice.status is explicitly Paid', () => {
            const invoice: Invoice = {
                id: 'INV-PAID-1',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Paid',
                lineItems: [],
                totalAmount: 1000,
                payments: []
            };

            const status = getInvoicePaymentStatus(invoice, 1000);
            expect(status.isPaid).toBe(true);
            expect(status.isUnpaid).toBe(false);
            expect(status.isPartPaid).toBe(false);
            expect(status.statusLabel).toBe('Paid');
            expect(status.balanceDue).toBe(0);
        });

        it('marks invoice as Paid if payments sum matches or exceeds total', () => {
            const invoice: Invoice = {
                id: 'INV-PAID-2',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Sent',
                lineItems: [],
                totalAmount: 500,
                payments: [
                    { amount: 200, date: '2026-09-02', method: 'Bank Transfer' },
                    { amount: 300, date: '2026-09-03', method: 'Card' }
                ]
            };

            const status = getInvoicePaymentStatus(invoice, 500);
            expect(status.isPaid).toBe(true);
            expect(status.statusLabel).toBe('Paid');
            expect(status.balanceDue).toBe(0);
        });

        it('marks invoice as Part Paid with correct balance due', () => {
            const invoice: Invoice = {
                id: 'INV-PART-1',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Part Paid',
                lineItems: [],
                totalAmount: 1000,
                payments: [
                    { amount: 350, date: '2026-09-02', method: 'Bank Transfer' }
                ]
            };

            const status = getInvoicePaymentStatus(invoice, 1000);
            expect(status.isPaid).toBe(false);
            expect(status.isPartPaid).toBe(true);
            expect(status.isUnpaid).toBe(false);
            expect(status.statusLabel).toBe('Part Paid');
            expect(status.totalPaid).toBe(350);
            expect(status.balanceDue).toBe(650);
        });

        it('marks invoice as Unpaid if no payments are made', () => {
            const invoice: Invoice = {
                id: 'INV-UNPAID-1',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Sent',
                lineItems: [],
                totalAmount: 1200,
                payments: []
            };

            const status = getInvoicePaymentStatus(invoice, 1200);
            expect(status.isPaid).toBe(false);
            expect(status.isPartPaid).toBe(false);
            expect(status.isUnpaid).toBe(true);
            expect(status.statusLabel).toBe('Unpaid');
            expect(status.balanceDue).toBe(1200);
        });
    });

    describe('synthesizeSalesInvoiceLineItems', () => {
        it('returns existing line items if already present', () => {
            const invoice: Invoice = {
                id: 'INV-EXISTING',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [
                    { id: 'li-1', description: 'Existing Service', quantity: 1, unitPrice: 500 }
                ],
                payments: []
            };

            const items = synthesizeSalesInvoiceLineItems(invoice);
            expect(items).toHaveLength(1);
            expect(items[0].description).toBe('Existing Service');
        });

        it('synthesizes vehicle line item from vehicle and saleVehicle data when line items is empty', () => {
            const invoice: Invoice = {
                id: 'INV-EMPTY',
                vehicleId: 'veh_1',
                customerId: 'cust_1',
                issueDate: '2026-09-01',
                dueDate: '2026-09-30',
                status: 'Draft',
                lineItems: [],
                payments: []
            };

            const vehicle: Vehicle = {
                id: 'veh_1',
                registration: 'AB21 XYZ',
                make: 'Porsche',
                model: '911 GT3',
                customerId: 'cust_1'
            };

            const saleVehicle: SaleVehicle = {
                id: 'sale_1',
                status: 'Sold',
                finalSalePrice: 145000
            };

            const items = synthesizeSalesInvoiceLineItems(invoice, vehicle, saleVehicle);
            expect(items).toHaveLength(1);
            expect(items[0].description).toContain('Porsche 911 GT3 (AB21 XYZ)');
            expect(items[0].unitPrice).toBe(145000);
            expect(items[0].quantity).toBe(1);
        });
    });
});
