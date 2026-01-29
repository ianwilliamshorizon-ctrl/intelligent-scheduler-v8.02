
import { EstimateLineItem, Purchase, NominalCodeRule, NominalCodeItemType, PurchaseOrderLineItem } from '../types';

function getLineItemType(item: EstimateLineItem | PurchaseOrderLineItem): NominalCodeItemType {
    if (item.description.toLowerCase().includes('mot test')) return 'MOT';
    
    // Check for properties specific to EstimateLineItem (Sales side)
    if ('isCourtesyCar' in item && item.isCourtesyCar) return 'CourtesyCar';
    if ('isStorageCharge' in item && item.isStorageCharge) return 'Storage';
    
    // EstimateLineItems have 'isLabor'. PurchaseOrderLineItems do not.
    if ('isLabor' in item) {
        if (item.isLabor) return 'Labor';
        return 'Part'; // Sales Part
    }
    
    // If it doesn't have isLabor, it's a Purchase Order Line Item
    return 'Purchase';
}

/**
 * Assigns a nominal code to an item based on a set of rules.
 * @param item The invoice line item, purchase order line item, or purchase to categorize.
 * @param entityId The business entity ID for the transaction.
 * @param rules The list of all available nominal code rules.
 * @returns The ID of the matching nominal code, or null if no rule matches.
 */
export const assignNominalCode = (
    item: EstimateLineItem | Purchase | PurchaseOrderLineItem,
    entityId: string,
    rules: NominalCodeRule[]
): string | null => {
    
    const description = 'name' in item ? item.name : item.description;
    const itemType: NominalCodeItemType = 'name' in item ? 'Purchase' : getLineItemType(item as EstimateLineItem | PurchaseOrderLineItem);
    
    const lowercasedDescription = description.toLowerCase();
    
    // 1. Filter rules that could possibly match
    const relevantRules = rules.filter(rule => 
        (rule.entityId === 'all' || rule.entityId === entityId) &&
        rule.itemType === itemType
    );

    // 2. Sort by priority, highest first
    relevantRules.sort((a, b) => b.priority - a.priority);
    
    // 3. Find the first rule that matches
    for (const rule of relevantRules) {
        const keywords = rule.keywords ? rule.keywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean) : [];
        const excludeKeywords = rule.excludeKeywords ? rule.excludeKeywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean) : [];
        
        let matches = keywords.length === 0; // If no keywords, it's a match by default (catch-all)
        
        // Check for keyword matches
        if (keywords.length > 0) {
            if (keywords.some(keyword => lowercasedDescription.includes(keyword))) {
                matches = true;
            } else {
                matches = false;
            }
        }
        
        // Check for exclusion keyword matches
        if (matches && excludeKeywords.length > 0) {
            if (excludeKeywords.some(keyword => lowercasedDescription.includes(keyword))) {
                matches = false; // Excluded, so this rule doesn't match
            }
        }
        
        if (matches) {
            return rule.nominalCodeId; // Found the highest priority match
        }
    }

    return null; // No rule found
};
