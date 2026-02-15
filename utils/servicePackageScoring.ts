import { ServicePackage, Vehicle } from '../types';

export interface ScoredPackage {
    pkg: ServicePackage;
    score: number;
    matchType: string;
    color: string;
}

export const getScoredServicePackages = (
    servicePackages: ServicePackage[], 
    vehicle?: Partial<Vehicle> | null
): ScoredPackage[] => {
    if (!vehicle) {
        return servicePackages.map(pkg => ({ 
            pkg, 
            score: 0, 
            matchType: 'Generic', 
            color: 'bg-gray-100 text-gray-600 border-gray-300' 
        }));
    }

    // Clean strings aggressively: lowercase, trim, and remove double spaces
    const clean = (str: string | undefined | null) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();

    const vMake = clean(vehicle.make);
    const vModel = clean(vehicle.model);

    const scored = servicePackages.map(pkg => {
        const pMake = clean(pkg.applicableMake);
        const pModel = clean(pkg.applicableModel);
        const pVariant = clean(pkg.applicableVarient);
        
        let score = -1; 
        let matchType = 'Other';
        let color = 'bg-gray-50 text-gray-400 border-gray-100 opacity-60';

        // 1. GENERIC CHECK (MOTs etc - no make/model defined)
        if (!pMake && !pModel) {
            score = 0.8;
            matchType = 'Generic';
            color = 'bg-slate-100 text-slate-700 border-slate-300 font-bold';
        } 
        // 2. MAKE MATCH (Check if either contains the other to catch "Porsche" vs "Porsche AG")
        else if (pMake && (vMake.includes(pMake) || pMake.includes(vMake))) {
            if (!pModel) {
                score = 1;
                matchType = 'Make Match';
                color = 'bg-amber-100 text-amber-800 border-amber-300';
            } 
            // 3. MODEL MATCH (Check if model strings overlap)
            else if (vModel.includes(pModel) || pModel.includes(vModel)) {
                if (!pVariant) {
                    score = 2;
                    matchType = 'Model Match';
                    color = 'bg-blue-100 text-blue-800 border-blue-300';
                } 
                // 4. EXACT MATCH (Variant overlap)
                else if (vModel.includes(pVariant) || pVariant.includes(vModel)) {
                    score = 3;
                    matchType = 'Exact Match';
                    color = 'bg-green-100 text-green-900 border-green-400 ring-1 ring-green-500';
                } else {
                    score = 1.5;
                    matchType = 'Model Match';
                    color = 'bg-blue-100 text-blue-800 border-blue-300';
                }
            } else {
                score = 0.5;
                matchType = 'Make Only';
                color = 'bg-gray-200 text-gray-700 border-gray-300'; 
            }
        }
        
        return { pkg, score, matchType, color };
    });

    return [...scored].sort((a, b) => b.score - a.score);
};