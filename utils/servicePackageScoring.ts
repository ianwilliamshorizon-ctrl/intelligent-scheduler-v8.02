import { ServicePackage, Vehicle } from '../types';

export type PackageGrade = 'exact' | 'model' | 'make' | 'generic' | 'other';

export interface ScoredPackage {
    pkg: ServicePackage;
    score: number;
    grade: PackageGrade;
    gradeLabel: string;
    matchType: string;
    status: 'exact' | 'model' | 'make' | 'engine' | 'narrative' | 'generic' | 'other';
    color?: string;
    badgeColor?: string;
    narrativeMatched?: boolean;
    fuelConflict?: boolean;
    fuelConflictNotice?: string;
}

const KNOWN_MAKES = [
    'porsche', 'audi', 'bmw', 'mercedes', 'volkswagen', 'vw', 
    'landrover', 'rangerover', 'jaguar', 'ford', 'ferrari', 
    'mclaren', 'astonmartin', 'lamborghini', 'bentley', 'rollsroyce', 'maserati', 'lotus',
    'toyota', 'honda', 'nissan', 'peugeot', 'renault', 'volvo'
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
    const vModelRaw = String(vehicle?.model ?? '').toLowerCase();
    const vVariantRaw = String((vehicle as any)?.variant || (vehicle as any)?.subModel || '').toLowerCase();
    const vFuelRaw = String(vehicle?.fuelType || '').toLowerCase();
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
        const pkgFullText = `${pName} ${pkg.applicableModel || ''} ${pkg.applicableVariant || ''} ${pDesc}`.toLowerCase();
        
        let score = 0; 
        let matchType = 'Other';
        let grade: PackageGrade = 'other';
        let gradeLabel = 'Other';
        let status: ScoredPackage['status'] = 'other';
        let color = 'bg-gray-50 text-gray-400';
        let badgeColor = 'bg-gray-100 text-gray-600 border-gray-200';
        let narrativeMatched = false;
        let fuelConflict = false;
        let fuelConflictNotice = '';

        // 1. MAKE MATCH / REJECTION
        if (vMake) {
            const conflictingMake = KNOWN_MAKES.find(km => {
                if (isLR_V && (km === 'landrover' || km === 'rangerover')) return false;
                if (!isLR_V && vMake.includes(km)) return false;
                return (pMake && (pMake.includes(km) || km.includes(pMake))) || 
                       (!pMake && (pName.includes(km) && !pName.includes(vMake)));
            });

            if (conflictingMake) {
                return { 
                    pkg, 
                    score: 0, 
                    grade: 'other',
                    gradeLabel: 'Brand Conflict',
                    matchType: 'Brand Conflict', 
                    status: 'other', 
                    color: 'bg-gray-50 text-gray-400',
                    badgeColor: 'bg-red-50 text-red-600 border-red-200'
                };
            }
        }

        const isLR_P = pMake.includes('landrover') || pMake.includes('rangerover');
        const isMakeMatch = Boolean((pMake && vMake && (vMake.includes(pMake) || pMake.includes(vMake))) || (vMake && pName.includes(vMake)) || (isLR_V && isLR_P));
        const isUniversal = !pMake && !pModel && !pEngineSize && !pkg.applicableVariant;

        // 2. MODEL MATCH & CROSS-MODEL PENALTY
        let isModelExact = false;
        let hasCrossModelConflict = false;

        if (vModelTokens.length > 0) {
            const vehicleFamily = MODEL_FAMILIES.find(fam => vFullModelStr.includes(fam));
            const pkgFamily = MODEL_FAMILIES.find(fam => pkgFullText.includes(fam));

            if (vehicleFamily && pkgFamily && vehicleFamily !== pkgFamily) {
                hasCrossModelConflict = true;
            } else {
                const matchedTokens = vModelTokens.filter(tok => pkgFullText.includes(tok));
                if (matchedTokens.length > 0 || (pModel && vModelRaw && (pModel.includes(vModelRaw) || vModelRaw.includes(pModel)))) {
                    isModelExact = true;
                }
            }
        } else if (isMakeMatch && (!pModel || pModel === 'all')) {
            isModelExact = true;
        }

        // 3. VARIANT & FUEL COMPATIBILITY
        let isVariantExact = false;
        const variantKeywords = ['gts', 'turbo', 'carrera', 'gt3', 'gt4', 'rs', 'c4s', 'diesel', 'hybrid', 'amg', 'svr', 'mport', '3.0', 'v6', 'v8'];
        const matchedVariantKeywords = variantKeywords.filter(vk => vFullModelStr.includes(vk) && pkgFullText.includes(vk));

        if (matchedVariantKeywords.length > 0) {
            isVariantExact = true;
        } else if (!pVariant || pVariant === 'all' || pVariant === 'general') {
            // Package is for all variants of that model
            isVariantExact = true;
        }

        // Fuel check: Petrol vs Diesel conflict
        const pkgMentionsDiesel = pkgFullText.includes('diesel');
        const pkgMentionsPetrol = pkgFullText.includes('petrol') || pkgFullText.includes('v6 petrol') || pkgFullText.includes('gasoline');

        if (vFuelRaw.includes('diesel')) {
            if (pkgMentionsPetrol && !pkgMentionsDiesel) {
                fuelConflict = true;
                fuelConflictNotice = 'Vehicle is Diesel, but package specifies Petrol';
            }
        } else if (vFuelRaw.includes('petrol')) {
            if (pkgMentionsDiesel && !pkgMentionsPetrol) {
                fuelConflict = true;
                fuelConflictNotice = 'Vehicle is Petrol, but package specifies Diesel';
            }
        }

        // 4. HIERARCHICAL GRADING ASSIGNMENT
        if (isMakeMatch) {
            if (isModelExact && !hasCrossModelConflict) {
                if (fuelConflict) {
                    // Make & Model match, but Fuel conflicts
                    grade = 'model';
                    gradeLabel = 'Model Match (Fuel Differs)';
                    matchType = 'Model Match (Fuel Conflict)';
                    status = 'model';
                    score = 500;
                    color = 'bg-blue-50 text-blue-900 border-blue-300';
                    badgeColor = 'bg-blue-100 text-blue-900 border-blue-400';
                } else if (isVariantExact) {
                    // Exact Make, Model, and Variant/Trim/Fuel match!
                    grade = 'exact';
                    gradeLabel = '★ Exact Match';
                    matchType = matchedVariantKeywords.length > 0 ? 'Exact Model & Variant Match' : 'Model Match';
                    status = 'exact';
                    score = 1000;
                    color = 'bg-emerald-100 text-emerald-950 border-emerald-500 font-bold';
                    badgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-500 font-black';
                } else {
                    // Make & Model match, general/other variant
                    grade = 'model';
                    gradeLabel = 'Model Match';
                    matchType = 'Model Match';
                    status = 'model';
                    score = 650;
                    color = 'bg-blue-50 text-blue-900 border-blue-300';
                    badgeColor = 'bg-blue-100 text-blue-900 border-blue-400 font-bold';
                }
            } else {
                // Make matches, but different model in the brand catalog
                grade = 'make';
                gradeLabel = 'Make Match (Partial)';
                matchType = 'Make Match (Other Model)';
                status = 'make';
                score = 100;
                color = 'bg-amber-50 text-amber-900 border-amber-300';
                badgeColor = 'bg-amber-100 text-amber-900 border-amber-400 font-bold';
            }
        } else if (isUniversal) {
            grade = 'generic';
            gradeLabel = 'Universal';
            matchType = 'Universal Workshop Service';
            status = 'generic';
            score = 20;
            color = 'bg-slate-50 text-slate-700 border-slate-300';
            badgeColor = 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
        } else {
            grade = 'other';
            gradeLabel = 'Other';
            matchType = 'Other';
            status = 'other';
            score = 0;
            color = 'bg-gray-50 text-gray-400';
            badgeColor = 'bg-gray-100 text-gray-500 border-gray-200';
        }

        // 5. NARRATIVE / SEARCH BOOSTING WITHIN GRADE
        let narrativeBoost = 0;
        const cleanPkgText = `${clean(pName)} ${clean(pDesc)}`;

        // Scope match (Minor vs Interim vs Major vs MOT)
        for (const sc of matchedScopes) {
            const matchesKw = sc.pkgKeywords.some(kw => cleanPkgText.includes(kw));
            if (matchesKw) {
                narrativeBoost += 50;
                narrativeMatched = true;
            }
            if (sc.antonyms.some(ant => cleanPkgText.includes(ant))) {
                narrativeBoost -= 25;
            }
        }

        // Tier match (Bronze vs Silver vs Gold)
        for (const tc of matchedTiers) {
            const matchesKw = tc.pkgKeywords.some(kw => cleanPkgText.includes(kw));
            if (matchesKw) {
                narrativeBoost += 50;
                narrativeMatched = true;
            }
        }

        // Freeform keywords
        if (cleanNarrative.length >= 3 && matchedScopes.length === 0 && matchedTiers.length === 0) {
            if (cleanPkgText.includes(cleanNarrative)) {
                narrativeBoost += 30;
                narrativeMatched = true;
            } else if (pDesc.includes(cleanNarrative)) {
                narrativeBoost += 15;
                narrativeMatched = true;
            }
        }

        // Engine size tie-breaker bonus
        if (pEngineSize && vEngineSize) {
            const diff = Math.abs(pEngineSize - vEngineSize);
            if (diff <= 100) narrativeBoost += 5;
            else if (diff <= 500) narrativeBoost += 2;
        }

        // Tier order tie-breaker if no explicit narrative: Minor before Major, Bronze before Silver before Gold
        if (!cleanNarrative) {
            if (cleanPkgText.includes('minor')) narrativeBoost += 6;
            if (cleanPkgText.includes('bronze')) narrativeBoost += 3;
            else if (cleanPkgText.includes('silver')) narrativeBoost += 2;
            else if (cleanPkgText.includes('gold')) narrativeBoost += 1;
        }

        const finalScore = Math.max(0, score + narrativeBoost);

        return { 
            pkg, 
            score: finalScore, 
            grade, 
            gradeLabel, 
            matchType, 
            status, 
            color, 
            badgeColor,
            narrativeMatched, 
            fuelConflict, 
            fuelConflictNotice 
        };
    });

    const finalScores = [...scored].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // Tie-breaker: prefer exact over model over make over generic
        const gradeRank: Record<PackageGrade, number> = {
            exact: 4,
            model: 3,
            make: 2,
            generic: 1,
            other: 0
        };
        return (gradeRank[b.grade] || 0) - (gradeRank[a.grade] || 0);
    });

    return finalScores;
};
