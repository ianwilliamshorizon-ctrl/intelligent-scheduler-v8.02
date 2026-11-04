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

// Scope clusters: What level of service is requested (Minor vs Interim vs Major vs MOT, etc.)
const SCOPE_CLUSTERS: IntentCluster[] = [
    {
        id: 'minor',
        synonyms: ['minor', 'oilservice', 'oilchange', 'basicservice', 'basic', 'baseline'],
        antonyms: ['major'],
        pkgKeywords: ['minor', 'oilservice']
    },
    {
        id: 'interim',
        synonyms: ['interim', 'medium', 'standardservice', 'midsvc'],
        antonyms: [],
        pkgKeywords: ['interim']
    },
    {
        id: 'major',
        synonyms: ['major', 'fullservice', 'masterservice', 'comprehensive', 'inspection2', 'inspectionii'],
        antonyms: ['minor'],
        pkgKeywords: ['major', 'fullservice', 'masterservice']
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

// Tier clusters: Quality / package tier (Bronze vs Silver vs Gold)
const TIER_CLUSTERS: IntentCluster[] = [
    {
        id: 'bronze',
        synonyms: ['bronze'],
        antonyms: ['silver', 'gold'],
        pkgKeywords: ['bronze']
    },
    {
        id: 'silver',
        synonyms: ['silver'],
        antonyms: ['bronze', 'gold'],
        pkgKeywords: ['silver']
    },
    {
        id: 'gold',
        synonyms: ['gold'],
        antonyms: ['bronze', 'silver'],
        pkgKeywords: ['gold']
    }
];

// Distinct model families to prevent cross-model package pollution within the same manufacturer
const MODEL_FAMILIES = [
    'macan', 'cayenne', 'panamera', 'boxster', 'cayman', '911', '996', '997', '991', '992', 
    '930', '964', '993', '718', '981', 'gt3', 'evoque', 'velar', 'sport', 'discovery', 'defender'
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
    const vModelRaw = String(vehicle?.model || '').toLowerCase();
    const vVariantRaw = String((vehicle as any)?.variant || (vehicle as any)?.subModel || '').toLowerCase();
    const vFullModelStr = `${vModelRaw} ${vVariantRaw}`.toLowerCase();
    const vModelTokens = vFullModelStr.split(/[^a-z0-9]+/).filter(t => t.length >= 2);
    const vEngineSize = vehicle?.cc ? Number(vehicle.cc) : undefined;
    const isLR_V = vMake.includes('landrover') || vMake.includes('rangerover');

    // Identify which intent scope and tier clusters match client requirement narrative
    const matchedScopes: IntentCluster[] = [];
    const matchedTiers: IntentCluster[] = [];

    if (cleanNarrative) {
        for (const sc of SCOPE_CLUSTERS) {
            if (sc.synonyms.some(syn => cleanNarrative.includes(syn))) {
                matchedScopes.push(sc);
            }
        }
        for (const tc of TIER_CLUSTERS) {
            if (tc.synonyms.some(syn => cleanNarrative.includes(syn))) {
                matchedTiers.push(tc);
            }
        }
    }

    const scored: ScoredPackage[] = (servicePackages || []).map(pkg => {
        const pName = (pkg.name || '').toLowerCase();
        const pDesc = (pkg.description || '').toLowerCase();
        const pMake = clean(pkg.applicableMake);
        const pModel = clean(pkg.applicableModel);
        const pVariant = clean(pkg.applicableVariant);
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
                return { pkg, score: 0, matchType: 'Brand Conflict', status: 'other', color: 'bg-gray-50 text-gray-400' };
            }
        }

        const isLR_P = pMake.includes('landrover') || pMake.includes('rangerover');
        const isMakeMatch = Boolean((pMake && vMake && (vMake.includes(pMake) || pMake.includes(vMake))) || (isLR_V && isLR_P));

        // Refined Model & Variant token matching
        let modelMatchScore = 0;
        let isModelExact = false;
        let isVariantExact = false;

        if (vModelTokens.length > 0) {
            const pkgFullText = `${pName} ${pModel} ${pVariant}`.toLowerCase();
            const matchedTokens = vModelTokens.filter(tok => pkgFullText.includes(tok));

            // Check for cross-model family conflicts (e.g. vehicle is Macan, package is 911 / Cayman)
            const vehicleFamily = MODEL_FAMILIES.find(fam => vFullModelStr.includes(fam));
            const pkgFamily = MODEL_FAMILIES.find(fam => pkgFullText.includes(fam));

            if (vehicleFamily && pkgFamily && vehicleFamily !== pkgFamily) {
                // Cross model penalty
                modelMatchScore -= 18;
            } else if (matchedTokens.length > 0) {
                modelMatchScore += matchedTokens.length * 6;
                isModelExact = true;

                // High-value trim / submodel tokens (e.g. GTS, Turbo, Carrera, S, GT3, RS, 4S)
                const variantKeywords = ['gts', 'turbo', 'carrera', 'gt3', 'rs', 'c4s', 'diesel', 'hybrid', 'amg', 'svr', 'mport'];
                const hasVariantMatch = variantKeywords.some(vk => vFullModelStr.includes(vk) && pkgFullText.includes(vk));
                if (hasVariantMatch) {
                    modelMatchScore += 10;
                    isVariantExact = true;
                }
            }
        }

        // Engine size match
        let engineScore = 0;
        if (pEngineSize && vEngineSize) {
            const diff = Math.abs(pEngineSize - vEngineSize);
            if (diff <= 100) engineScore += 5;
            else if (diff <= 500) engineScore += 2;
        }

        // Baseline Vehicle Match Scoring
        if (isMakeMatch) {
            score = 6 + modelMatchScore + engineScore;
            if (isModelExact && isVariantExact) {
                matchType = 'Model & Variant Match';
                status = 'exact';
                color = 'bg-emerald-100 text-emerald-900 border-emerald-500 font-bold';
            } else if (isModelExact) {
                matchType = 'Model Match';
                status = 'model';
                color = 'bg-emerald-50 text-emerald-800 border-emerald-400';
            } else if (modelMatchScore < 0) {
                matchType = 'Other Model';
                status = 'other';
                color = 'bg-gray-100 text-gray-500';
            } else {
                matchType = 'Make Match';
                status = 'make';
                color = 'bg-amber-100 text-amber-800 border-amber-300';
            }
        } else if (!pMake && !pModel && !pEngineSize) {
            score = 2;
            matchType = 'Generic / Universal';
            status = 'generic';
            color = 'bg-slate-100 text-slate-700';
        } else if ((vMake && pName.includes(vMake)) || (isLR_V && (pName.includes('landrover') || pName.includes('rangerover')))) {
            score = 3;
            matchType = 'Name Match';
            status = 'other';
            color = 'bg-indigo-100 text-indigo-900';
        }

        // Narrative / Client Requirement Boost & Penalty
        let narrativeBoost = 0;
        const cleanPkgText = `${clean(pName)} ${clean(pDesc)}`;

        // 1. Service Scope Matching (Minor vs Interim vs Major vs MOT)
        for (const sc of matchedScopes) {
            const matchesKw = sc.pkgKeywords.some(kw => cleanPkgText.includes(kw));
            if (matchesKw) {
                narrativeBoost += 14;
                narrativeMatched = true;
            }
            if (sc.antonyms.some(ant => cleanPkgText.includes(ant))) {
                narrativeBoost -= 10;
            }
        }

        // 2. Tier Matching (Bronze vs Silver vs Gold)
        for (const tc of matchedTiers) {
            const matchesKw = tc.pkgKeywords.some(kw => cleanPkgText.includes(kw));
            if (matchesKw) {
                narrativeBoost += 16;
                narrativeMatched = true;
            }
            if (tc.antonyms.some(ant => cleanPkgText.includes(ant))) {
                narrativeBoost -= 8;
            }
        }

        // 3. Freeform keywords
        if (cleanNarrative.length >= 3 && matchedScopes.length === 0 && matchedTiers.length === 0) {
            if (cleanPkgText.includes(cleanNarrative)) {
                narrativeBoost += 10;
                narrativeMatched = true;
            } else if (pDesc.includes(cleanNarrative)) {
                narrativeBoost += 5;
                narrativeMatched = true;
            }
        }

        const finalScore = Math.max(0, score + narrativeBoost);

        if (narrativeMatched) {
            if (isMakeMatch && (isModelExact || isVariantExact)) {
                matchType = 'Model & Requirement Match';
                status = 'exact';
                color = 'bg-emerald-100 text-emerald-950 border-emerald-500 font-bold';
            } else if (isMakeMatch) {
                matchType = 'Make & Requirement Match';
                status = 'exact';
                color = 'bg-teal-100 text-teal-950 border-teal-500 font-bold';
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
