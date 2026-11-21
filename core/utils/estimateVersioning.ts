import { Estimate, EstimateLineItem, EstimateOverrideRecord, EstimateVersionSnapshot, TaxRate } from '../../types';

export interface EstimateTotals {
    totalNet: number;
    totalVat: number;
    totalGross: number;
}

export interface EstimateDiffResult {
    added: EstimateLineItem[];
    removed: EstimateLineItem[];
    modified: {
        item: EstimateLineItem;
        prevQuantity: number;
        prevUnitPrice: number;
    }[];
    hasChanges: boolean;
}

export interface EstimateDriftSummary {
    isVersionSecured: boolean;
    currentVersion: number;
    latestSent: EstimateVersionSnapshot | null;
    authorizedOverridesTotal: number;
    authorizedTotalGross: number;
    currentTotalGross: number;
    unexplainedDelta: number;
    diff: EstimateDiffResult;
    hasDrift: boolean;
}

const getBillableItems = (items: EstimateLineItem[] = []): EstimateLineItem[] =>
    items.filter(item => !item.isPackageComponent && !item.isOptional);

export const calculateEstimateTotals = (
    lineItems: EstimateLineItem[] = [],
    taxRates: TaxRate[] = []
): EstimateTotals => {
    const standardRate = taxRates.find(t => t.code === 'T1')?.rate ?? 20;
    const rateById = new Map<string, number>();
    taxRates.forEach(t => rateById.set(t.id, t.rate));

    let totalNet = 0;
    let totalVat = 0;

    for (const item of getBillableItems(lineItems)) {
        const lineNet = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const rate = (item.taxCodeId && rateById.get(item.taxCodeId) !== undefined)
            ? rateById.get(item.taxCodeId)!
            : standardRate;
        totalNet += lineNet;
        totalVat += lineNet * (rate / 100);
    }

    totalNet = Math.round(totalNet * 100) / 100;
    totalVat = Math.round(totalVat * 100) / 100;
    const totalGross = Math.round((totalNet + totalVat) * 100) / 100;

    return { totalNet, totalVat, totalGross };
};

export const computeEstimateDiff = (
    previousItems: EstimateLineItem[] = [],
    currentItems: EstimateLineItem[] = []
): EstimateDiffResult => {
    const prevBillable = getBillableItems(previousItems);
    const currBillable = getBillableItems(currentItems);

    const prevById = new Map<string, EstimateLineItem>();
    prevBillable.forEach(item => prevById.set(item.id, item));

    const currById = new Map<string, EstimateLineItem>();
    currBillable.forEach(item => currById.set(item.id, item));

    const added: EstimateLineItem[] = [];
    const removed: EstimateLineItem[] = [];
    const modified: { item: EstimateLineItem; prevQuantity: number; prevUnitPrice: number }[] = [];

    for (const curr of currBillable) {
        const prev = prevById.get(curr.id);
        if (!prev) {
            added.push(curr);
        } else {
            const qtyChanged = Math.abs((Number(curr.quantity) || 0) - (Number(prev.quantity) || 0)) > 0.001;
            const priceChanged = Math.abs((Number(curr.unitPrice) || 0) - (Number(prev.unitPrice) || 0)) > 0.001;
            const descChanged = (curr.description || '').trim() !== (prev.description || '').trim();
            if (qtyChanged || priceChanged || descChanged) {
                modified.push({
                    item: curr,
                    prevQuantity: Number(prev.quantity) || 0,
                    prevUnitPrice: Number(prev.unitPrice) || 0
                });
            }
        }
    }

    for (const prev of prevBillable) {
        if (!currById.has(prev.id)) {
            removed.push(prev);
        }
    }

    return {
        added,
        removed,
        modified,
        hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0
    };
};

export const recordEstimateSentVersion = (
    estimate: Estimate,
    userId?: string,
    taxRates: TaxRate[] = []
): Estimate => {
    const existingHistory = estimate.sentHistory || [];
    const latestSent = existingHistory.length > 0 ? existingHistory[existingHistory.length - 1] : null;
    const totals = calculateEstimateTotals(estimate.lineItems, taxRates);

    let nextVersion = estimate.version || 1;
    if (latestSent) {
        const diff = computeEstimateDiff(latestSent.lineItems, estimate.lineItems);
        const totalChanged = Math.abs(totals.totalGross - latestSent.totalGross) > 0.01;
        if (diff.hasChanges || totalChanged) {
            nextVersion = Math.max(nextVersion, latestSent.version) + 1;
        } else {
            nextVersion = latestSent.version;
        }
    }

    const snapshot: EstimateVersionSnapshot = {
        version: nextVersion,
        sentAt: new Date().toISOString(),
        sentByUserId: userId,
        totalNet: totals.totalNet,
        totalVat: totals.totalVat,
        totalGross: totals.totalGross,
        lineItems: JSON.parse(JSON.stringify(estimate.lineItems || []))
    };

    const updatedHistory = latestSent && latestSent.version === nextVersion
        ? [...existingHistory.slice(0, -1), snapshot]
        : [...existingHistory, snapshot];

    return {
        ...estimate,
        status: estimate.status === 'Draft' ? 'Sent' : estimate.status,
        version: nextVersion,
        sentHistory: updatedHistory,
        hasUnnotifiedChanges: false
    };
};

export const getEstimateDriftSummary = (
    estimate?: Estimate | null,
    taxRates: TaxRate[] = []
): EstimateDriftSummary => {
    if (!estimate) {
        return {
            isVersionSecured: false,
            currentVersion: 1,
            latestSent: null,
            authorizedOverridesTotal: 0,
            authorizedTotalGross: 0,
            currentTotalGross: 0,
            unexplainedDelta: 0,
            diff: { added: [], removed: [], modified: [], hasChanges: false },
            hasDrift: false
        };
    }

    const existingHistory = estimate.sentHistory || [];
    const latestSent = existingHistory.length > 0 ? existingHistory[existingHistory.length - 1] : null;
    const currentTotals = calculateEstimateTotals(estimate.lineItems, taxRates);
    const overridesTotal = (estimate.authorizedOverrides || []).reduce(
        (sum, ov) => sum + (Number(ov.deltaGross) || 0),
        0
    );

    if (!latestSent) {
        return {
            isVersionSecured: false,
            currentVersion: estimate.version || 1,
            latestSent: null,
            authorizedOverridesTotal: Math.round(overridesTotal * 100) / 100,
            authorizedTotalGross: currentTotals.totalGross,
            currentTotalGross: currentTotals.totalGross,
            unexplainedDelta: 0,
            diff: { added: [], removed: [], modified: [], hasChanges: false },
            hasDrift: false
        };
    }

    const authorizedTotalGross = Math.round((latestSent.totalGross + overridesTotal) * 100) / 100;
    const unexplainedDelta = Math.round((currentTotals.totalGross - authorizedTotalGross) * 100) / 100;
    const diff = computeEstimateDiff(latestSent.lineItems, estimate.lineItems);
    const hasDrift = Math.abs(unexplainedDelta) > 0.01;

    return {
        isVersionSecured: true,
        currentVersion: hasDrift ? Math.max(estimate.version || 1, latestSent.version + 1) : (estimate.version || latestSent.version),
        latestSent,
        authorizedOverridesTotal: Math.round(overridesTotal * 100) / 100,
        authorizedTotalGross,
        currentTotalGross: currentTotals.totalGross,
        unexplainedDelta,
        diff,
        hasDrift
    };
};

export const createEstimateOverrideRecord = (
    userId: string,
    source: EstimateOverrideRecord['source'],
    reason: string,
    deltaGross: number,
    addedDescription?: string
): EstimateOverrideRecord => ({
    id: `ov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId,
    source,
    reason,
    addedDescription,
    deltaGross: Math.round(deltaGross * 100) / 100
});

export const formatEstimateChangeNotice = (
    estimate: Estimate,
    summary: EstimateDriftSummary
): string => {
    const lines: string[] = [];
    const estNum = estimate.estimateNumber || estimate.id;
    const prevVer = summary.latestSent?.version || 1;
    const nextVer = summary.currentVersion;

    lines.push(`Update to Estimate #${estNum} (v${prevVer} → v${nextVer}):`);
    lines.push('');

    if (summary.diff.added.length > 0) {
        lines.push('Added Items:');
        summary.diff.added.forEach(item => {
            const net = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            lines.push(`+ ${item.description} (x${item.quantity} @ £${Number(item.unitPrice).toFixed(2)} = £${net.toFixed(2)} + VAT)`);
        });
        lines.push('');
    }

    if (summary.diff.modified.length > 0) {
        lines.push('Updated Items:');
        summary.diff.modified.forEach(({ item, prevQuantity, prevUnitPrice }) => {
            lines.push(`~ ${item.description}: qty ${prevQuantity}→${item.quantity}, £${prevUnitPrice.toFixed(2)}→£${Number(item.unitPrice).toFixed(2)} + VAT`);
        });
        lines.push('');
    }

    if (summary.diff.removed.length > 0) {
        lines.push('Removed Items:');
        summary.diff.removed.forEach(item => {
            lines.push(`- ${item.description}`);
        });
        lines.push('');
    }

    lines.push(`Previous Sent Total (v${prevVer}): £${(summary.latestSent?.totalGross || 0).toFixed(2)} inc. VAT`);
    lines.push(`Updated Total (v${nextVer}): £${summary.currentTotalGross.toFixed(2)} inc. VAT`);

    return lines.join('\n');
};
