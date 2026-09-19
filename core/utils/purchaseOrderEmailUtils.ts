import { PurchaseOrder, Supplier, BusinessEntity, TaxRate } from '../../types';

export interface PurchaseOrderTotals {
    net: number;
    vat: number;
    grandTotal: number;
}

export const calculatePurchaseOrderTotals = (
    poOrLineItems: PurchaseOrder | { lineItems?: PurchaseOrder['lineItems'] } | PurchaseOrder['lineItems'],
    taxRates?: TaxRate[]
): PurchaseOrderTotals => {
    const taxMap = new Map<string, number>();
    (taxRates || []).forEach(tr => {
        if (tr.id && typeof tr.rate === 'number') {
            taxMap.set(tr.id, tr.rate);
        }
    });

    let net = 0;
    let vat = 0;

    const items = Array.isArray(poOrLineItems) 
        ? poOrLineItems 
        : (poOrLineItems?.lineItems || []);

    (items || []).forEach(item => {
        const itemNet = (item.unitPrice || 0) * (item.quantity || 0);
        const rate = item.taxCodeId ? (taxMap.get(item.taxCodeId) ?? 20) : 20;
        const itemVat = itemNet * (rate / 100);
        net += itemNet;
        vat += itemVat;
    });

    return {
        net,
        vat,
        grandTotal: net + vat
    };
};

export const generatePurchaseOrderEmailText = (
    purchaseOrder: PurchaseOrder,
    supplier: Supplier | null | undefined,
    entity: BusinessEntity,
    totals: PurchaseOrderTotals,
    customNotes?: string
): string => {
    const poNum = purchaseOrder.poNumber || purchaseOrder.id;
    const dateStr = purchaseOrder.orderDate 
        ? new Date(purchaseOrder.orderDate).toLocaleDateString('en-GB') 
        : new Date().toLocaleDateString('en-GB');

    const lines = (purchaseOrder.lineItems || []).map((item, idx) => {
        const itemTotal = ((item.unitPrice || 0) * (item.quantity || 0)).toFixed(2);
        const desc = item.description || 'Part';
        const partNo = item.partNumber ? `[${item.partNumber}] ` : '';
        return `${idx + 1}. ${partNo}${desc} - Qty: ${item.quantity || 1} @ £${(item.unitPrice || 0).toFixed(2)} = £${itemTotal}`;
    }).join('\n');

    return `Dear ${supplier?.contactName || supplier?.name || 'Supplier'},

Please find below our Purchase Order #${poNum} from ${entity.name}.

PURCHASE ORDER DETAILS:
----------------------------------------
PO Number: #${poNum}
Date: ${dateStr}
Vehicle Reference: ${purchaseOrder.vehicleRegistrationRef || 'Stock'}
${purchaseOrder.supplierReference ? `Supplier Reference: ${purchaseOrder.supplierReference}\n` : ''}${purchaseOrder.secondarySupplierReference ? `Secondary Reference: ${purchaseOrder.secondarySupplierReference}\n` : ''}${purchaseOrder.expectedDeliveryDate ? `Required Delivery Date: ${purchaseOrder.expectedDeliveryDate}\n` : ''}
DELIVER TO:
${entity.name}
${entity.addressLine1 || ''}
${entity.city ? `${entity.city}, ` : ''}${entity.postcode || ''}
${entity.vatNumber ? `VAT Reg: ${entity.vatNumber}\n` : ''}
ORDER ITEMS:
----------------------------------------
${lines || 'No items listed'}
----------------------------------------
Net Total: £${totals.net.toFixed(2)}
VAT (20%): £${totals.vat.toFixed(2)}
Grand Total: £${totals.grandTotal.toFixed(2)}

${customNotes ? `SPECIAL INSTRUCTIONS / NOTES:\n${customNotes}\n\n` : ''}${purchaseOrder.notes ? `ADDITIONAL NOTES:\n${purchaseOrder.notes}\n\n` : ''}Please confirm receipt of this order and advise on estimated delivery.

Kind regards,
The ${entity.name} Team
${entity.email || 'info@brookspeed.com'}
`;
};

export const generatePurchaseOrderEmailHtml = (
    purchaseOrder: PurchaseOrder,
    supplier: Supplier | null | undefined,
    entity: BusinessEntity,
    totals: PurchaseOrderTotals,
    customNotes?: string
): string => {
    const poNum = purchaseOrder.poNumber || purchaseOrder.id;
    const dateStr = purchaseOrder.orderDate 
        ? new Date(purchaseOrder.orderDate).toLocaleDateString('en-GB') 
        : new Date().toLocaleDateString('en-GB');

    const lineItemRows = (purchaseOrder.lineItems || []).map((item, index) => {
        const itemTotal = ((item.unitPrice || 0) * (item.quantity || 0)).toFixed(2);
        const bg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        return `
        <tr style="background-color:${bg};">
            <td style="padding:10px 12px;font-size:13px;color:#1E293B;font-family:monospace;font-weight:700;border-bottom:1px solid #E2E8F0;">${item.partNumber || '-'}</td>
            <td style="padding:10px 12px;font-size:13px;color:#334155;border-bottom:1px solid #E2E8F0;">${item.description || 'Part'}</td>
            <td style="padding:10px 12px;font-size:13px;color:#0F172A;text-align:center;font-weight:700;border-bottom:1px solid #E2E8F0;">${item.quantity || 1}</td>
            <td style="padding:10px 12px;font-size:13px;color:#334155;text-align:right;border-bottom:1px solid #E2E8F0;">£${(item.unitPrice || 0).toFixed(2)}</td>
            <td style="padding:10px 12px;font-size:13px;color:#0F172A;text-align:right;font-weight:700;border-bottom:1px solid #E2E8F0;">£${itemTotal}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Purchase Order #${poNum}</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;background-color:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);border:1px solid #CBD5E1;">
  
  <!-- Header Banner -->
  <tr>
    <td style="background-color:#0F172A;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);padding:24px 28px;color:#FFFFFF;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#93C5FD;text-transform:uppercase;">OFFICIAL PURCHASE ORDER</div>
            <h1 style="margin:4px 0 0 0;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.4px;">${entity.name}</h1>
            <p style="margin:6px 0 0 0;font-size:12px;color:#94A3B8;line-height:1.4;">
              ${entity.addressLine1 ? `${entity.addressLine1}, ` : ''}${entity.city ? `${entity.city}, ` : ''}${entity.postcode || ''}
              ${entity.vatNumber ? `<br>VAT Registration: <strong style="color:#CBD5E1;">${entity.vatNumber}</strong>` : ''}
            </p>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <div style="display:inline-block;background-color:#1E3A8A;padding:8px 16px;border-radius:10px;border:1px solid #3B82F6;">
              <span style="display:block;font-size:10px;text-transform:uppercase;color:#93C5FD;font-weight:800;letter-spacing:1px;">PO NUMBER</span>
              <span style="font-size:18px;font-weight:900;color:#FFFFFF;font-family:monospace;">#${poNum}</span>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Order & Supplier Metadata -->
  <tr>
    <td style="padding:22px 28px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <!-- Supplier Details -->
          <td width="50%" style="vertical-align:top;padding-right:16px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#64748B;text-transform:uppercase;margin-bottom:6px;">SUPPLIER</div>
            <div style="background-color:#FFFFFF;padding:14px;border-radius:10px;border:1px solid #E2E8F0;">
              <strong style="font-size:14px;color:#0F172A;display:block;margin-bottom:4px;">${supplier?.name || 'Supplier'}</strong>
              ${supplier?.contactName ? `<div style="font-size:12px;color:#475569;">Attn: ${supplier.contactName}</div>` : ''}
              ${supplier?.addressLine1 ? `<div style="font-size:12px;color:#475569;">${supplier.addressLine1}</div>` : ''}
              ${supplier?.city || supplier?.postcode ? `<div style="font-size:12px;color:#475569;">${supplier.city ? `${supplier.city}, ` : ''}${supplier.postcode || ''}</div>` : ''}
              ${supplier?.email ? `<div style="font-size:12px;color:#2563EB;margin-top:4px;">${supplier.email}</div>` : ''}
            </div>
          </td>

          <!-- Delivery & Order Reference Details -->
          <td width="50%" style="vertical-align:top;padding-left:16px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#64748B;text-transform:uppercase;margin-bottom:6px;">DELIVERY & REFERENCES</div>
            <div style="background-color:#FFFFFF;padding:14px;border-radius:10px;border:1px solid #E2E8F0;">
              <table border="0" cellpadding="2" cellspacing="0" width="100%" style="font-size:12px;">
                <tr>
                  <td style="color:#64748B;font-weight:600;">Order Date:</td>
                  <td style="text-align:right;font-weight:700;color:#0F172A;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-weight:600;">Vehicle Ref:</td>
                  <td style="text-align:right;font-weight:800;color:#1E40AF;font-family:monospace;">${purchaseOrder.vehicleRegistrationRef || 'Stock'}</td>
                </tr>
                ${purchaseOrder.supplierReference ? `
                <tr>
                  <td style="color:#64748B;font-weight:600;">Supplier Ref:</td>
                  <td style="text-align:right;font-weight:700;color:#0F172A;">${purchaseOrder.supplierReference}</td>
                </tr>` : ''}
                ${purchaseOrder.expectedDeliveryDate ? `
                <tr>
                  <td style="color:#64748B;font-weight:600;">Required By:</td>
                  <td style="text-align:right;font-weight:700;color:#DC2626;">${purchaseOrder.expectedDeliveryDate}</td>
                </tr>` : ''}
              </table>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Line Items Table -->
  <tr>
    <td style="padding:24px 28px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background-color:#0F172A;color:#FFFFFF;">
            <th style="padding:10px 12px;font-size:11px;text-align:left;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Part Number</th>
            <th style="padding:10px 12px;font-size:11px;text-align:left;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Description</th>
            <th style="padding:10px 12px;font-size:11px;text-align:center;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Qty</th>
            <th style="padding:10px 12px;font-size:11px;text-align:right;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Unit Price</th>
            <th style="padding:10px 12px;font-size:11px;text-align:right;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemRows || `
          <tr>
            <td colspan="5" style="padding:20px;text-align:center;color:#64748B;font-size:13px;">No line items specified.</td>
          </tr>`}
        </tbody>
      </table>

      <!-- Totals Section -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;">
        <tr>
          <td width="55%"></td>
          <td width="45%">
            <table border="0" cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;">
              <tr>
                <td style="color:#64748B;font-weight:600;">Net Subtotal:</td>
                <td style="text-align:right;font-weight:700;color:#0F172A;">£${totals.net.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color:#64748B;font-weight:600;">VAT (20%):</td>
                <td style="text-align:right;font-weight:700;color:#0F172A;">£${totals.vat.toFixed(2)}</td>
              </tr>
              <tr style="border-top:2px solid #0F172A;">
                <td style="color:#0F172A;font-weight:900;font-size:15px;padding-top:8px;">Total Amount:</td>
                <td style="text-align:right;font-weight:900;font-size:17px;color:#0066FF;padding-top:8px;">£${totals.grandTotal.toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Instructions / Custom Notes -->
  ${customNotes || purchaseOrder.notes ? `
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <div style="background-color:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:800;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">SPECIAL INSTRUCTIONS / NOTES</div>
        <div style="font-size:13px;color:#78350F;line-height:1.5;white-space:pre-wrap;">${customNotes || purchaseOrder.notes}</div>
      </div>
    </td>
  </tr>` : ''}

  <!-- Footer / Call to Action -->
  <tr>
    <td style="background-color:#F8FAFC;padding:22px 28px;text-align:center;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;line-height:1.5;">
      <p style="margin:0 0 8px 0;font-weight:700;color:#0F172A;font-size:13px;">Please confirm receipt and expected delivery date by replying to this email.</p>
      <p style="margin:0;">
        For any questions regarding this order, please contact <strong>${entity.name}</strong> at 
        <a href="mailto:${entity.email || 'info@brookspeed.com'}" style="color:#0066FF;text-decoration:none;font-weight:600;">${entity.email || 'info@brookspeed.com'}</a>.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;
};
