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
 * Designed compactly with zero white-space bloat and minified so transport layers cannot inject stray breaks.
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
        <td style="padding: 8px 10px; font-size: 13px; color: #0f172a; vertical-align: top;">
            <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${packageName}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.3;">
                ${tierData.dmsPackage?.description || tierData.description || 'Comprehensive Workshop Service & Multi-Point Inspection'}
            </div>
        </td>
        <td style="padding: 8px 10px; font-size: 12px; color: #0f172a; text-align: center; font-weight: 700; vertical-align: top;">1</td>
        <td style="padding: 8px 10px; font-size: 12px; color: #0f172a; text-align: right; font-weight: 700; font-family: monospace, sans-serif; vertical-align: top;">${formatCurrency(netTierPrice)}</td>
        <td style="padding: 8px 10px; font-size: 12px; color: #0f172a; text-align: right; font-weight: 800; font-family: monospace, sans-serif; vertical-align: top;">${formatCurrency(netTierPrice)}</td>
    </tr>`;

    // 2. Included Child Component Rows (Parts & Labor included in package rate)
    if (tierData.dmsPackage?.costItems && tierData.dmsPackage.costItems.length > 0) {
        packageLineItemsHtml += tierData.dmsPackage.costItems.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
            <td style="padding: 6px 10px 6px 20px; font-size: 11px; color: #475569;">
                <span style="color: #94a3b8; margin-right: 5px; font-weight: bold;">—</span>
                ${item.description}
                ${item.partNumber && item.partNumber !== 'LABOUR' && item.partNumber !== 'MOT' ? `<span style="margin-left: 5px; font-size: 10px; color: #94a3b8; font-family: monospace;">[${item.partNumber}]</span>` : ''}
                ${item.isLabor ? '<span style="margin-left: 5px; font-size: 9px; color: #64748b; background: #f1f5f9; padding: 1px 4px; border-radius: 2px; font-weight: 700; text-transform: uppercase;">Labour</span>' : ''}
            </td>
            <td style="padding: 6px 10px; font-size: 11px; color: #64748b; text-align: center;">${item.quantity || 1}</td>
            <td style="padding: 6px 10px; font-size: 11px; color: #94a3b8; text-align: right;">-</td>
            <td style="padding: 6px 10px; font-size: 11px; color: #64748b; text-align: right; font-style: italic;">Included</td>
        </tr>`).join('');
    } else if (tierData.highlights && tierData.highlights.length > 0) {
        packageLineItemsHtml += tierData.highlights.map(h => `
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
            <td style="padding: 6px 10px 6px 20px; font-size: 11px; color: #475569;">
                <span style="color: #94a3b8; margin-right: 5px; font-weight: bold;">—</span>
                ${h}
            </td>
            <td style="padding: 6px 10px; font-size: 11px; color: #64748b; text-align: center;">1</td>
            <td style="padding: 6px 10px; font-size: 11px; color: #94a3b8; text-align: right;">-</td>
            <td style="padding: 6px 10px; font-size: 11px; color: #64748b; text-align: right; font-style: italic;">Included</td>
        </tr>`).join('');
    }

    // 3. Bundled Addons Section (Done Together Bundles)
    let addonsHtml = '';
    if (activeAddons.length > 0) {
        addonsHtml = `
        <tr style="background-color: #f1f5f9;">
            <td colspan="4" style="padding: 6px 10px; font-size: 10px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                ADDITIONAL WORK & BUNDLED OPTIONS (DONE TOGETHER DISCOUNT)
            </td>
        </tr>
        ` + activeAddons.map(addon => {
            const netPrice = Math.round((addon.bundledPrice / vatRateMultiplier) * 100) / 100;
            const savingAmount = Math.max(0, addon.standalonePrice - addon.bundledPrice);
            return `
            <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
                <td style="padding: 8px 10px; font-size: 12px; color: #334155;">
                    <div style="font-weight: 700; color: #1e1b4b;">${addon.name}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 1px;">
                        ${addon.description || 'Workshop bundle addition'}
                        ${savingAmount > 0 ? `<span style="margin-left: 5px; color: #059669; font-weight: bold; background: #ecfdf5; padding: 1px 4px; border-radius: 3px; border: 1px solid #a7f3d0; font-size: 9px;">Save £${savingAmount.toFixed(2)}</span>` : ''}
                    </div>
                </td>
                <td style="padding: 8px 10px; font-size: 11px; color: #64748b; text-align: center;">1</td>
                <td style="padding: 8px 10px; font-size: 12px; color: #0f172a; text-align: right; font-family: monospace, sans-serif;">${formatCurrency(netPrice)}</td>
                <td style="padding: 8px 10px; font-size: 12px; color: #0f172a; text-align: right; font-weight: 700; font-family: monospace, sans-serif;">${formatCurrency(netPrice)}</td>
            </tr>`;
        }).join('');
    }

    const origin = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
        ? window.location.origin
        : 'https://intelligent-scheduling-v801.web.app';

    let resolvedLogoUrl = entity.logoUrl || `${origin}/logo.png`;
    if (resolvedLogoUrl.startsWith('/')) {
        resolvedLogoUrl = `${origin}${resolvedLogoUrl}`;
    }

    const companyAddress = [entity.addressLine1, entity.addressLine2, entity.city, entity.postcode].filter(Boolean).join(', ');
    const customerAddress = customer.address || 'Address on file';

    const rawHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking & Estimate Confirmation #${estimateNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 16px 8px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 680px; background-color: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden;">
                    
                    <!-- Top Brand Header with Company Logo -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 16px 20px; border-bottom: 2px solid #e2e8f0;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td valign="middle" style="width: 50%;">
                                        <img src="${resolvedLogoUrl}" alt="${entity.name || 'Brookspeed'}" style="max-height: 52px; max-width: 220px; width: auto; height: auto; display: block; border: 0; outline: none;" />
                                    </td>
                                    <td align="right" valign="middle" style="width: 50%;">
                                        <div style="background-color: #0f172a; border-radius: 6px; padding: 6px 12px; display: inline-block; text-align: right;">
                                            <span style="font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 800; display: block; letter-spacing: 0.05em;">ESTIMATE REF</span>
                                            <span style="font-size: 14px; font-family: monospace, sans-serif; font-weight: 900; color: #38bdf8;">#${estimateNumber}</span>
                                        </div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600;">
                                            ${entity.phone ? `Tel: ${entity.phone}` : ''}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 16px 20px;">

                            <!-- Document Status & Schedule Banner (Information Only - Confirmed) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
                                <tr>
                                    <td>
                                        <span style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; display: block;">
                                            BOOKING & ESTIMATE CONFIRMATION
                                        </span>
                                        <span style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; display: block;">
                                            📅 Scheduled for ${bookingDate}
                                        </span>
                                    </td>
                                    <td align="right" valign="middle">
                                        <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                                            <span style="background-color: #ecfdf5; color: #047857; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; border: 1px solid #a7f3d0; text-transform: uppercase; display: inline-block; margin-right: 8px;">
                                                ✓ BOOKED IN & CONFIRMED
                                            </span>
                                            <div style="background-color: #FFD700; color: #000000; font-family: monospace, Consolas, sans-serif; font-size: 14px; font-weight: 900; padding: 3px 10px; border-radius: 4px; border: 1px solid #b58900; letter-spacing: 1.5px; display: inline-block;">
                                                ${vrm}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <!-- Polite Informational Notice -->
                            <div style="font-size: 12px; color: #475569; margin-bottom: 14px; line-height: 1.4;">
                                Dear <strong>${customer.name}</strong>,<br/>
                                Your vehicle has been scheduled and booked into our workshop for <strong>${bookingDate}</strong>. Please find your confirmed booking details and itemized estimate below for your information and records.
                            </div>

                            <!-- Two Columns: Customer & Vehicle (PDF style) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                                <tr>
                                    <!-- Customer Column -->
                                    <td width="48%" valign="top" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">
                                            CLIENT DETAILS
                                        </div>
                                        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                                            ${customer.name}
                                        </div>
                                        ${customer.companyName ? `<div style="font-size: 11px; font-weight: 700; color: #475569; margin-top: 1px;">${customer.companyName}</div>` : ''}
                                        <div style="font-size: 11px; color: #64748b; margin-top: 3px; line-height: 1.3;">
                                            ${customerAddress}
                                        </div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                                            ${customer.mobile || customer.phone || 'Phone on file'}
                                        </div>
                                        ${customer.email ? `<div style="font-size: 11px; color: #4f46e5; margin-top: 1px;">${customer.email}</div>` : ''}
                                    </td>

                                    <td width="4%">&nbsp;</td>

                                    <!-- Vehicle Column -->
                                    <td width="48%" valign="top" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">
                                            VEHICLE DETAILS
                                        </div>
                                        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                                            ${vehicleDesc}
                                        </div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                                            Registration: <strong style="color: #0f172a; font-family: monospace;">${vrm}</strong>
                                        </div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                                            Recorded Mileage: <strong style="color: #334155;">${vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} miles` : 'Confirmed on drop-off'}</strong>
                                        </div>
                                        ${vehicle.fuelType ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Fuel: <strong style="color: #334155;">${vehicle.fuelType}</strong></div>` : ''}
                                    </td>
                                </tr>
                            </table>

                            <!-- Itemized Estimate Table (Strict PDF & Online Estimate format) -->
                            <div style="margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                                    <thead>
                                        <tr style="background-color: #0f172a; color: #ffffff;">
                                            <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">DESCRIPTION OF WORK</th>
                                            <th style="padding: 8px 10px; text-align: center; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; width: 45px;">QTY</th>
                                            <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; width: 90px;">NET UNIT</th>
                                            <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; width: 95px;">TOTAL (EX VAT)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style="background-color: #f1f5f9;">
                                            <td colspan="4" style="padding: 6px 10px; font-size: 10px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
                                                ESSENTIAL WORK & SERVICE PACKAGES
                                            </td>
                                        </tr>
                                        ${packageLineItemsHtml}
                                        ${addonsHtml}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Financial Totals & Instructions Block -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                                <tr>
                                    <td width="48%" valign="top">
                                        <!-- Notes / Instructions -->
                                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 11px; color: #475569; line-height: 1.4;">
                                            <div style="font-weight: 800; color: #0f172a; margin-bottom: 4px;">Workshop Drop-Off Guidance</div>
                                            <div>Please drop off your vehicle with reception between <strong>8:00 AM & 9:00 AM</strong> on the morning of <strong>${bookingDate}</strong>.</div>
                                            ${bookingNotes ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #334155; font-style: italic;"><strong>Customer Notes:</strong> "${bookingNotes}"</div>` : ''}
                                        </div>
                                    </td>
                                    <td width="4%">&nbsp;</td>
                                    <td width="48%" valign="top">
                                        <!-- Totals Table -->
                                        <table width="100%" cellpadding="3" cellspacing="0" border="0" style="font-size: 12px;">
                                            <tr>
                                                <td style="color: #64748b; font-weight: 600;">Net Subtotal:</td>
                                                <td align="right" style="font-family: monospace, sans-serif; font-weight: 700; color: #0f172a;">${formatCurrency(pricingSummary.totalNet)}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #64748b; font-weight: 600;">VAT (${standardTaxRate}%):</td>
                                                <td align="right" style="font-family: monospace, sans-serif; font-weight: 700; color: #0f172a;">${formatCurrency(pricingSummary.totalVat)}</td>
                                            </tr>
                                            ${pricingSummary.totalSavings > 0 ? `
                                            <tr>
                                                <td style="color: #059669; font-weight: 700;">Bundle Savings Applied:</td>
                                                <td align="right" style="font-family: monospace, sans-serif; font-weight: 800; color: #059669;">-${formatCurrency(pricingSummary.totalSavings)}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td colspan="2" style="padding-top: 6px;">
                                                    <div style="background-color: #0f172a; color: #ffffff; padding: 8px 12px; border-radius: 6px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td style="color: #94a3b8; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Total (Inc. VAT)</td>
                                                                <td align="right" style="font-size: 17px; font-family: monospace, sans-serif; font-weight: 900; color: #ffffff;">${formatCurrency(pricingSummary.totalGross)}</td>
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
                            <!-- Informational Online View (No approval required) -->
                            <div style="text-align: center; margin-bottom: 16px; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
                                    This estimate is provided for your information and records. To review the full itemized specification online:
                                </div>
                                <a href="${onlineViewLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 11px; font-weight: 700; text-decoration: none; padding: 7px 18px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.03em;">
                                    View Online Estimate &rarr;
                                </a>
                            </div>` : ''}

                            <!-- Workshop Location & Entity Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 6px; font-size: 11px; color: #64748b;">
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
                        <td align="center" style="background-color: #f8fafc; padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; line-height: 1.4;">
                            Thank you for booking with ${entity.name}. We look forward to seeing you on ${bookingDate}.<br/>
                            If you need to reschedule or have any questions prior to drop-off, please call us directly on ${entity.phone || 'our reception desk'}.
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    // Minify HTML so that no newlines exist between tags.
    // This completely prevents cloud function transports (which do .replace(/\n/g, '<br>')) from injecting stray line-breaks.
    return rawHtml.replace(/>\s+</g, '><').replace(/[\r\n]+/g, ' ').trim();
};
