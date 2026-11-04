import { PurchaseOrder, PurchaseOrderLineItem, ServicePackage, EstimateLineItem } from '../types';
import { saveDocument } from '../core/db';

export interface ServicePackagePriceMatch {
    packageId: string;
    packageName: string;
    vehicleMake?: string;
    vehicleModel?: string;
    costItemId: string;
    costItemDescription: string;
    currentUnitCost: number;
    newUnitCost: number;
    unitCostDifference: number;
    currentPartNumber: string;
    newPartNumber: string;
    partNumberChanged: boolean;
    quantityInPackage: number;
    currentPackageTotalCost: number;
    newPackageTotalCost: number;
    currentPackagePrice: number;
    poLineItemId: string;
    poPartNumber: string;
    poDescription: string;
}

export interface ServicePackageSyncPreview {
    matches: ServicePackagePriceMatch[];
    affectedPackageIds: string[];
    affectedPackagesCount: number;
    matchedPoItemsCount: number;
}

const clean = (str: any) => String(str ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Scans PO line items against all Service Packages to identify items where supplier buy price
 * or part number has changed.
 */
export const findServicePackageMatchesForPO = (
    po: Partial<PurchaseOrder>,
    servicePackages: ServicePackage[]
): ServicePackageSyncPreview => {
    const poLineItems = po.lineItems || [];
    const matches: ServicePackagePriceMatch[] = [];
    const affectedPackageIdSet = new Set<string>();
    const matchedPoItemIds = new Set<string>();

    poLineItems.forEach(poItem => {
        const poUnitPrice = Math.round((Number(poItem.unitPrice) || 0) * 100) / 100;
        const poPartNo = (poItem.partNumber || '').trim();
        const poCleanPartNo = clean(poPartNo);
        const poDesc = (poItem.description || '').trim();
        const poCleanDesc = clean(poDesc);

        // Skip non-part lines or zero-cost items
        if (!poPartNo && !poDesc) return;
        if (poUnitPrice <= 0 && !poPartNo) return;

        servicePackages.forEach(pkg => {
            const costItems = pkg.costItems || [];
            costItems.forEach(ci => {
                // Only match physical parts/consumables, not labour
                if (ci.isLabor) return;

                const ciPartNo = (ci.partNumber || '').trim();
                const ciCleanPartNo = clean(ciPartNo);
                const ciDesc = (ci.description || '').trim();
                const ciCleanDesc = clean(ciDesc);

                let isMatch = false;

                // 1. Direct Part Number Match
                if (poCleanPartNo && ciCleanPartNo && poCleanPartNo === ciCleanPartNo) {
                    isMatch = true;
                }
                // 2. Job Line Item ID linkage (if PO was raised from job estimate)
                else if (poItem.jobLineItemId && ci.id === poItem.jobLineItemId) {
                    isMatch = true;
                }
                // 3. Exact Description Match
                else if (poCleanDesc && ciCleanDesc && poCleanDesc === ciCleanDesc) {
                    isMatch = true;
                }
                // 4. Substring Part Number match (e.g. OEM number without prefix/dashes)
                else if (poCleanPartNo && ciCleanPartNo && (poCleanPartNo.includes(ciCleanPartNo) || ciCleanPartNo.includes(poCleanPartNo)) && poCleanPartNo.length >= 6) {
                    isMatch = true;
                }

                if (isMatch) {
                    const currentUnitCost = Math.round((Number(ci.unitCost) || 0) * 100) / 100;
                    const costDifference = Math.round((poUnitPrice - currentUnitCost) * 100) / 100;
                    const partNoChanged = Boolean(poPartNo && (!ciPartNo || clean(poPartNo) !== clean(ciPartNo)));

                    // Has there been a buy price change or part number update?
                    if (Math.abs(costDifference) >= 0.01 || partNoChanged) {
                        const currentPkgTotalCost = Math.round((Number(pkg.totalCost) || 0) * 100) / 100;
                        const qty = Number(ci.quantity) || 1;
                        const newPkgTotalCost = Math.round((currentPkgTotalCost + (costDifference * qty)) * 100) / 100;

                        matches.push({
                            packageId: pkg.id,
                            packageName: pkg.name || `Package #${pkg.id}`,
                            vehicleMake: pkg.applicableMake,
                            vehicleModel: pkg.applicableModel,
                            costItemId: ci.id,
                            costItemDescription: ci.description,
                            currentUnitCost,
                            newUnitCost: poUnitPrice,
                            unitCostDifference: costDifference,
                            currentPartNumber: ciPartNo,
                            newPartNumber: poPartNo || ciPartNo,
                            partNumberChanged: partNoChanged,
                            quantityInPackage: qty,
                            currentPackageTotalCost: currentPkgTotalCost,
                            newPackageTotalCost: Math.max(0, newPkgTotalCost),
                            currentPackagePrice: Number(pkg.totalPrice) || 0,
                            poLineItemId: poItem.id,
                            poPartNumber: poPartNo,
                            poDescription: poDesc
                        });

                        affectedPackageIdSet.add(pkg.id);
                        matchedPoItemIds.add(poItem.id);
                    }
                }
            });
        });
    });

    return {
        matches,
        affectedPackageIds: Array.from(affectedPackageIdSet),
        affectedPackagesCount: affectedPackageIdSet.size,
        matchedPoItemsCount: matchedPoItemIds.size
    };
};

/**
 * Applies selected price/part number updates to service packages and persists to IndexedDB & Firestore.
 */
export const applyServicePackageUpdates = async (
    allServicePackages: ServicePackage[],
    selectedMatches: ServicePackagePriceMatch[],
    setServicePackagesState?: React.Dispatch<React.SetStateAction<ServicePackage[]>>
): Promise<{ updatedPackages: ServicePackage[], updatedCount: number }> => {
    if (selectedMatches.length === 0) {
        return { updatedPackages: allServicePackages, updatedCount: 0 };
    }

    // Group selected matches by package ID
    const updatesByPackage = new Map<string, ServicePackagePriceMatch[]>();
    selectedMatches.forEach(m => {
        if (!updatesByPackage.has(m.packageId)) {
            updatesByPackage.set(m.packageId, []);
        }
        updatesByPackage.get(m.packageId)!.push(m);
    });

    const modifiedPackages: ServicePackage[] = [];
    const updatedFullList = allServicePackages.map(pkg => {
        const packageUpdates = updatesByPackage.get(pkg.id);
        if (!packageUpdates || packageUpdates.length === 0) {
            return pkg;
        }

        // Clone costItems
        const updatedCostItems = (pkg.costItems || []).map(ci => {
            const match = packageUpdates.find(u => u.costItemId === ci.id);
            if (!match) return ci;

            return {
                ...ci,
                unitCost: match.newUnitCost,
                partNumber: match.newPartNumber || ci.partNumber
            };
        });

        // Recalculate package total cost
        const newTotalCost = updatedCostItems.reduce((sum, item) => {
            const cost = Number(item.unitCost) || 0;
            const qty = Number(item.quantity) || 1;
            return sum + (cost * qty);
        }, 0);

        const updatedPkg: ServicePackage = {
            ...pkg,
            totalCost: Math.round(newTotalCost * 100) / 100,
            costItems: updatedCostItems
        };

        modifiedPackages.push(updatedPkg);
        return updatedPkg;
    });

    // 1. Update React state immediately
    if (setServicePackagesState) {
        setServicePackagesState(updatedFullList);
    }

    // 2. Persist to storage (IndexedDB + Firestore)
    for (const pkg of modifiedPackages) {
        try {
            await saveDocument('brooks_servicePackages', pkg);
        } catch (err) {
            console.warn(`[PriceSync] Failed to persist package ${pkg.id}:`, err);
        }
    }

    return {
        updatedPackages: updatedFullList,
        updatedCount: modifiedPackages.length
    };
};
