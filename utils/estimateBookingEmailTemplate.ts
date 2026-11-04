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
 * Generates an HTML email string formatted to look identical to the workshop's online & PDF estimates and invoices.
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

    const netTierPrice = Math.round((tierData.priceGross / vatRateMultiplier) * 100) / 100;
    const packageName = tierData.dmsPackage?.name || tierData.name;

    // 1. Primary Service Package Header Row (with full Net Unit Price & Total)
    let packageLineItemsHtml = `
    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; font-size: 13px; color: #0f172a;">
            <div style="font-weight: 800; font-size: 14px; color: #0f172a;">
                ${packageName}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px; line-height: 1.4;">
                ${tierData.dmsPackage?.description || tierData.description || 'Comprehensive Workshop Service & Multi-Point Inspection'}
            </div>
        </td>
        <td style="padding: 12px 14px; font-size: 12px; color: #0f172a; text-align: center; font-weight: 700; vertical-align: top;">1</td>
        <td style="padding: 12px 14px; font-size: 12px; color: #0f172a; text-align: right; font-weight: 700; font-family: monospace; vertical-align: top;">${formatCurrency(netTierPrice)}</td>
        <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 800; font-family: monospace; vertical-align: top;">${formatCurrency(netTierPrice)}</td>
    </tr>`;

    // 2. Included Child Component Rows (Parts & Labor included in package rate)
    if (tierData.dmsPackage?.costItems && tierData.dmsPackage.costItems.length > 0) {
        packageLineItemsHtml += tierData.dmsPackage.costItems.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
            <td style="padding: 8px 14px 8px 26px; font-size: 12px; color: #475569;">
                <span style="color: #94a3b8; margin-right: 6px; font-weight: bold;">—</span>
                ${item.description}
                ${item.partNumber && item.partNumber !== 'LABOUR' && item.partNumber !== 'MOT' ? `<span style="margin-left: 6px; font-size: 10px; color: #94a3b8; font-family: monospace;">[${item.partNumber}]</span>` : ''}
                ${item.isLabor ? '<span style="margin-left: 6px; font-size: 9px; color: #64748b; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-weight: 700; text-transform: uppercase;">Labour</span>' : ''}
            </td>
            <td style="padding: 8px 14px; font-size: 11px; color: #64748b; text-align: center;">${item.quantity || 1}</td>
            <td style="padding: 8px 14px; font-size: 11px; color: #94a3b8; text-align: right;">-</td>
            <td style="padding: 8px 14px; font-size: 11px; color: #64748b; text-align: right; font-style: italic;">Included</td>
        </tr>`).join('');
    } else if (tierData.highlights && tierData.highlights.length > 0) {
        packageLineItemsHtml += tierData.highlights.map(h => `
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
            <td style="padding: 8px 14px 8px 26px; font-size: 12px; color: #475569;">
                <span style="color: #94a3b8; margin-right: 6px; font-weight: bold;">—</span>
                ${h}
            </td>
            <td style="padding: 8px 14px; font-size: 11px; color: #64748b; text-align: center;">1</td>
            <td style="padding: 8px 14px; font-size: 11px; color: #94a3b8; text-align: right;">-</td>
            <td style="padding: 8px 14px; font-size: 11px; color: #64748b; text-align: right; font-style: italic;">Included</td>
        </tr>`).join('');
    }

    // 3. Bundled Addons Section (Done Together Bundles)
    let addonsHtml = '';
    if (activeAddons.length > 0) {
        addonsHtml = `
        <tr style="background-color: #f8fafc;">
            <td colspan="4" style="padding: 8px 14px; font-size: 10px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.08em; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                Additional Work & Bundled Options (Done Together Discount)
            </td>
        </tr>
        ` + activeAddons.map(addon => {
            const netPrice = Math.round((addon.bundledPrice / vatRateMultiplier) * 100) / 100;
            const savingAmount = Math.max(0, addon.standalonePrice - addon.bundledPrice);
            return `
            <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
                <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
                    <div style="font-weight: 700; color: #1e1b4b;">${addon.name}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        ${addon.description || 'Workshop bundle addition'}
                        ${savingAmount > 0 ? `<span style="margin-left: 6px; color: #059669; font-weight: bold; background: #ecfdf5; padding: 1px 6px; border-radius: 4px; border: 1px solid #a7f3d0; font-size: 10px;">Save £${savingAmount.toFixed(2)}</span>` : ''}
                    </div>
                </td>
                <td style="padding: 10px 14px; font-size: 12px; color: #64748b; text-align: center;">1</td>
                <td style="padding: 10px 14px; font-size: 12px; color: #0f172a; text-align: right; font-family: monospace;">${formatCurrency(netPrice)}</td>
                <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 700; font-family: monospace;">${formatCurrency(netPrice)}</td>
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
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <!-- Main Document Card -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 720px; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
                    
                    <!-- Top Brand Header (Matching Printable Layout) -->
                    <tr>
                        <td style="background-color: #0f172a; padding: 24px 30px; border-bottom: 3px solid #4f46e5;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td valign="middle">
                                        <div style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 0.03em; text-transform: uppercase;">
                                            ${entity.name || 'BROOKSPEED AUTOMOTIVE'}
                                        </div>
                                        <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">
                                            Porsche & Performance Vehicle Specialists
                                        </div>
                                    </td>
                                    <td align="right" valign="middle">
                                        <div style="display: inline-block; background-color: #1e293b; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; text-align: right;">
                                            <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; display: block; letter-spacing: 0.08em;">ESTIMATE REFERENCE</span>
                                            <span style="font-size: 16px; font-family: monospace; font-weight: 900; color: #38bdf8;">#${estimateNumber}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 28px 30px;">

                            <!-- Document Meta Details Bar (Matching PrintableInvoice / EstimateViewModal) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;">
                                <tr>
                                    <td>
                                        <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; display: block;">
                                            WORKSHOP BOOKING CONFIRMATION
                                        </span>
                                        <span style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 3px; display: block;">
                                            📅 Scheduled for ${bookingDate}
                                        </span>
                                    </td>
                                    <td align="right" valign="middle">
                                        <!-- UK Yellow Number Plate Badge -->
                                        <div style="background-color: #FFD700; color: #000000; font-family: monospace, Consolas, sans-serif; font-size: 16px; font-weight: 900; padding: 4px 12px; border-radius: 4px; border: 1px solid #b58900; letter-spacing: 2px; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                            ${vrm}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <!-- Two Columns: Customer & Vehicle (PDF / Invoice layout) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                                <tr>
                                    <!-- Customer Column -->
                                    <td width="48%" valign="top" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                                            CLIENT DETAILS
                                        </div>
                                        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
                                            ${customer.name}
                                        </div>
                                        ${customer.companyName ? `<div style="font-size: 12px; font-weight: 700; color: #475569; margin-top: 2px;">${customer.companyName}</div>` : ''}
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.4;">
                                            ${customerAddress}
                                        </div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                            ${customer.mobile || customer.phone || 'Phone on file'}
                                        </div>
                                        ${customer.email ? `<div style="font-size: 12px; color: #4f46e5; margin-top: 2px;">${customer.email}</div>` : ''}
                                    </td>

                                    <td width="4%">&nbsp;</td>

                                    <!-- Vehicle Column -->
                                    <td width="48%" valign="top" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                                            VEHICLE SPECIFICATION
                                        </div>
                                        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
                                            ${vehicleDesc}
                                        </div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                                            Current Mileage: <strong style="color: #334155;">${vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} miles` : 'To be confirmed on drop-off'}</strong>
                                        </div>
                                        ${vehicle.year ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Year of Manufacture: <strong style="color: #334155;">${vehicle.year}</strong></div>` : ''}
                                        ${vehicle.fuelType ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Fuel Type: <strong style="color: #334155;">${vehicle.fuelType}</strong></div>` : ''}
                                    </td>
                                </tr>
                            </table>

                            <!-- Itemized Estimate Table (Strict PDF & Online Estimate format) -->
                            <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                                    <thead>
                                        <tr style="background-color: #0f172a; color: #ffffff;">
                                            <th style="padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">Description of Work</th>
                                            <th style="padding: 11px 14px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; width: 50px;">Qty</th>
                                            <th style="padding: 11px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; width: 100px;">Net Unit</th>
                                            <th style="padding: 11px 14px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; width: 110px;">Total (Ex VAT)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style="background-color: #f1f5f9;">
                                            <td colspan="4" style="padding: 8px 14px; font-size: 10px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0;">
                                                ESSENTIAL WORK & SERVICE PACKAGES
                                            </td>
                                        </tr>
                                        ${packageLineItemsHtml}
                                        ${addonsHtml}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Financial Totals & Instructions Block -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td width="46%" valign="top">
                                        <!-- Notes / Instructions -->
                                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; color: #475569; line-height: 1.5;">
                                            <div style="font-weight: 800; color: #0f172a; margin-bottom: 6px;">Workshop Drop-Off Guidance</div>
                                            <div>Please arrive at workshop reception between <strong>8:00 AM & 9:00 AM</strong> on the morning of your booking. A courtesy inspection will be performed with you upon arrival.</div>
                                            ${bookingNotes ? `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #334155; font-style: italic;"><strong>Customer Notes:</strong> "${bookingNotes}"</div>` : ''}
                                        </div>
                                    </td>
                                    <td width="8%">&nbsp;</td>
                                    <td width="46%" valign="top">
                                        <!-- Totals Table -->
                                        <table width="100%" cellpadding="5" cellspacing="0" border="0" style="font-size: 13px;">
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
                                                <td style="color: #059669; font-weight: 700;">Bundle Savings Applied:</td>
                                                <td align="right" style="font-family: monospace; font-weight: 800; color: #059669;">-${formatCurrency(pricingSummary.totalSavings)}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td colspan="2" style="padding-top: 8px;">
                                                    <div style="background-color: #0f172a; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td style="color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Total (Inc. VAT)</td>
                                                                <td align="right" style="font-size: 20px; font-family: monospace; font-weight: 900; color: #ffffff;">${formatCurrency(pricingSummary.totalGross)}</td>
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
                            <div style="text-align: center; margin-bottom: 24px; padding: 22px; background-color: #f5f3ff; border: 2px solid #ddd6fe; border-radius: 12px;">
                                <div style="font-size: 16px; font-weight: 800; color: #4338ca; margin-bottom: 6px;">
                                    Review & Approve Your Estimate Online
                                </div>
                                <div style="font-size: 12px; color: #6d28d9; margin-bottom: 16px; line-height: 1.4;">
                                    You can view the full interactive specification, approve or decline optional items, and authorize work directly through our client portal.
                                </div>
                                <a href="${onlineViewLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.35); text-transform: uppercase; letter-spacing: 0.03em;">
                                    View Estimate Online &rarr;
                                </a>
                            </div>` : ''}

                            <!-- Workshop Location & Entity Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 10px; font-size: 12px; color: #64748b;">
                                <tr>
                                    <td>
                                        <strong style="color: #0f172a;">${entity.name}</strong><br/>
                                        ${companyAddress ? `${companyAddress}<br/>` : ''}
                                        ${entity.phone ? `Tel: <strong>${entity.phone}</strong>` : ''} ${entity.email ? ` • Email: <strong>${entity.email}</strong>` : ''}
                                    </td>
                                    <td align="right" valign="top">
                                        ${entity.vatNumber ? `VAT Reg: <strong>${entity.vatNumber}</strong><br/>` : ''}
                                        Estimated Workshop Labour: <strong>${pricingSummary.totalHours.toFixed(1)} hrs</strong>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- Bottom Sign-off -->
                    <tr>
                        <td align="center" style="background-color: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                            Thank you for choosing ${entity.name}. We look forward to welcoming you on ${bookingDate}.<br/>
                            If you need to reschedule or have questions prior to drop-off, please call us directly on ${entity.phone || 'our service desk'}.
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};
