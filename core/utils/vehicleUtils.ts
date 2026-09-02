/**
 * Utility functions for vehicle properties, wheelbase categorization, and lift warnings.
 */

export interface WheelbaseAlertInfo {
    type: 'XLWB' | 'LWB' | 'MWB' | 'SWB' | string;
    label: string;
    fullLabel: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    isAlert: boolean;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    badgeClass: string;
    bannerClass: string;
    cardAccentClass: string;
    warningMessage: string;
}

/**
 * Returns categorized wheelbase alert details for dispatchers and workshop schedulers.
 */
export const getWheelbaseAlertInfo = (wheelbaseType?: string): WheelbaseAlertInfo | null => {
    if (!wheelbaseType) return null;
    const clean = wheelbaseType.trim();
    if (!clean) return null;
    const upper = clean.toUpperCase();

    // 1. Extra Long Wheelbase (XLWB / L4 / Maxi)
    if (upper.includes('XLWB') || upper.includes('EXTRA LONG') || upper.includes('EXTENDED') || upper.includes('MAXI') || upper.includes('L4')) {
        return {
            type: 'XLWB',
            label: '⚠️ XLWB',
            fullLabel: 'Extra Long Wheelbase (XLWB)',
            severity: 'critical',
            isAlert: true,
            badgeBg: 'bg-rose-600',
            badgeText: 'text-white',
            badgeBorder: 'border-rose-700',
            badgeClass: 'bg-rose-500 text-white border-rose-600 font-black shadow-xs',
            bannerClass: 'bg-rose-50 border-rose-200 text-rose-950',
            cardAccentClass: 'ring-2 ring-rose-400 bg-rose-50/40',
            warningMessage: 'Extra Long Wheelbase: Requires extended ramp/lift capacity. Verify bay suitability!'
        };
    }

    // 2. Long Wheelbase (LWB / L3)
    if (upper.includes('LWB') || upper.includes('LONG') || upper.includes('L3')) {
        return {
            type: 'LWB',
            label: '⚠️ LWB',
            fullLabel: 'Long Wheelbase (LWB)',
            severity: 'high',
            isAlert: true,
            badgeBg: 'bg-amber-500',
            badgeText: 'text-white',
            badgeBorder: 'border-amber-600',
            badgeClass: 'bg-amber-400 text-amber-950 border-amber-500 font-black shadow-xs',
            bannerClass: 'bg-amber-50 border-amber-200 text-amber-950',
            cardAccentClass: 'ring-2 ring-amber-400 bg-amber-50/40',
            warningMessage: 'Long Wheelbase: Restricted length. Check lift capacity before bay allocation.'
        };
    }

    // 3. Medium Wheelbase (MWB / L2)
    if (upper.includes('MWB') || upper.includes('MEDIUM') || upper.includes('MID') || upper.includes('L2')) {
        return {
            type: 'MWB',
            label: 'MWB',
            fullLabel: 'Medium Wheelbase (MWB)',
            severity: 'medium',
            isAlert: true,
            badgeBg: 'bg-sky-600',
            badgeText: 'text-white',
            badgeBorder: 'border-sky-700',
            badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 font-black',
            bannerClass: 'bg-sky-50 border-sky-200 text-sky-950',
            cardAccentClass: 'ring-1 ring-sky-300',
            warningMessage: 'Medium Wheelbase: Check lift clearance.'
        };
    }

    // 4. Short Wheelbase (SWB / L1)
    if (upper.includes('SWB') || upper.includes('SHORT') || upper.includes('L1')) {
        return {
            type: 'SWB',
            label: 'SWB',
            fullLabel: 'Short Wheelbase (SWB)',
            severity: 'low',
            isAlert: false,
            badgeBg: 'bg-slate-500',
            badgeText: 'text-white',
            badgeBorder: 'border-slate-600',
            badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
            bannerClass: 'bg-slate-50 border-slate-200 text-slate-800',
            cardAccentClass: '',
            warningMessage: 'Standard / Short Wheelbase.'
        };
    }

    // Default other format
    return {
        type: upper,
        label: upper,
        fullLabel: clean,
        severity: 'info',
        isAlert: false,
        badgeBg: 'bg-gray-500',
        badgeText: 'text-white',
        badgeBorder: 'border-gray-600',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-medium',
        bannerClass: 'bg-slate-50 border-slate-200 text-slate-800',
        cardAccentClass: '',
        warningMessage: clean
    };
};
