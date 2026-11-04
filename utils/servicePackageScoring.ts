import { ServicePackage, Vehicle } from '../types';

export interface ScoredPackage {
    pkg: ServicePackage;
    score: number;
    matchType: string;
    status: 'exact' | 'model' | 'make' | 'engine' | 'narrative' | 'generic' | 'other';
    color?: string;
    narrativeMatched?: boolean;
}

const KNOWN_MAKES = [
    'porsche', 'audi', 'bmw', 'mercedes', 'volkswagen', 'vw', 
    'landrover', 'rangerover', 'jaguar', 'ford', 'ferrari', 
    'mclaren', 'astonmartin', 'lamborghini', 'bentley', 'rollsroyce', 'maserati', 'lotus'
];

interface IntentCluster {
    id: string;
    synonyms: string[];
    antonyms: string[];
    pkgKeywords: string[];
}

const INTENT_CLUSTERS: IntentCluster[] = [
    {
        id: 'minor',
        synonyms: ['minor', 'bronze', 'small', 'oilservice', 'oilchange', 'basicservice', 'basic', 'interim'],
        antonyms: ['major', 'gold'],
        pkgKeywords: ['minor', 'bronze', 'oilservice', 'interim']
    },
    {
        id: 'interim',
        synonyms: ['interim', 'silver', 'medium', 'standardservice', 'midsvc'],
        antonyms: [],
        pkgKeywords: ['interim', 'silver']
    },
    {
        id: 'major',
        synonyms: ['major', 'gold', 'fullservice', 'masterservice', 'comprehensive', 'inspection2', 'inspectionii'],
        antonyms: ['minor', 'bronze'],
        pkgKeywords: ['major', 'gold', 'fullservice', 'masterservice']
    },
    {
        id: 'mot',
        synonyms: ['mot', 'ministry', 'class4', 'class7', 'mottest'],
        antonyms: [],
        pkgKeywords: ['mot']
    },
    {
        id: 'timing_belt',
        synonyms: ['timingbelt', 'cambelt', 'cambeltchange', 'drivebelt', 'belt', 'serpentine', 'tensioner', 'waterpump'],
        antonyms: [],
        pkgKeywords: ['timingbelt', 'cambelt', 'drivebelt', 'belt']
    },
    {
        id: 'coolant',
        synonyms: ['coolant', 'cooling', 'antifreeze', 'coolantflush', 'radiator'],
        antonyms: [],
        pkgKeywords: ['coolant', 'cooling', 'antifreeze']
    },
    {
        id: 'brake_fluid',
        synonyms: ['brakefluid', 'hydraulicfluid', 'caliperbleed', 'brakeflush'],
        antonyms: [],
        pkgKeywords: ['brakefluid']
    },
    {
        id: 'brakes',
        synonyms: ['brake', 'brakes', 'brakepad', 'brakedisc', 'padsanddiscs', 'rotors'],
        antonyms: [],
        pkgKeywords: ['brake', 'pad', 'disc']
    },
    {
        id: 'aircon',
        synonyms: ['aircon', 'airconditioning', 'regas', 'regassing', 'recharge', 'r134a', 'r1234yf'],
        antonyms: [],
        pkgKeywords: ['aircon', 'airconditioning', 'regas']
    },
    {
        id: 'health_check',
        synonyms: ['healthcheck', 'inspection', 'diagnostic', 'safetycheck', 'multipoint'],
        antonyms: [],
        pkgKeywords: ['healthcheck', 'inspection', 'check']
    }
];

export const getScoredServicePackages = (
    servicePackages: ServicePackage[], 
    vehicle?: Partial<Vehicle> | null,
    clientNarrative?: string
): ScoredPackage[] => {
    const clean = (str: any) => 
        String(str ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const cleanNarrative = clean(clientNarrative || '');
    const vMake = vehicle?.make ? clean(vehicle.make) : '';
    const vModel = vehicle?.model ? clean(vehicle.model) : '';
    const vEngineSize = vehicle?.cc ? Number(vehicle.cc) : undefined;
    const isLR_V = vMake.includes('landrover') || vMake.includes('rangerover');

    // Identify which intent clusters match client requirement narrative
    const matchedClusters: IntentCluster[] = [];
    if (cleanNarrative) {
        for (const cluster of INTENT_CLUSTERS) {
            const hasMatch = cluster.synonyms.some(syn => cleanNarrative.includes(syn));
            if (hasMatch) {
                matchedClusters.push(cluster);
            }
        }
    }

    const scored: ScoredPackage[] = (servicePackages || []).map(pkg => {
        const pName = clean(pkg.name);
        const pDesc = clean(pkg.description);
        const pMake = clean(pkg.applicableMake);
        const pModel = clean(pkg.applicableModel);
        const pEngineSize = pkg.applicableEngineSize ? Number(pkg.applicableEngineSize) : undefined;
        
        let score = 0; 
        let matchType = 'Other';
        let status: ScoredPackage['status'] = 'other';
        let color = 'bg-gray-50 text-gray-400';
        let narrativeMatched = false;

        // Check for conflicting makes: If vehicle is known make, reject other known makes
        if (vMake) {
            const conflictingMake = KNOWN_MAKES.find(km => {
                if (isLR_V && (km === 'landrover' || km === 'rangerover')) return false;
                if (!isLR_V && vMake.includes(km)) return false;
                return (pMake && (pMake.includes(km) || km.includes(pMake))) || 
                       (!pMake && (pName.includes(km) && !pName.includes(vMake)));
            });

            if (conflictingMake) {
                // Incompatible brand package: Keep score 0 / deprioritised
                return { pkg, score: 0, matchType: 'Brand Conflict', status: 'other', color: 'bg-gray-50 text-gray-400' };
            }
        }

        const isLR_P = pMake.includes('landrover') || pMake.includes('rangerover');
        const isMakeMatch = Boolean((pMake && vMake && (vMake.includes(pMake) || pMake.includes(vMake))) || (isLR_V && isLR_P));
        const isModelMatch = Boolean(pModel && vModel && (vModel.includes(pModel) || pModel.includes(vModel)));
        const isEngineSizeMatch = Boolean(pEngineSize && vEngineSize && pEngineSize === vEngineSize);

        // Baseline Vehicle Match Scoring
        if (isMakeMatch && isModelMatch && isEngineSizeMatch) {
            score = 5;
            matchType = 'Exact Match';
            status = 'exact';
            color = 'bg-emerald-100 text-emerald-900 border-emerald-400';
        } else if (isMakeMatch && isModelMatch) {
            score = 4;
            matchType = 'Model Match';
            status = 'model';
            color = 'bg-green-100 text-green-900 border-green-400';
        } else if (isMakeMatch && pEngineSize && vEngineSize && pEngineSize >= vEngineSize) {
            score = 3.5; 
            matchType = 'Engine Match';
            status = 'engine';
            color = 'bg-sky-100 text-sky-900 border-sky-400';
        } else if (isMakeMatch) {
            score = 3;
            matchType = 'Make Match';
            status = 'make';
            color = 'bg-amber-100 text-amber-800 border-amber-300';
        } else if (!pMake && !pModel && !pEngineSize) {
            score = 1;
            matchType = 'Generic';
            status = 'generic';
            color = 'bg-slate-100 text-slate-700';
        } else if ((vMake && pName.includes(vMake)) || (isLR_V && (pName.includes('landrover') || pName.includes('rangerover')))) {
            score = 2;
            matchType = 'Name Match';
            status = 'other';
            color = 'bg-indigo-100 text-indigo-900';
        }

        // Narrative / Client Requirement Boost & Penalty
        let narrativeBoost = 0;
        if (matchedClusters.length > 0) {
            for (const cluster of matchedClusters) {
                const pkgMatchesKeyword = cluster.pkgKeywords.some(kw => pName.includes(kw) || pDesc.includes(kw));
                const pkgNameDirect = cluster.pkgKeywords.some(kw => pName.includes(kw));

                if (pkgNameDirect) {
                    narrativeBoost += 12;
                    narrativeMatched = true;
                } else if (pkgMatchesKeyword) {
                    narrativeBoost += 9;
                    narrativeMatched = true;
                }

                // Apply penalty if package directly contradicts user requirement (e.g. client asked for Minor, package is Major)
                const isContradiction = cluster.antonyms.some(ant => pName.includes(ant));
                if (isContradiction) {
                    narrativeBoost -= 6;
                }
            }
        } else if (cleanNarrative.length >= 3) {
            // Freeform keyword check when not matching pre-set clusters
            if (pName.includes(cleanNarrative)) {
                narrativeBoost += 8;
                narrativeMatched = true;
            } else if (pDesc.includes(cleanNarrative)) {
                narrativeBoost += 4;
                narrativeMatched = true;
            }
        }

        const finalScore = score + narrativeBoost;

        if (narrativeMatched) {
            if (isMakeMatch) {
                matchType = 'Make & Requirement Match';
                status = 'exact';
                color = 'bg-emerald-100 text-emerald-950 border-emerald-500 font-bold';
            } else {
                matchType = 'Requirement Match';
                status = 'narrative';
                color = 'bg-indigo-100 text-indigo-950 border-indigo-400 font-bold';
            }
        }

        return { pkg, score: finalScore, matchType, status, color, narrativeMatched };
    });

    const finalScores = [...scored].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // If tied on narrative match, prefer make match over generic
        if (a.status === 'exact' && b.status !== 'exact') return -1;
        if (b.status === 'exact' && a.status !== 'exact') return 1;
        if (a.status === 'engine' && b.status === 'engine') {
            return (a.pkg.applicableEngineSize || 0) - (b.pkg.applicableEngineSize || 0);
        }
        return 0;
    });

    return finalScores;
};
