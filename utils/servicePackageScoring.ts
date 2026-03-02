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
    if (!vehicle || !vehicle.make) {
        return servicePackages.map(pkg => ({ 
            pkg, 
            score: pkg.applicableMake || pkg.applicableModel ? 0 : 1,
            matchType: pkg.applicableMake || pkg.applicableModel ? 'Other' : 'Generic', 
            status: pkg.applicableMake || pkg.applicableModel ? 'other' : 'generic' as const,
            color: pkg.applicableMake || pkg.applicableModel ? 'bg-gray-50 text-gray-400' : 'bg-slate-100 text-slate-700'
        }));
    }

    const clean = (str: string | undefined | null) => 
        (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const vMake = clean(vehicle.make);
    const vModel = clean(vehicle.model);

    const scored: ScoredPackage[] = servicePackages.map(pkg => {
        const pName = clean(pkg.name);
        const pMake = clean(pkg.applicableMake);
        const pModel = clean(pkg.applicableModel);
        
        let score = 0; 
        let matchType = 'Other';
        let status: ScoredPackage['status'] = 'other';
        let color = 'bg-gray-50 text-gray-400';

        const isMakeMatch = pMake && (vMake.includes(pMake) || pMake.includes(vMake));
        const isModelMatch = pModel && (vModel.includes(pModel) || pModel.includes(vModel));

        // Score 4: Exact Name Match (e.g., package name contains "porsche" and "911")
        if (vMake && vModel && pName.includes(vMake) && pName.includes(vModel)) {
            score = 4;
            matchType = 'Exact Name Match';
            status = 'exact' as const;
            color = 'bg-indigo-100 text-indigo-900 border-indigo-400';
        }
        // Score 3: Model Match (e.g., package applicable make/model is a match)
        else if (isMakeMatch && isModelMatch) {
            score = 3;
            matchType = `Model Match (${pkg.applicableModel})`;
            status = 'model' as const;
            color = 'bg-green-100 text-green-900 border-green-400';
        }
        // Score 2: Make Match
        else if (isMakeMatch) {
            score = 2;
            matchType = `Make Match (${pkg.applicableMake})`;
            status = 'make' as const;
            color = 'bg-amber-100 text-amber-800 border-amber-300';
        }
        // Score 1: Generic Package
        else if (!pMake && !pModel) {
            score = 1;
            matchType = 'Generic';
            status = 'generic' as const;
            color = 'bg-slate-100 text-slate-700';
        }

        return { pkg, score, matchType, status, color };
    });

    return [...scored].sort((a, b) => b.score - a.score);
};
