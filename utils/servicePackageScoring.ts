import { ServicePackage, Vehicle } from '../types';

export interface ScoredPackage {
    pkg: ServicePackage;
    score: number;
    matchType: string;
    status: 'exact' | 'model' | 'make' | 'generic' | 'other';
    color?: string; 
}

export const getScoredServicePackages = (
    servicePackages: ServicePackage[], 
    vehicle?: Partial<Vehicle> | null
): ScoredPackage[] => {
    // If no vehicle is selected, treat all as Generic
    if (!vehicle) {
        return servicePackages.map(pkg => ({ 
            pkg, 
            score: 1, // Generic base score
            matchType: 'Generic', 
            status: 'generic' as const,
            color: 'bg-gray-100 text-gray-800'
        }));
    }

    // Normalization: "PORSCHE" -> "porsche", "911 CARRERA 2S" -> "911 carrera 2s"
    const clean = (str: string | undefined | null) => 
        (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const vMake = clean(vehicle.make);
    const vModel = clean(vehicle.model);
    const vehicleFullString = `${vMake} ${vModel}`.trim();

    const scored: ScoredPackage[] = servicePackages.map(pkg => {
        const pMake = clean(pkg.applicableMake);     
        const pModel = clean(pkg.applicableModel);   
        
        let score = 0; 
        let matchType = 'Other';
        let status: ScoredPackage['status'] = 'other';
        let color = 'bg-gray-50 text-gray-400';

        // 1. Generic Check (No specific make/model defined for the package)
        if (!pMake && !pModel) {
            score = 1;
            matchType = 'Generic';
            status = 'generic';
            color = 'bg-slate-100 text-slate-700';
        } 
        // 2. Fuzzy Match Logic: Check if vehicle string contains package keywords
        else if (pMake && vehicleFullString.includes(pMake)) {
            score = 2; // Make Match
            matchType = 'Make Match';
            status = 'make';
            color = 'bg-amber-100 text-amber-800 border-amber-300';

            // Check for Model within the full string (e.g., "911" inside "911 CARRERA 2S")
            if (pModel && vehicleFullString.includes(pModel)) {
                score = 3; // Model Match (Higher Priority)
                matchType = 'Model Match';
                status = 'model';
                color = 'bg-green-100 text-green-900 border-green-400 ring-1 ring-green-500';
            }
        }
        
        return { pkg, score, matchType, status, color };
    });

    // CRITICAL: Sort by score DESCENDING so best matches (3) are at the top
    return [...scored].sort((a, b) => b.score - a.score);
};