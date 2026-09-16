import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';

const VersionChecker = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const checkVersion = useCallback(async () => {
        try {
            // Trigger service worker update check if supported
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.update().catch(() => {}));
                }).catch(() => {});
            }

            // Add a cache-buster query string and disable cache
            const response = await fetch(`/version.json?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (!response.ok) return;
            
            const data = await response.json();
            
            // Compare fetched version timestamp against the built-in __APP_VERSION__
            if (data.version && typeof __APP_VERSION__ !== 'undefined' && data.version !== __APP_VERSION__) {
                console.log("[VersionChecker] New version detected:", data.version, "Current:", __APP_VERSION__);
                setUpdateAvailable(true);
            }
        } catch (err) {
            // Ignore network errors (e.g. if offline)
        }
    }, []);

    useEffect(() => {
        // Immediate check on mount
        checkVersion();

        // Check every 30 seconds for rapid detection
        const intervalId = setInterval(checkVersion, 30 * 1000);

        // Also check version immediately when user switches back to the tab
        const handleActivity = () => {
            if (document.visibilityState === 'visible') {
                checkVersion();
            }
        };

        document.addEventListener('visibilitychange', handleActivity);
        window.addEventListener('focus', checkVersion);
        
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleActivity);
            window.removeEventListener('focus', checkVersion);
        };
    }, [checkVersion]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Unregister/update service workers and clear browser caches
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.update();
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                }
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
        } catch (err) {
            console.warn("[VersionChecker] Cache clear warning:", err);
        }
        window.location.reload();
    };

    if (!updateAvailable || dismissed) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[99999] bg-indigo-600 text-white p-3 shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-700 rounded-full animate-pulse">
                    <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">Update Available</h4>
                    <p className="text-xs text-indigo-100">A new version of the system has been released.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-white text-indigo-700 text-sm font-bold rounded shadow hover:bg-indigo-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Updating...' : 'Refresh Now'}
                </button>
                <button 
                    onClick={() => setDismissed(true)} 
                    className="p-1 hover:bg-indigo-700 rounded transition-colors text-indigo-200 hover:text-white"
                    title="Dismiss notification"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default VersionChecker;
