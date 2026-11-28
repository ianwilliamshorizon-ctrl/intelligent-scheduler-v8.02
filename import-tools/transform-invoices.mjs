#!/usr/bin/env node
/**
 * Brookspeed External Import Transformation Tool — Invoices
 * Standalone zero-dependency Node.js CLI for transforming legacy invoice CSV exports
 * into Brookspeed `Invoice` records (`brooks_invoices`).
 *
 * Usage:
 *   node import-tools/transform-invoices.mjs <input.csv> [options]
 *
 * Options:
 *   --out <path>       Output JSON file path (default: <input>.transformed.json)
 *   --csv <path>       Optional normalized CSV output path
 *   --backup <path>    Optional Brookspeed backup JSON to resolve customerId & vehicleId
 *   --entity <id>      Optional default entityId to assign to imported invoices
 *   --vat <percent>    Default VAT rate % for single-line summary (default: 20)
 *   --terms <days>     Payment terms in days for dueDate (default: 30)
 *   --prefix <str>     Optional prefix for Invoice id (e.g. "INV-")
 */

import fs from 'node:fs';
import path from 'node:path';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const values = rows[r];
    if (values.length === 1 && values[0].trim() === '') continue;
    const obj = { __rowNumber: r + 1 };
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] ?? '').trim();
    });
    records.push(obj);
  }

  return { headers, records };
}

export function parseUkDateToIso(dateStr) {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return null;

  // DD/MM/YYYY
  const ukMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (ukMatch) {
    const day = Number(ukMatch[1]);
    const month = Number(ukMatch[2]);
    const year = Number(ukMatch[3]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (
      dt.getUTCFullYear() === year &&
      dt.getUTCMonth() === month - 1 &&
      dt.getUTCDate() === day
    ) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function addDaysIso(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalizeReg(reg) {
  return (reg || '').replace(/\s+/g, '').toUpperCase();
}

function buildLookupMaps(backupJson) {
  const customersByKey = new Map();
  const vehiclesByReg = new Map();
  const vehiclesByVin = new Map();

  if (!backupJson) return { customersByKey, vehiclesByReg, vehiclesByVin };
  const data = backupJson.data || backupJson;

  const customers = Array.isArray(data.brooks_customers) ? data.brooks_customers : [];
  for (const c of customers) {
    if (c.id) customersByKey.set(String(c.id).trim().toUpperCase(), c.id);
    if (c.accountCode) customersByKey.set(String(c.accountCode).trim().toUpperCase(), c.id);
    if (c.legacyId) customersByKey.set(String(c.legacyId).trim().toUpperCase(), c.id);
    const fullName = [c.forename, c.surname].filter(Boolean).join(' ').trim().toUpperCase();
    if (fullName) customersByKey.set(fullName, c.id);
    if (c.companyName) customersByKey.set(String(c.companyName).trim().toUpperCase(), c.id);
  }

  const vehicles = Array.isArray(data.brooks_vehicles) ? data.brooks_vehicles : [];
  for (const v of vehicles) {
    const reg = normalizeReg(v.registration);
    if (reg) vehiclesByReg.set(reg, v.id);
    const vin = (v.vin || '').trim().toUpperCase();
    if (vin) vehiclesByVin.set(vin, v.id);
  }

  return { customersByKey, vehiclesByReg, vehiclesByVin };
}

export function transformInvoiceRows(records, options = {}) {
  const {
    vatRate = 20,
    termsDays = 30,
    entityId = '',
    idPrefix = '',
    todayIso = new Date().toISOString().slice(0, 10),
    backupJson = null,
    markAllPaid = true,
  } = options;

  const { customersByKey, vehiclesByReg, vehiclesByVin } = buildLookupMaps(backupJson);
  const invoices = [];
  const rejected = [];
  const unmatched = [];

  for (const row of records) {
    const rowNum = row.__rowNumber || '?';
    const rawInvoiceNo = (row['Invoice No'] || '').trim();
    const issueDate = parseUkDateToIso(row['Invoice Date']);

    if (!rawInvoiceNo) {
      rejected.push({ rowNumber: rowNum, reason: 'Missing Invoice No', raw: row });
      continue;
    }
    if (!issueDate) {
      rejected.push({ rowNumber: rowNum, invoiceNo: rawInvoiceNo, reason: `Invalid Invoice Date "${row['Invoice Date'] || ''}"`, raw: row });
      continue;
    }

    const totalGross = Number(row['Invoice Total']);
    const outstandingRaw = row['Outstanding'] === '' ? totalGross : Number(row['Outstanding']);
    if (Number.isNaN(totalGross) || Number.isNaN(outstandingRaw)) {
      rejected.push({ rowNumber: rowNum, invoiceNo: rawInvoiceNo, reason: 'Non-numeric Invoice Total or Outstanding', raw: row });
      continue;
    }

    const dueDate = addDaysIso(issueDate, termsDays);
    const paidFlag = row['Paid'] === '1' || String(row['Paid']).toLowerCase() === 'true';
    const onHoldFlag = row['On Hold'] === '1' || String(row['On Hold']).toLowerCase() === 'true';
    const printedFlag = row['Printed'] === '1' || String(row['Printed']).toLowerCase() === 'true';
    const outstanding = Math.max(0, round2(outstandingRaw));
    const paidAmount = markAllPaid ? round2(Math.max(0, totalGross)) : round2(Math.max(0, totalGross - outstanding));

    let status = markAllPaid ? 'Paid' : 'Sent';
    if (!markAllPaid) {
      if (totalGross === 0 && !paidFlag) {
        status = 'Draft';
      } else if (paidFlag || outstanding <= 0.005) {
        status = 'Paid';
      } else if (paidAmount > 0.005) {
        status = 'Part Paid';
      } else if (dueDate < todayIso) {
        status = 'Overdue';
      }
    }

    const legacyCustomerCode = (row['Customer'] || '').trim();
    const customerName = (row['Customer Name'] || '').trim();
    const matchedCustomerId =
      customersByKey.get(legacyCustomerCode.toUpperCase()) ||
      customersByKey.get(customerName.toUpperCase()) ||
      null;

    const regNorm = normalizeReg(row['Vehicle']);
    const vinNorm = (row['VIN'] || '').trim().toUpperCase();
    const matchedVehicleId =
      (regNorm && vehiclesByReg.get(regNorm)) ||
      (vinNorm && vehiclesByVin.get(vinNorm)) ||
      null;

    if (backupJson && (!matchedCustomerId || !matchedVehicleId)) {
      unmatched.push({
        rowNumber: rowNum,
        invoiceNo: rawInvoiceNo,
        customerCode: legacyCustomerCode,
        customerName,
        customerMatched: Boolean(matchedCustomerId),
        vehicleReg: regNorm,
        vin: vinNorm,
        vehicleMatched: Boolean(matchedVehicleId),
      });
    }

    const effectiveVatRate = totalGross === 0 ? 0 : vatRate;
    const totalNet = effectiveVatRate > 0 ? round2(totalGross / (1 + effectiveVatRate / 100)) : round2(totalGross);
    const totalVat = round2(totalGross - totalNet);

    const jobDetails = (row['Job Details'] || '').replace(/\s+/g, ' ').trim();
    const lineDescription = jobDetails || `Legacy Invoice #${rawInvoiceNo}${row['Make and Model'] ? ` (${row['Make and Model']})` : ''}`;

    const invoiceId = `${idPrefix}${rawInvoiceNo}`;
    const lineItems = [
      {
        id: `${invoiceId}-line-1`,
        description: lineDescription,
        quantity: 1,
        unitPrice: totalNet,
        unitCost: 0,
        isLabor: true,
        vatRate: effectiveVatRate,
        totalNet,
        totalVat,
        totalGross: round2(totalGross),
      },
    ];

    const payments = [];
    if (paidAmount > 0.005) {
      payments.push({
        amount: paidAmount,
        date: issueDate,
        method: 'Other',
        notes: 'Imported historical payment from legacy CSV',
      });
    }

    const metaParts = [];
    if (legacyCustomerCode) metaParts.push(`Legacy Customer: ${legacyCustomerCode}${customerName ? ` (${customerName})` : ''}`);
    if (regNorm) metaParts.push(`Reg: ${regNorm}`);
    if (vinNorm) metaParts.push(`VIN: ${vinNorm}`);
    if (row['Telephone']) metaParts.push(`Tel: ${row['Telephone']}`);
    if (onHoldFlag) metaParts.push('Legacy Flag: On Hold');
    if (printedFlag) metaParts.push('Legacy Flag: Printed');
    if (row['Status']) metaParts.push(`Legacy Status: ${row['Status']}`);

    const invoice = {
      id: invoiceId,
      customerId: matchedCustomerId || legacyCustomerCode || customerName || 'UNKNOWN_CUSTOMER',
      vehicleId: matchedVehicleId || regNorm || vinNorm || 'UNKNOWN_VEHICLE',
      issueDate,
      dueDate,
      status,
      lineItems,
      payments,
      totalNet,
      totalVat,
      totalAmount: round2(totalGross),
      grandTotal: round2(totalGross),
      notes: jobDetails || undefined,
      financeNotes: metaParts.join(' | ') || undefined,
      ...(entityId ? { entityId } : {}),
      ...(row['Our Job No'] ? { jobId: row['Our Job No'] } : {}),
    };

    invoices.push(invoice);
  }

  return {
    invoices,
    rejected,
    unmatched,
    summary: {
      totalRows: records.length,
      transformed: invoices.length,
      rejected: rejected.length,
      unmatched: unmatched.length,
    },
  };
}

function escapeCsvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function invoicesToFlatCsv(invoices) {
  const headers = [
    'id',
    'customerId',
    'vehicleId',
    'jobId',
    'entityId',
    'issueDate',
    'dueDate',
    'status',
    'totalNet',
    'totalVat',
    'grandTotal',
    'paidAmount',
    'outstandingAmount',
    'notes',
    'financeNotes',
  ];
  const lines = [headers.join(',')];
  for (const inv of invoices) {
    const paid = round2((inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0));
    const outstanding = round2(Math.max(0, (inv.grandTotal || 0) - paid));
    lines.push(
      [
        inv.id,
        inv.customerId,
        inv.vehicleId,
        inv.jobId || '',
        inv.entityId || '',
        inv.issueDate,
        inv.dueDate,
        inv.status,
        inv.totalNet?.toFixed(2) ?? '0.00',
        inv.totalVat?.toFixed(2) ?? '0.00',
        inv.grandTotal?.toFixed(2) ?? '0.00',
        paid.toFixed(2),
        outstanding.toFixed(2),
        inv.notes || '',
        inv.financeNotes || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

// CLI entry point
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node import-tools/transform-invoices.mjs <input.csv> [--out out.json] [--csv out.csv] [--backup backup.json] [--entity id] [--vat 20] [--terms 30] [--prefix INV-]');
    process.exit(0);
  }

  const inputPath = args[0];
  const getArg = (flag, fallback) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const outJsonPath = getArg('--out', `${inputPath.replace(/\.csv$/i, '')}.transformed.json`);
  const outCsvPath = getArg('--csv', '');
  const backupPath = getArg('--backup', '');
  const entityId = getArg('--entity', '');
  const vatRate = Number(getArg('--vat', '20'));
  const termsDays = Number(getArg('--terms', '30'));
  const idPrefix = getArg('--prefix', '');

  const csvText = fs.readFileSync(inputPath, 'utf8');
  const backupJson = backupPath ? JSON.parse(fs.readFileSync(backupPath, 'utf8')) : null;
  const { records } = parseCsv(csvText);
  const result = transformInvoiceRows(records, { vatRate, termsDays, entityId, idPrefix, backupJson });

  const payload = {
    meta: {
      sourceFile: path.basename(inputPath),
      generatedAt: new Date().toISOString(),
      ...result.summary,
    },
    data: {
      brooks_invoices: result.invoices,
    },
    rejected: result.rejected,
    unmatched: result.unmatched,
  };

  fs.writeFileSync(outJsonPath, JSON.stringify(payload, null, 2), 'utf8');
  if (outCsvPath) {
    fs.writeFileSync(outCsvPath, invoicesToFlatCsv(result.invoices), 'utf8');
  }

  console.log(`[Invoice Transform] Total rows: ${result.summary.totalRows}`);
  console.log(`[Invoice Transform] Transformed: ${result.summary.transformed}`);
  console.log(`[Invoice Transform] Rejected:    ${result.summary.rejected}`);
  if (backupJson) {
    console.log(`[Invoice Transform] Unmatched:   ${result.summary.unmatched}`);
  }
  console.log(`[Invoice Transform] JSON saved -> ${outJsonPath}`);
  if (outCsvPath) console.log(`[Invoice Transform] CSV saved  -> ${outCsvPath}`);
}
