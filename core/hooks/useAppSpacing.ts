import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'brookspeed_app_spacing';

/**
 * Checks if the current window is running as an installed standalone app
 * (e.g. Chrome / Edge desktop PWA, Windows / macOS installed app, iOS / Android standalone).
 */
export const checkIsStandaloneApp = (): boolean => {
    if (typeof window === 'undefined') return false;

    const isStandaloneDisplay = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;

    const isIosStandalone = (window.navigator as any).standalone === true;
    const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');

    const searchParams = new URLSearchParams(window.location.search);
    const hasAppParam = 
        searchParams.get('mode') === 'app' || 
        searchParams.get('source') === 'pwa' || 
        searchParams.get('display') === 'standalone';

    return isStandaloneDisplay || isIosStandalone || isAndroidApp || hasAppParam;
};

export const useAppSpacing = () => {
    const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandaloneApp());

    const [isAppSpacing, setIsAppSpacing] = useState<boolean>(() => {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (stored === 'comfortable') return true;
        if (stored === 'compact') return false;
        // Default to enabled if running in standalone app or installed mode
        return checkIsStandaloneApp();
    });

    useEffect(() => {
        const handleDisplayModeChange = () => {
            const standalone = checkIsStandaloneApp();
            setIsStandalone(standalone);
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                setIsAppSpacing(standalone);
            }
        };

        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleDisplayModeChange);
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleDisplayModeChange);
            }
        };
    }, []);

    // Synchronize HTML/body class for CSS rules
    useEffect(() => {
        if (typeof document !== 'undefined') {
            if (isAppSpacing) {
                document.documentElement.classList.add('app-spacing-mode');
                document.body.classList.add('app-spacing-mode');
            } else {
                document.documentElement.classList.remove('app-spacing-mode');
                document.body.classList.remove('app-spacing-mode');
            }
        }
    }, [isAppSpacing]);

    const toggleAppSpacing = useCallback(() => {
        setIsAppSpacing(prev => {
            const next = !prev;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, next ? 'comfortable' : 'compact');
            }
            return next;
        });
    }, []);

    return {
        isAppSpacing,
        isStandalone,
        toggleAppSpacing
    };
};
