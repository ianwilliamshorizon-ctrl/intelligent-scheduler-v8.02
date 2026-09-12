import { Invoice, EstimateLineItem, TaxRate, SaleVehicle, Vehicle } from '../../types';

export interface InvoicePaymentStatusInfo {
    isPaid: boolean;
    isPartPaid: boolean;
    isUnpaid: boolean;
    totalPaid: number;
    totalAmount: number;
    balanceDue: number;
    statusLabel: 'Paid' | 'Part Paid' | 'Unpaid';
}

/**
 * Calculates the gross total for an invoice including tax,
 * with fallbacks to stored totals and linked sale vehicle values.
 */
export const getInvoiceGrossTotal = (
    invoice?: Invoice | null,
    taxRates: TaxRate[] = [],
    saleVehicle?: SaleVehicle | null
): number => {
    if (!invoice) return 0;

    const standardTaxRate = taxRates.find(t => t.code === 'T1')?.rate ?? 20;
    const taxRatesMap = new Map(taxRates.map(t => [t.id, t.rate]));

    let lineItemsNet = 0;
    let lineItemsVat = 0;
    const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

    items.forEach((item: EstimateLineItem | any) => {
        if (item.isPackageComponent || item.isOptional) return;
        const qty = item.quantity !== undefined ? item.quantity : 1;
        const price = item.unitPrice !== undefined ? item.unitPrice : (item.totalPrice || 0);
        const net = qty * price;
        lineItemsNet += net;

        const rate = item.taxCodeId ? (taxRatesMap.get(item.taxCodeId) ?? standardTaxRate) : standardTaxRate;
        lineItemsVat += net * (rate / 100);
    });

    const calculatedGross = lineItemsNet + lineItemsVat;
    if (calculatedGross > 0) {
        return Math.round(calculatedGross * 100) / 100;
    }

    // Fallbacks if line items produce 0
    if (typeof invoice.grandTotal === 'number' && invoice.grandTotal > 0) {
        return invoice.grandTotal;
    }
    if (typeof invoice.totalAmount === 'number' && invoice.totalAmount > 0) {
        return invoice.totalAmount;
    }
    if (typeof invoice.totalNet === 'number' && invoice.totalNet > 0) {
        const vat = typeof invoice.totalVat === 'number' ? invoice.totalVat : 0;
        return invoice.totalNet + vat;
    }

    if (saleVehicle) {
        if (typeof saleVehicle.finalSalePrice === 'number' && saleVehicle.finalSalePrice > 0) {
            return saleVehicle.finalSalePrice;
        }
        if (typeof saleVehicle.price === 'number' && saleVehicle.price > 0) {
            return saleVehicle.price;
        }
    }

    return 0;
};

/**
 * Calculates the net total (excluding tax) for an invoice.
 */
export const getInvoiceNetTotal = (
    invoice?: Invoice | null,
    saleVehicle?: SaleVehicle | null
): number => {
    if (!invoice) return 0;

    let lineItemsNet = 0;
    const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

    items.forEach((item: EstimateLineItem | any) => {
        if (item.isPackageComponent || item.isOptional) return;
        const qty = item.quantity !== undefined ? item.quantity : 1;
        const price = item.unitPrice !== undefined ? item.unitPrice : (item.totalPrice || 0);
        lineItemsNet += qty * price;
    });

    if (lineItemsNet > 0) {
        return Math.round(lineItemsNet * 100) / 100;
    }

    if (typeof invoice.totalNet === 'number' && invoice.totalNet > 0) {
        return invoice.totalNet;
    }
    if (typeof invoice.totalAmount === 'number' && invoice.totalAmount > 0) {
        return invoice.totalAmount;
    }
    if (typeof invoice.grandTotal === 'number' && invoice.grandTotal > 0) {
        return invoice.grandTotal;
    }

    if (saleVehicle) {
        if (typeof saleVehicle.finalSalePrice === 'number' && saleVehicle.finalSalePrice > 0) {
            return saleVehicle.finalSalePrice;
        }
        if (typeof saleVehicle.price === 'number' && saleVehicle.price > 0) {
            return saleVehicle.price;
        }
    }

    return 0;
};

/**
 * Evaluates the payment status (Paid, Part Paid, or Unpaid),
 * along with total paid, balance due, and boolean flags.
 */
export const getInvoicePaymentStatus = (
    invoice?: Invoice | null,
    totalAmount?: number
): InvoicePaymentStatusInfo => {
    if (!invoice) {
        return {
            isPaid: false,
            isPartPaid: false,
            isUnpaid: true,
            totalPaid: 0,
            totalAmount: 0,
            balanceDue: 0,
            statusLabel: 'Unpaid'
        };
    }

    const total = totalAmount !== undefined ? totalAmount : (invoice.grandTotal || invoice.totalAmount || 0);
    const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
    const totalPaid = payments.reduce((sum, p) => sum + (typeof p.amount === 'number' ? p.amount : 0), 0);

    // If invoice status is explicitly Paid, or if paid in full (with tolerance for rounding)
    const isExplicitlyPaid = invoice.status === 'Paid';
    const isPaidInFull = total > 0 && totalPaid >= (total - 0.01);

    if (isExplicitlyPaid || isPaidInFull) {
        return {
            isPaid: true,
            isPartPaid: false,
            isUnpaid: false,
            totalPaid: Math.max(totalPaid, isExplicitlyPaid ? total : totalPaid),
            totalAmount: total,
            balanceDue: 0,
            statusLabel: 'Paid'
        };
    }

    if (totalPaid > 0.01 && totalPaid < total) {
        return {
            isPaid: false,
            isPartPaid: true,
            isUnpaid: false,
            totalPaid,
            totalAmount: total,
            balanceDue: Math.max(0, Math.round((total - totalPaid) * 100) / 100),
            statusLabel: 'Part Paid'
        };
    }

    return {
        isPaid: false,
        isPartPaid: false,
        isUnpaid: true,
        totalPaid,
        totalAmount: total,
        balanceDue: total,
        statusLabel: 'Unpaid'
    };
};

/**
 * Ensures a sales invoice has at least one valid line item representing the vehicle sale.
 */
export const synthesizeSalesInvoiceLineItems = (
    invoice: Invoice,
    vehicle?: Vehicle | null,
    saleVehicle?: SaleVehicle | null,
    taxRateId?: string
): EstimateLineItem[] => {
    const existingItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    if (existingItems.length > 0) {
        return existingItems;
    }

    const price = (
        saleVehicle?.finalSalePrice ||
        saleVehicle?.price ||
        invoice.grandTotal ||
        invoice.totalAmount ||
        invoice.totalNet ||
        0
    );

    const vehicleDesc = vehicle 
        ? `${vehicle.make} ${vehicle.model} (${vehicle.registration})`
        : (saleVehicle ? `${saleVehicle.make || ''} ${saleVehicle.model || ''} (${saleVehicle.registration || ''})`.trim() : 'Vehicle Sale');

    return [
        {
            id: 'li_sale_primary',
            description: `Vehicle Sale: ${vehicleDesc}`,
            quantity: 1,
            unitPrice: price,
            isLabor: false,
            taxCodeId: taxRateId
        }
    ];
};
