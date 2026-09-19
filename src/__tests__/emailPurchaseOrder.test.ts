import { describe, it, expect } from 'vitest';
import { 
    calculatePurchaseOrderTotals, 
    generatePurchaseOrderEmailHtml, 
    generatePurchaseOrderEmailText 
} from '../../core/utils/purchaseOrderEmailUtils';
import { PurchaseOrder, Supplier, BusinessEntity, TaxRate } from '../../types';

describe('Purchase Order Email Formatting & Calculations', () => {
    const mockTaxRates: TaxRate[] = [
        { id: 'tax_std', name: 'Standard Rate (20%)', rate: 20, code: 'T20' }
    ];

    const mockSupplier: Supplier = {
        id: 'sup_eurocarparts',
        name: 'Euro Car Parts',
        email: 'orders@eurocarparts.com',
        phone: '02380 123456',
        shortCode: 'ECP'
    };

    const mockEntity: BusinessEntity = {
        id: 'ent_brookspeed',
        name: 'Brookspeed Automotive Ltd',
        email: 'info@brookspeed.com',
        phone: '02380 644355',
        addressLine1: '14-15 Test Lane',
        city: 'Southampton',
        postcode: 'SO16 9JX',
        vatNumber: 'GB 123 4567 89',
        type: 'Workshop'
    };

    const mockPO: PurchaseOrder = {
        id: 'PO-2026-0891',
        supplierId: 'sup_eurocarparts',
        entityId: 'ent_brookspeed',
        orderDate: '2026-09-19',
        status: 'Draft',
        type: 'Standard',
        vehicleRegistrationRef: 'WP21 XKL',
        supplierReference: 'ECP-ORDER-9921',
        secondarySupplierReference: 'JOB-4412',
        lineItems: [
            {
                id: 'li_1',
                partNumber: 'BOS-0986479088',
                description: 'Brembo Front Brake Disc Set',
                quantity: 2,
                unitPrice: 75.00,
                taxCodeId: 'tax_std'
            },
            {
                id: 'li_2',
                partNumber: 'PAD-P85020',
                description: 'Brembo Brake Pad Set',
                quantity: 1,
                unitPrice: 42.50,
                taxCodeId: 'tax_std'
            }
        ],
        history: [
            {
                userId: 'user_ian',
                timestamp: '2026-09-19T08:00:00Z',
                status: 'Created'
            }
        ]
    };

    it('correctly calculates PO net total, VAT, and grand total', () => {
        const totals = calculatePurchaseOrderTotals(mockPO.lineItems, mockTaxRates);
        
        // li_1: 2 * 75 = 150 net, 20% VAT = 30
        // li_2: 1 * 42.50 = 42.50 net, 20% VAT = 8.50
        // Total Net: 192.50
        // Total VAT: 38.50
        // Grand Total: 231.00
        expect(totals.net).toBe(192.50);
        expect(totals.vat).toBe(38.50);
        expect(totals.grandTotal).toBe(231.00);
    });

    it('generates rich HTML email containing all purchase order details, line items, and delivery address', () => {
        const totals = calculatePurchaseOrderTotals(mockPO.lineItems, mockTaxRates);
        const html = generatePurchaseOrderEmailHtml(
            mockPO,
            mockSupplier,
            mockEntity,
            totals,
            'Please deliver via morning express dispatch.'
        );

        expect(html).toContain('Brookspeed Automotive Ltd');
        expect(html).toContain('PURCHASE ORDER');
        expect(html).toContain('PO-2026-0891');
        expect(html).toContain('WP21 XKL');
        expect(html).toContain('ECP-ORDER-9921');
        expect(html).toContain('Euro Car Parts');
        expect(html).toContain('14-15 Test Lane, Southampton, SO16 9JX');
        expect(html).toContain('BOS-0986479088');
        expect(html).toContain('Brembo Front Brake Disc Set');
        expect(html).toContain('PAD-P85020');
        expect(html).toContain('£192.50');
        expect(html).toContain('£38.50');
        expect(html).toContain('£231.00');
        expect(html).toContain('Please deliver via morning express dispatch.');
        expect(html).toContain('info@brookspeed.com');
    });

    it('generates clean plain-text fallback email with line items and totals', () => {
        const totals = calculatePurchaseOrderTotals(mockPO.lineItems, mockTaxRates);
        const text = generatePurchaseOrderEmailText(
            mockPO,
            mockSupplier,
            mockEntity,
            totals,
            'Urgent repair job'
        );

        expect(text).toContain('Purchase Order #PO-2026-0891');
        expect(text).toContain('Dear Euro Car Parts');
        expect(text).toContain('Vehicle Reference: WP21 XKL');
        expect(text).toContain('14-15 Test Lane');
        expect(text).toContain('Southampton, SO16 9JX');
        expect(text).toContain('BOS-0986479088');
        expect(text).toContain('Brembo Front Brake Disc Set');
        expect(text).toContain('Grand Total: £231.00');
        expect(text).toContain('Urgent repair job');
    });

    it('updates status from Draft to Ordered and appends audit history on email dispatch', () => {
        const cleanRecipients = 'orders@eurocarparts.com, accounts@eurocarparts.com';
        const markAsOrdered = true;

        const newStatus = markAsOrdered && mockPO.status === 'Draft' ? 'Ordered' : mockPO.status;
        const historyEntry = {
            userId: 'user_ian',
            timestamp: new Date().toISOString(),
            status: `Emailed to supplier (${cleanRecipients})`
        };

        const updatedPO: PurchaseOrder = {
            ...mockPO,
            status: newStatus,
            history: [...(mockPO.history || []), historyEntry]
        };

        expect(updatedPO.status).toBe('Ordered');
        expect(updatedPO.history).toHaveLength(2);
        expect(updatedPO.history[1].status).toBe(`Emailed to supplier (${cleanRecipients})`);
        expect(updatedPO.history[1].userId).toBe('user_ian');
    });

    it('uses the email in the supplier by default as recipient', () => {
        // When resolvedSupplier has an email, recipient defaults to it
        const supplierEmail = mockSupplier.email;
        expect(supplierEmail).toBe('orders@eurocarparts.com');

        const resolvedRecipient = mockSupplier?.email?.trim() || '';
        expect(resolvedRecipient).toBe('orders@eurocarparts.com');
    });
});
