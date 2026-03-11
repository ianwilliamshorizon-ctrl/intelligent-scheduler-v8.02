import { ServicePackage, Vehicle } from '../types';

export interface ScoredPackage {
    pkg: ServicePackage;
    score: number;
    matchType: string;
    status: 'exact' | 'model' | 'make' | 'engine' | 'generic' | 'other';
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
    const vEngineSize = vehicle.cc;

    const scored: ScoredPackage[] = servicePackages.map(pkg => {
        const pName = clean(pkg.name);
        const pMake = clean(pkg.applicableMake);
        const pModel = clean(pkg.applicableModel);
        const pEngineSize = pkg.applicableEngineSize;
        
        let score = 0; 
        let matchType = 'Other';
        let status: ScoredPackage['status'] = 'other';
        let color = 'bg-gray-50 text-gray-400';

        const isMakeMatch = pMake && (vMake.includes(pMake) || pMake.includes(vMake));
        const isModelMatch = pModel && (vModel.includes(pModel) || pModel.includes(vModel));
        const isEngineSizeMatch = pEngineSize && vEngineSize && pEngineSize === vEngineSize;

        if (isMakeMatch && isModelMatch && isEngineSizeMatch) {
            score = 5;
            matchType = `Exact Match`;
            status = 'exact';
            color = 'bg-emerald-100 text-emerald-900 border-emerald-400';
        } else if (isMakeMatch && isModelMatch) {
            score = 4;
            matchType = `Model Match`;
            status = 'model';
            color = 'bg-green-100 text-green-900 border-green-400';
        } else if (isMakeMatch && pEngineSize && vEngineSize && pEngineSize >= vEngineSize) {
            score = 3.5; 
            matchType = `Engine Match`;
            status = 'engine';
            color = 'bg-sky-100 text-sky-900 border-sky-400';
        } else if (isMakeMatch) {
            score = 3;
            matchType = `Make Match`;
            status = 'make';
            color = 'bg-amber-100 text-amber-800 border-amber-300';
        } else if (!pMake && !pModel && !pEngineSize) {
            score = 1;
            matchType = 'Generic';
            status = 'generic';
            color = 'bg-slate-100 text-slate-700';
        } else if (pName.includes(vMake) && pName.includes(vModel)) {
            score = 2;
            matchType = 'Name Match';
            status = 'other';
            color = 'bg-indigo-100 text-indigo-900';
        }

        return { pkg, score, matchType, status, color };
    });

    const finalScores = [...scored].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (a.status === 'engine' && b.status === 'engine') {
            return (a.pkg.applicableEngineSize || 0) - (b.pkg.applicableEngineSize || 0);
        }
        return 0;
    });

    return finalScores;
};
