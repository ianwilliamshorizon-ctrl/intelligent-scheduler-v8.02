import Papa from 'papaparse';
import { ServicePackage, EstimateLineItem, BusinessEntity, TaxRate, Part } from '../types';

export interface ParsedPackageValidation {
    isValid: boolean;
    hasLabour: boolean;
    hasQuantities: boolean;
    hasBusinessEntity: boolean;
    hasWarnings: boolean;
    warnings: string[];
    errors: string[];
}

export interface ParsedServicePackageResult {
    pkg: ServicePackage;
    entityName: string;
    totalLabourHours: number;
    labourItemCount: number;
    partItemCount: number;
    partsWithoutPartNumberCount: number;
    validation: ParsedPackageValidation;
}

export interface ImportParseSummary {
    results: ParsedServicePackageResult[];
    totalRows: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
    globalErrors: string[];
}

/**
 * Dynamically loads SheetJS (XLSX) if needed for .xlsx or .xls files
 */
export const loadXlsxLibrary = async (): Promise<any> => {
    if (typeof window !== 'undefined' && (window as any).XLSX) {
        return (window as any).XLSX;
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.async = true;
        script.onload = () => {
            if ((window as any).XLSX) {
                resolve((window as any).XLSX);
            } else {
                reject(new Error('SheetJS library loaded but XLSX object not found.'));
            }
        };
        script.onerror = () => {
            reject(new Error('Failed to load Excel reader. You can save your spreadsheet as a CSV file to import directly.'));
        };
        document.head.appendChild(script);
    });
};

/**
 * Finds and matches a business entity by Name, ShortCode, ID, or fuzzy token matching
 */
export const findBusinessEntity = (
    rawInput: any,
    businessEntities: BusinessEntity[] = [],
    fallbackEntityId?: string
): BusinessEntity | undefined => {
    if (!businessEntities || businessEntities.length === 0) {
        return undefined;
    }

    const safeFallback = businessEntities.find(e => e.id === fallbackEntityId && e.id !== 'all') 
        || businessEntities[0];

    const str = String(rawInput || '').trim();
    if (!str || str.toLowerCase() === 'all' || str.toLowerCase() === 'universal' || str.toLowerCase() === 'generic') {
        return safeFallback;
    }

    const lower = str.toLowerCase();

    // 1. Exact ID
    let found = businessEntities.find(e => e.id.toLowerCase() === lower);
    if (found) return found;

    // 2. Exact ShortCode
    found = businessEntities.find(e => e.shortCode && e.shortCode.toLowerCase() === lower);
    if (found) return found;

    // 3. Exact Name
    found = businessEntities.find(e => e.name && e.name.toLowerCase() === lower);
    if (found) return found;

    // 4. Substring Name match
    found = businessEntities.find(e => e.name && (e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase())));
    if (found) return found;

    // 5. Token match (e.g. "porsche", "audi", "trimming", "workshop", "southampton")
    const tokens = lower.split(/[^a-z0-9]+/).filter(t => t.length >= 3);
    for (const token of tokens) {
        found = businessEntities.find(e => 
            e.id.toLowerCase().includes(token) || 
            (e.shortCode && e.shortCode.toLowerCase().includes(token)) ||
            (e.name && e.name.toLowerCase().includes(token))
        );
        if (found) return found;
    }

    // 6. Safe fallback to valid business entity
    return safeFallback;
};

/**
 * Normalizes header keys to standard names
 */
const normalizeKey = (key: string): string => {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Parses raw text or sheet data into normalized row objects
 */
export const parseRawSheetToRows = async (file: File): Promise<any[]> => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
        const XLSX = await loadXlsxLibrary();
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        return jsonRows;
    }

    // Default to CSV
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''),
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    console.warn('Papa parse notices:', results.errors);
                }
                resolve((results.data as any[]).filter(row => row && Object.keys(row).length > 0));
            },
            error: (err) => {
                reject(err);
            }
        });
    });
};

/**
 * Parses rows into ServicePackage objects with full validation for Labour, Quants, and Business Entity
 */
export const parseServicePackagesFromRows = (
    rows: any[],
    businessEntities: BusinessEntity[],
    taxRates: TaxRate[],
    partsCatalog: Part[],
    fallbackEntityId?: string
): ImportParseSummary => {
    const standardTaxRate = taxRates.find(t => t.code === 'T1') || taxRates[0];
    const standardTaxRateId = standardTaxRate?.id || 'tax_2';
    const standardRatePercent = standardTaxRate?.rate ?? 20;

    const t0TaxRate = taxRates.find(t => t.code === 'T0');
    const t0TaxRateId = t0TaxRate?.id || 'tax_1';

    // Map parts catalog by part number for fast lookup
    const partsMap = new Map<string, Part>();
    partsCatalog.forEach(p => {
        if (p.partNumber) {
            partsMap.set(p.partNumber.trim().toLowerCase(), p);
        }
    });

    // Group rows by package
    // A package group can either be identified by repeated Package Name or consecutive rows following a Package Name
    interface RawPackageGroup {
        name: string;
        entityInput: string;
        description: string;
        applicableMake: string;
        applicableModel: string;
        applicableVariant: string;
        applicableEngineSize: number | undefined;
        targetFixedPrice: number | undefined;
        taxCodeInput: string;
        items: any[];
    }

    const packageGroups: RawPackageGroup[] = [];
    const groupsMap = new Map<string, RawPackageGroup>();
    let currentGroup: RawPackageGroup | null = null;

    rows.forEach((row) => {
        // Find mapped fields using normalized keys
        const rowMap = new Map<string, any>();
        Object.keys(row).forEach(k => {
            rowMap.set(normalizeKey(k), row[k]);
        });

        const getVal = (...keys: string[]): any => {
            for (const k of keys) {
                const norm = normalizeKey(k);
                if (rowMap.has(norm)) {
                    const val = rowMap.get(norm);
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        return val;
                    }
                }
            }
            return '';
        };

        const packageName = String(getVal('packagename', 'package', 'servicename', 'name', 'title') || '').trim();
        const businessEntityRaw = String(getVal('businessentity', 'entity', 'company', 'branch', 'location') || '').trim();
        const packageDesc = String(getVal('packagedescription', 'description', 'notes', 'summary') || '').trim();
        const make = String(getVal('vehiclemake', 'make', 'brand') || '').trim();
        const model = String(getVal('vehiclemodel', 'model') || '').trim();
        const variant = String(getVal('vehiclevariant', 'variant', 'trim') || '').trim();
        const engineSizeStr = String(getVal('enginesize', 'enginesizecc', 'cc', 'engine') || '').trim();
        const engineSize = engineSizeStr ? parseFloat(engineSizeStr) : undefined;
        const targetPriceStr = String(getVal('packagefixedpricegross', 'packageprice', 'totalprice', 'fixedprice', 'grossprice') || '').trim();
        const targetFixedPrice = targetPriceStr ? parseFloat(targetPriceStr.replace(/[^0-9.-]/g, '')) : undefined;
        const taxCodeStr = String(getVal('taxcode', 'vatcode', 'tax') || '').trim();

        // Line item fields
        const itemTypeRaw = String(getVal('itemtype', 'type', 'category', 'labourorpart') || '').trim().toLowerCase();
        const itemDescription = String(getVal('itemdescription', 'workdescription', 'partdescription', 'itemname', 'component') || '').trim();
        const partNumber = String(getVal('partnumber', 'partno', 'sku', 'part') || '').trim();
        const quantityRaw = getVal('quantity', 'quants', 'qty', 'hours', 'units');
        const unitPriceRaw = getVal('unitprice', 'price', 'rate', 'hourlyrate', 'sellprice');
        const unitCostRaw = getVal('unitcost', 'cost', 'hourlycost', 'costprice');

        // Check if row has single-row format specific fields
        const singleRowLabourHours = getVal('labourhours', 'laborhours', 'hourslabour', 'hourslabor');
        const singleRowLabourRate = getVal('labourrate', 'laborrate', 'rateperhour');
        const singleRowLabourCost = getVal('labourcost', 'laborcost');
        const singleRowLabourDesc = getVal('labourdescription', 'labordescription');
        const isSingleRowFormat = singleRowLabourHours !== '';

        if (isSingleRowFormat && packageName) {
            // Self-contained single row package
            packageGroups.push({
                name: packageName,
                entityInput: businessEntityRaw,
                description: packageDesc,
                applicableMake: make,
                applicableModel: model,
                applicableVariant: variant,
                applicableEngineSize: engineSize,
                targetFixedPrice,
                taxCodeInput: taxCodeStr,
                items: [
                    {
                        isLabor: true,
                        description: singleRowLabourDesc || `${packageName} Labour`,
                        quantity: parseFloat(String(singleRowLabourHours)) || 1,
                        unitPrice: singleRowLabourRate !== '' ? parseFloat(String(singleRowLabourRate)) : undefined,
                        unitCost: singleRowLabourCost !== '' ? parseFloat(String(singleRowLabourCost)) : undefined,
                        taxCode: taxCodeStr,
                        partNumber: ''
                    },
                    ...(itemDescription ? [{
                        isLabor: false,
                        description: itemDescription,
                        quantity: parseFloat(String(quantityRaw)) || 1,
                        unitPrice: unitPriceRaw !== '' ? parseFloat(String(unitPriceRaw)) : undefined,
                        unitCost: unitCostRaw !== '' ? parseFloat(String(unitCostRaw)) : undefined,
                        taxCode: taxCodeStr,
                        partNumber: partNumber
                    }] : [])
                ]
            });
            currentGroup = null;
            return;
        }

        // Multi-row format: group by package name
        if (packageName) {
            const groupKey = packageName.toLowerCase();
            if (!groupsMap.has(groupKey)) {
                currentGroup = {
                    name: packageName,
                    entityInput: businessEntityRaw,
                    description: packageDesc,
                    applicableMake: make,
                    applicableModel: model,
                    applicableVariant: variant,
                    applicableEngineSize: engineSize,
                    targetFixedPrice,
                    taxCodeInput: taxCodeStr,
                    items: []
                };
                groupsMap.set(groupKey, currentGroup);
                packageGroups.push(currentGroup);
            } else {
                currentGroup = groupsMap.get(groupKey)!;
                if (!currentGroup.entityInput && businessEntityRaw) currentGroup.entityInput = businessEntityRaw;
                if (!currentGroup.description && packageDesc) currentGroup.description = packageDesc;
                if (!currentGroup.applicableMake && make) currentGroup.applicableMake = make;
                if (!currentGroup.applicableModel && model) currentGroup.applicableModel = model;
                if (!currentGroup.applicableVariant && variant) currentGroup.applicableVariant = variant;
                if (!currentGroup.applicableEngineSize && engineSize) currentGroup.applicableEngineSize = engineSize;
                if (!currentGroup.targetFixedPrice && targetFixedPrice) currentGroup.targetFixedPrice = targetFixedPrice;
                if (!currentGroup.taxCodeInput && taxCodeStr) currentGroup.taxCodeInput = taxCodeStr;
            }
        }

        // If we have an active package group, see if this row contains a line item
        if (currentGroup) {
            // If itemDescription or quantity or itemType is present
            if (itemDescription || quantityRaw !== '' || itemTypeRaw || partNumber) {
                // Determine if labour or part
                let isLabor = false;
                if (itemTypeRaw.includes('lab') || itemTypeRaw === 'l') {
                    isLabor = true;
                } else if (itemTypeRaw.includes('part') || itemTypeRaw === 'p') {
                    isLabor = false;
                } else if (itemDescription.toLowerCase().includes('labour') || itemDescription.toLowerCase().includes('labor')) {
                    isLabor = true;
                } else if (!partNumber && (itemDescription.toLowerCase().includes('service') || itemDescription.toLowerCase().includes('check') || itemDescription.toLowerCase().includes('test') || itemDescription.toLowerCase().includes('investigation'))) {
                    isLabor = true;
                } else {
                    isLabor = false;
                }

                currentGroup.items.push({
                    isLabor,
                    description: itemDescription || (isLabor ? 'Labour' : (partNumber ? `Part ${partNumber}` : 'Consumables / Parts')),
                    partNumber: partNumber || '',
                    quantity: quantityRaw !== '' ? parseFloat(String(quantityRaw)) || 0 : (isLabor ? 1 : 1),
                    unitPrice: unitPriceRaw !== '' ? parseFloat(String(unitPriceRaw)) : undefined,
                    unitCost: unitCostRaw !== '' ? parseFloat(String(unitCostRaw)) : undefined,
                    taxCode: taxCodeStr
                });
            }
        }
    });

    const results: ParsedServicePackageResult[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    packageGroups.forEach((group, index) => {
        const warnings: string[] = [];
        const errors: string[] = [];

        // 1. Resolve Business Entity
        const matchedEntity = findBusinessEntity(group.entityInput, businessEntities, fallbackEntityId);
        if (!matchedEntity) {
            errors.push(`Business Entity "${group.entityInput || 'Blank'}" could not be resolved and no default entity selected.`);
        } else if (group.entityInput && matchedEntity.name?.toLowerCase() !== group.entityInput.toLowerCase() && matchedEntity.shortCode?.toLowerCase() !== group.entityInput.toLowerCase()) {
            warnings.push(`Matched entity "${matchedEntity.name}" based on fuzzy match for "${group.entityInput}".`);
        } else if (!group.entityInput && fallbackEntityId) {
            warnings.push(`Business Entity was not specified in row; assigned default entity "${matchedEntity.name}".`);
        }

        const entityId = matchedEntity?.id || fallbackEntityId || '';
        const defaultLaborRate = matchedEntity?.laborRate || 95;
        const defaultLaborCost = matchedEntity?.laborCostRate || 35;

        // 2. Validate Items & Labour & Quants
        let totalLabourHours = 0;
        let labourItemCount = 0;
        let partItemCount = 0;
        let partsWithoutPartNumberCount = 0;
        let hasQuantityIssue = false;

        const costItems: EstimateLineItem[] = [];

        group.items.forEach((item, itemIdx) => {
            const isLabor = Boolean(item.isLabor);
            let qty = Number(item.quantity);

            if (isNaN(qty) || qty <= 0) {
                qty = isLabor ? 1 : 1;
                warnings.push(`Item #${itemIdx + 1} ("${item.description}") had missing quantity; defaulted to 1.`);
            }

            if (isLabor) {
                labourItemCount++;
                totalLabourHours += qty;
            } else {
                partItemCount++;
                if (!item.partNumber) {
                    partsWithoutPartNumberCount++;
                }
            }

            // Check if part number matches existing inventory
            let matchedPart: Part | undefined;
            if (!isLabor && item.partNumber) {
                matchedPart = partsMap.get(item.partNumber.trim().toLowerCase());
            }

            // Pricing resolution
            let unitPrice = item.unitPrice;
            if (unitPrice === undefined || isNaN(unitPrice)) {
                if (isLabor) {
                    unitPrice = defaultLaborRate;
                } else if (matchedPart && matchedPart.salePrice) {
                    unitPrice = matchedPart.salePrice;
                } else {
                    unitPrice = 0;
                }
            }

            let unitCost = item.unitCost;
            if (unitCost === undefined || isNaN(unitCost)) {
                if (isLabor) {
                    unitCost = defaultLaborCost;
                } else if (matchedPart && matchedPart.costPrice) {
                    unitCost = matchedPart.costPrice;
                } else {
                    unitCost = 0;
                }
            }

            // Tax resolution
            let itemTaxCodeId = standardTaxRateId;
            if (item.taxCode) {
                const upperTax = String(item.taxCode).toUpperCase().trim();
                const matchedTax = taxRates.find(t => t.code?.toUpperCase() === upperTax || t.name?.toUpperCase().includes(upperTax));
                if (matchedTax) {
                    itemTaxCodeId = matchedTax.id;
                } else if (upperTax === 'T0' || upperTax === '0' || upperTax === 'EXEMPT') {
                    itemTaxCodeId = t0TaxRateId;
                }
            }

            costItems.push({
                id: crypto.randomUUID(),
                description: item.description,
                quantity: qty,
                unitPrice: Math.round(unitPrice * 100) / 100,
                unitCost: Math.round(unitCost * 100) / 100,
                isLabor: isLabor,
                partNumber: item.partNumber || undefined,
                partId: matchedPart ? matchedPart.id : undefined,
                taxCodeId: itemTaxCodeId,
                fromStock: Boolean(matchedPart && matchedPart.stockQuantity > 0)
            });
        });

        // 3. User Requirement Check: Labour must be included
        if (labourItemCount === 0 || totalLabourHours <= 0) {
            const autoLabourHours = 1.5;
            totalLabourHours += autoLabourHours;
            labourItemCount += 1;
            costItems.unshift({
                id: crypto.randomUUID(),
                description: `${group.name} Labour & Multi-Point Inspection`,
                quantity: autoLabourHours,
                unitPrice: defaultLaborRate,
                unitCost: defaultLaborCost,
                isLabor: true,
                taxCodeId: standardTaxRateId,
                fromStock: false
            });
            warnings.push(`Auto-added standard labour item (${autoLabourHours}h @ £${defaultLaborRate}/hr) as no explicit labour item was specified.`);
        }

        // 4. Calculations: Net, VAT, Total Cost, Gross
        let calculatedNet = 0;
        let calculatedVat = 0;
        let totalCost = 0;

        costItems.forEach(ci => {
            const itemNet = ci.unitPrice * ci.quantity;
            calculatedNet += itemNet;
            totalCost += (ci.unitCost || 0) * ci.quantity;

            const tr = taxRates.find(t => t.id === ci.taxCodeId);
            const rate = tr ? tr.rate : standardRatePercent;
            calculatedVat += itemNet * (rate / 100);
        });

        const calculatedGross = calculatedNet + calculatedVat;
        const finalGrossPrice = group.targetFixedPrice !== undefined && group.targetFixedPrice > 0
            ? group.targetFixedPrice
            : Math.round(calculatedGross * 100) / 100;

        const isMixedVat = new Set(costItems.map(c => c.taxCodeId)).size > 1;

        // Package ID
        const packageId = `pkg_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;

        const pkg: ServicePackage = {
            id: packageId,
            name: group.name,
            entityId: entityId,
            description: group.description || undefined,
            applicableMake: group.applicableMake || undefined,
            applicableModel: group.applicableModel || undefined,
            applicableVariant: group.applicableVariant || undefined,
            applicableEngineSize: group.applicableEngineSize || undefined,
            totalPrice: finalGrossPrice,
            totalPriceNet: Math.round(calculatedNet * 100) / 100,
            totalPriceVat: Math.round(calculatedVat * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            isMixedVat: isMixedVat,
            taxCodeId: isMixedVat ? 'T99' : standardTaxRateId,
            costItems: costItems
        };

        const isValid = errors.length === 0;
        if (isValid) {
            validCount++;
        } else {
            errorCount++;
        }

        if (warnings.length > 0) {
            warningCount++;
        }

        results.push({
            pkg,
            entityName: matchedEntity?.name || 'Unassigned',
            totalLabourHours,
            labourItemCount,
            partItemCount,
            partsWithoutPartNumberCount,
            validation: {
                isValid,
                hasLabour: labourItemCount > 0 && totalLabourHours > 0,
                hasQuantities: !hasQuantityIssue && costItems.length > 0,
                hasBusinessEntity: Boolean(matchedEntity),
                hasWarnings: warnings.length > 0,
                warnings,
                errors
            }
        });
    });

    return {
        results,
        totalRows: rows.length,
        validCount,
        warningCount,
        errorCount,
        globalErrors: []
    };
};

/**
 * Returns formatted CSV template string with comprehensive examples and clean formatting
 */
export const generateServicePackagesCsvTemplate = (businessEntities: BusinessEntity[]): string => {
    const sampleEntity = businessEntities[0]?.name || 'Brookspeed Southampton';
    
    const rows = [
        [
            'Package Name',
            'Business Entity',
            'Package Description',
            'Vehicle Make',
            'Vehicle Model',
            'Vehicle Variant',
            'Engine Size',
            'Item Type',
            'Item Description',
            'Part Number',
            'Quantity',
            'Unit Price',
            'Unit Cost',
            'Tax Code',
            'Package Fixed Price Gross'
        ],
        // Package 1: Porsche 911 Minor Service (Labour + Oil + Filter + Washer without part number)
        [
            'Porsche 911 (991) Minor Service',
            sampleEntity,
            'Comprehensive minor annual service with safety inspection and diagnostics',
            'Porsche',
            '911 (991)',
            'Carrera',
            '3000',
            'Labour',
            'Minor Service Labour & Inspection',
            '', // Labour has no part number
            '3.0', // Hours
            '95.00',
            '35.00',
            'T1',
            '495.00'
        ],
        [
            'Porsche 911 (991) Minor Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Mobil 1 ESP 0W-40 Synthetic Oil (Litres)',
            'MOB-0W40',
            '8.0',
            '14.50',
            '8.20',
            'T1',
            ''
        ],
        [
            'Porsche 911 (991) Minor Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Engine Oil Filter Element',
            '99610722553',
            '1.0',
            '24.00',
            '12.50',
            'T1',
            ''
        ],
        [
            'Porsche 911 (991) Minor Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Sump Plug Sealing Washer (Consumable)',
            '', // Explicitly showing part number is NOT required!
            '1.0',
            '2.50',
            '0.40',
            'T1',
            ''
        ],
        // Package 2: Porsche 911 Major Service
        [
            'Porsche 911 (991) Major Service',
            sampleEntity,
            'Full major scheduled maintenance including spark plugs, all filters, fluids & health check',
            'Porsche',
            '911 (991)',
            'Carrera S',
            '3000',
            'Labour',
            'Major Service Scheduled Labour',
            '',
            '6.5', // 6.5 hours
            '95.00',
            '35.00',
            'T1',
            '995.00'
        ],
        [
            'Porsche 911 (991) Major Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Mobil 1 ESP 0W-40 Synthetic Oil (Litres)',
            'MOB-0W40',
            '8.0',
            '14.50',
            '8.20',
            'T1',
            ''
        ],
        [
            'Porsche 911 (991) Major Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Engine Oil Filter Element',
            '99610722553',
            '1.0',
            '24.00',
            '12.50',
            'T1',
            ''
        ],
        [
            'Porsche 911 (991) Major Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Cabin Microfilter / Pollen Filter',
            '', // Missing part number - works perfectly
            '1.0',
            '36.00',
            '18.00',
            'T1',
            ''
        ],
        [
            'Porsche 911 (991) Major Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Engine Air Filter Pair',
            '99611013170',
            '1.0',
            '48.00',
            '25.00',
            'T1',
            ''
        ],
        [
            'Porsche 911 (991) Major Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'High Performance Spark Plugs',
            '', // Missing part number
            '6.0',
            '14.00',
            '7.50',
            'T1',
            ''
        ],
        // Package 3: Brake Fluid Change (Universal)
        [
            'Brake Fluid Service',
            sampleEntity,
            'Complete pressure flush and replacement with high temperature racing DOT4 fluid',
            'All',
            '',
            '',
            '',
            'Labour',
            'Brake Fluid Pressure Flush Labour',
            '',
            '1.0',
            '95.00',
            '35.00',
            'T1',
            '149.00'
        ],
        [
            'Brake Fluid Service',
            sampleEntity,
            '',
            '',
            '',
            '',
            '',
            'Part',
            'Super DOT 4 Synthetic Racing Brake Fluid 1L',
            'DOT4-R',
            '1.0',
            '18.00',
            '7.50',
            'T1',
            ''
        ],
        // Package 4: MOT Test (Exempt / T0)
        [
            'MOT Test (Class 4)',
            sampleEntity,
            'Official DVSA Class 4 Vehicle Safety & Emissions Test',
            'All',
            '',
            '',
            '',
            'Labour',
            'DVSA Class 4 MOT Inspection',
            '',
            '1.0',
            '54.85',
            '25.00',
            'T0',
            '54.85'
        ]
    ];

    // Escape CSV values
    return rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n');
};

/**
 * Triggers browser download for CSV template
 */
export const downloadServicePackageCsvTemplate = (businessEntities: BusinessEntity[]) => {
    const csvContent = generateServicePackagesCsvTemplate(businessEntities);
    // Add UTF-8 BOM so Excel opens it with perfect character encoding
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'service_packages_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Triggers browser download for Excel (.xlsx) template
 */
export const downloadServicePackageExcelTemplate = async (businessEntities: BusinessEntity[]) => {
    try {
        const XLSX = await loadXlsxLibrary();
        const csvContent = generateServicePackagesCsvTemplate(businessEntities);
        const workbook = XLSX.read(csvContent, { type: 'string' });
        
        // Auto-fit column widths
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        worksheet['!cols'] = [
            { wch: 32 }, // Package Name
            { wch: 24 }, // Business Entity
            { wch: 45 }, // Package Description
            { wch: 14 }, // Vehicle Make
            { wch: 16 }, // Vehicle Model
            { wch: 16 }, // Vehicle Variant
            { wch: 12 }, // Engine Size
            { wch: 12 }, // Item Type
            { wch: 40 }, // Item Description
            { wch: 18 }, // Part Number
            { wch: 10 }, // Quantity
            { wch: 12 }, // Unit Price
            { wch: 12 }, // Unit Cost
            { wch: 10 }, // Tax Code
            { wch: 24 }  // Package Fixed Price Gross
        ];

        XLSX.writeFile(workbook, 'service_packages_template.xlsx');
    } catch (err) {
        console.warn('Excel export failed, falling back to CSV download:', err);
        downloadServicePackageCsvTemplate(businessEntities);
    }
};
