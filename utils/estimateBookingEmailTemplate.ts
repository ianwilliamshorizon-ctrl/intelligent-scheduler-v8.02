import { ServicePackage } from '../types';
import { BookingScriptAddon } from '../core/services/bookingAssistantConfigService';
import { formatCurrency } from './formatUtils';

export interface EstimateBookingEmailData {
    estimateNumber: string;
    estimateId?: string;
    bookingDate: string;
    bookingNotes?: string;
    entity: {
        name: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        postcode?: string;
        phone?: string;
        email?: string;
        vatNumber?: string;
        logoUrl?: string;
    };
    customer: {
        name: string;
        companyName?: string;
        address?: string;
        phone?: string;
        mobile?: string;
        email?: string;
    };
    vehicle: {
        registration?: string;
        make?: string;
        model?: string;
        year?: number | string;
        mileage?: number | string;
        fuelType?: string;
        engineSize?: string;
    };
    tierData: {
        name: string;
        description?: string;
        priceGross: number;
        hours: number;
        dmsPackage?: ServicePackage | null;
        highlights?: string[];
    };
    activeAddons: BookingScriptAddon[];
    pricingSummary: {
        tierGross: number;
        addonsGross: number;
        totalGross: number;
        totalNet: number;
        totalVat: number;
        totalSavings: number;
        totalHours: number;
    };
    standardTaxRate?: number;
    onlineViewLink?: string;
}

/**
 * Generates an HTML email string formatted to look like the workshop's online & PDF estimates and invoices.
 */
export const generateEstimateBookingEmailHtml = (data: EstimateBookingEmailData): string => {
    const {
        estimateNumber,
        bookingDate,
        bookingNotes,
        entity,
        customer,
        vehicle,
        tierData,
        activeAddons,
        pricingSummary,
        standardTaxRate = 20,
        onlineViewLink
    } = data;

    const vrm = (vehicle.registration || 'TBA').toUpperCase().trim();
    const vehicleDesc = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
    const vatRateMultiplier = 1 + (standardTaxRate / 100);

    // Build package items
    let packageLineItemsHtml = '';
    if (tierData.dmsPackage?.costItems && tierData.dmsPackage.costItems.length > 0) {
        packageLineItemsHtml = tierData.dmsPackage.costItems.map((item, idx) => {
            const isChild = idx > 0;
            const itemPriceNet = item.unitPrice ? (item.unitPrice * (item.quantity || 1)) : 0;
            const priceDisplay = itemPriceNet > 0 
                ? formatCurrency(itemPriceNet) 
                : `<span style="color: #94a3b8; font-style: italic; font-size: 11px;">Included</span>`;

            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
                    <div style="font-weight: ${isChild ? 'normal' : '600'}; padding-left: ${isChild ? '12px' : '0'};">
                        ${isChild ? '<span style="color: #94a3b8; margin-right: 6px;">↳</span>' : ''}
                        ${item.description}
                        ${item.isLabor ? '<span style="margin-left: 6px; font-size: 10px; color: #64748b; background: #f1f5f9; padding: 1px 5px; border-radius: 3px;">Labour</span>' : ''}
                    </div>
                </td>
                <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: center;">${item.quantity || 1}</td>
                <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: right;">${item.unitPrice ? formatCurrency(item.unitPrice) : '-'}</td>
                <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${priceDisplay}</td>
            </tr>`;
        }).join('');
    } else {
        const netTierPrice = Math.round((tierData.priceGross / vatRateMultiplier) * 100) / 100;
        packageLineItemsHtml = `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
                <div style="font-weight: 600;">${tierData.name}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Comprehensive Workshop Service & Multi-Point Inspection</div>
            </td>
            <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: center;">${tierData.hours ? `${tierData.hours}h` : '1'}</td>
            <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: right;">${formatCurrency(netTierPrice)}</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatCurrency(netTierPrice)}</td>
        </tr>`;
    }

    // Build Addons HTML
    let addonsHtml = '';
    if (activeAddons.length > 0) {
        addonsHtml = `
        <tr style="background-color: #f8fafc;">
            <td colspan="4" style="padding: 8px 14px; font-size: 10px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.08em; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                Bundled Add-Ons (Done Together Discount)
            </td>
        </tr>
        ` + activeAddons.map(addon => {
            const netPrice = Math.round((addon.bundledPrice / vatRateMultiplier) * 100) / 100;
            const savingAmount = Math.max(0, addon.standalonePrice - addon.bundledPrice);
            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
                    <div style="font-weight: 600; color: #1e1b4b;">${addon.name}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        ${addon.description || 'Workshop bundle addition'}
                        ${savingAmount > 0 ? `<span style="margin-left: 6px; color: #059669; font-weight: bold; background: #ecfdf5; padding: 1px 6px; border-radius: 4px; border: 1px solid #a7f3d0; font-size: 10px;">Save £${savingAmount.toFixed(2)}</span>` : ''}
                    </div>
                </td>
                <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: center;">1</td>
                <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: right;">${formatCurrency(netPrice)}</td>
                <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatCurrency(netPrice)}</td>
            </tr>`;
        }).join('');
    }

    const companyAddress = [entity.addressLine1, entity.addressLine2, entity.city, entity.postcode].filter(Boolean).join(', ');
    const customerAddress = customer.address || 'Address on file';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estimate & Booking Confirmation #${estimateNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 680px; background-color: #ffffff; border-radius: 14px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
                    
                    <!-- Top Brand Bar -->
                    <tr>
                        <td style="background-color: #0f172a; padding: 24px 30px; border-bottom: 3px solid #4f46e5;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td valign="middle">
                                        <div style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 0.03em; text-transform: uppercase;">
                                            ${entity.name || 'BROOKSPEED'}
                                        </div>
                                        <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 4px;">
                                            Automotive Service & Performance Excellence
                                        </div>
                                    </td>
                                    <td align="right" valign="middle">
                                        <div style="display: inline-block; background-color: #1e293b; border: 1px solid #334155; padding: 6px 14px; border-radius: 8px;">
                                            <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; letter-spacing: 0.05em;">Estimate Ref</span>
                                            <span style="font-size: 15px; font-family: monospace; font-weight: 900; color: #38bdf8;">#${estimateNumber}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 28px 30px;">

                            <!-- Document Title & Status Banner -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;">
                                <tr>
                                    <td>
                                        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">
                                            Booking & Estimate Confirmation
                                        </div>
                                        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                                            Scheduled for ${bookingDate}
                                        </div>
                                    </td>
                                    <td align="right">
                                        <span style="background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 20px; border: 1px solid #a7f3d0; text-transform: uppercase; letter-spacing: 0.04em; display: inline-block;">
                                            ✓ Reserved
                                        </span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Two Columns: Customer & Vehicle (PDF style) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                                <tr>
                                    <!-- Customer Column -->
                                    <td width="48%" valign="top" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                                            Client Details
                                        </div>
                                        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
                                            ${customer.name}
                                        </div>
                                        ${customer.companyName ? `<div style="font-size: 12px; font-weight: 600; color: #475569; margin-top: 1px;">${customer.companyName}</div>` : ''}
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.4;">
                                            ${customerAddress}
                                        </div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                            ${customer.mobile || customer.phone || 'Phone on file'}
                                        </div>
                                        ${customer.email ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">${customer.email}</div>` : ''}
                                    </td>

                                    <td width="4%">&nbsp;</td>

                                    <!-- Vehicle Column -->
                                    <td width="48%" valign="top" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                                            Vehicle Information
                                        </div>
                                        <div style="margin-bottom: 8px;">
                                            <span style="background-color: #FFD700; color: #000000; font-family: monospace, Consolas, sans-serif; font-size: 15px; font-weight: 900; padding: 3px 10px; border-radius: 4px; border: 1px solid #cca000; letter-spacing: 1.5px; display: inline-block;">
                                                ${vrm}
                                            </span>
                                        </div>
                                        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
                                            ${vehicleDesc}
                                        </div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                                            Mileage: <strong style="color: #334155;">${vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} miles` : 'Recorded upon drop-off'}</strong>
                                        </div>
                                        ${vehicle.fuelType ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Fuel: ${vehicle.fuelType}</div>` : ''}
                                    </td>
                                </tr>
                            </table>

                            <!-- Itemized Estimate Table (Matching PDF / Online format) -->
                            <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                                    <thead>
                                        <tr style="background-color: #0f172a; color: #ffffff;">
                                            <th style="padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">Description of Work</th>
                                            <th style="padding: 11px 14px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; width: 50px;">Qty</th>
                                            <th style="padding: 11px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; width: 90px;">Net Unit</th>
                                            <th style="padding: 11px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; width: 90px;">Total (Ex VAT)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style="background-color: #f8fafc;">
                                            <td colspan="4" style="padding: 8px 14px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0;">
                                                Primary Workshop Service
                                            </td>
                                        </tr>
                                        ${packageLineItemsHtml}
                                        ${addonsHtml}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Financial Totals Block (Matching invoice/estimate layout) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td width="45%" valign="top">
                                        <!-- Notes / Instructions -->
                                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; color: #475569;">
                                            <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Service Reception Notes</div>
                                            <div>Please drop vehicle with reception between <strong>8:00 AM & 9:00 AM</strong> on the morning of your booking.</div>
                                            ${bookingNotes ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #334155; font-style: italic;">"${bookingNotes}"</div>` : ''}
                                        </div>
                                    </td>
                                    <td width="10%">&nbsp;</td>
                                    <td width="45%" valign="top">
                                        <!-- Totals Table -->
                                        <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px;">
                                            <tr>
                                                <td style="color: #64748b; font-weight: 600;">Net Subtotal:</td>
                                                <td align="right" style="font-family: monospace; font-weight: 700; color: #0f172a;">${formatCurrency(pricingSummary.totalNet)}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #64748b; font-weight: 600;">VAT (${standardTaxRate}%):</td>
                                                <td align="right" style="font-family: monospace; font-weight: 700; color: #0f172a;">${formatCurrency(pricingSummary.totalVat)}</td>
                                            </tr>
                                            ${pricingSummary.totalSavings > 0 ? `
                                            <tr>
                                                <td style="color: #059669; font-weight: 700;">Bundle Discount Saved:</td>
                                                <td align="right" style="font-family: monospace; font-weight: 800; color: #059669;">-${formatCurrency(pricingSummary.totalSavings)}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td colspan="2" style="padding-top: 8px;">
                                                    <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: baseline;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td style="color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Total Payable (Inc. VAT)</td>
                                                                <td align="right" style="font-size: 19px; font-family: monospace; font-weight: 900; color: #ffffff;">${formatCurrency(pricingSummary.totalGross)}</td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            ${onlineViewLink ? `
                            <!-- Interactive Online View Call to Action Button -->
                            <div style="text-align: center; margin-bottom: 24px; padding: 20px; background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px;">
                                <div style="font-size: 15px; font-weight: 800; color: #4338ca; margin-bottom: 6px;">
                                    View & Authorize Your Estimate Online
                                </div>
                                <div style="font-size: 12px; color: #6d28d9; margin-bottom: 14px;">
                                    You can inspect individual items, approve recommended options, or check work progress directly through our secure client portal.
                                </div>
                                <a href="${onlineViewLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);">
                                    Open Online Estimate &rarr;
                                </a>
                            </div>` : ''}

                            <!-- Workshop Location & Contact -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 10px; font-size: 12px; color: #64748b;">
                                <tr>
                                    <td>
                                        <strong style="color: #0f172a;">${entity.name}</strong><br/>
                                        ${companyAddress ? `${companyAddress}<br/>` : ''}
                                        ${entity.phone ? `Tel: ${entity.phone}` : ''} ${entity.email ? `• Email: ${entity.email}` : ''}
                                    </td>
                                    <td align="right" valign="top">
                                        ${entity.vatNumber ? `VAT Reg: <strong>${entity.vatNumber}</strong><br/>` : ''}
                                        Estimated Labour Time: <strong>${pricingSummary.totalHours.toFixed(1)} hrs</strong>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- Bottom Sign-off -->
                    <tr>
                        <td align="center" style="background-color: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                            Thank you for choosing ${entity.name}. We look forward to seeing you on ${bookingDate}.<br/>
                            If you need to reschedule or have any questions, please contact our service team on ${entity.phone || 'our reception number'}.
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};
