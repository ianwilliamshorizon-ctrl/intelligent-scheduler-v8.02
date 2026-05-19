import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const VersionChecker = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Add a cache-buster query string so we don't read from browser cache
                const response = await fetch(`/version.json?t=${Date.now()}`);
                if (!response.ok) return;
                
                const data = await response.json();
                
                // Compare fetched version timestamp against the build-in __APP_VERSION__
                if (data.version && typeof __APP_VERSION__ !== 'undefined' && data.version !== __APP_VERSION__) {
                    console.log("New version detected:", data.version, "Current:", __APP_VERSION__);
                    setUpdateAvailable(true);
                }
            } catch (err) {
                // Ignore network errors (e.g. if they are offline)
            }
        };

        // Wait 15 seconds before first check, then check every 15 minutes
        const initialTimeout = setTimeout(checkVersion, 15000);
        const intervalId = setInterval(checkVersion, 15 * 60 * 1000);
        
        return () => {
            clearTimeout(initialTimeout);
            clearInterval(intervalId);
        };
    }, []);

    if (!updateAvailable || dismissed) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[99999] bg-blue-600 text-white p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-700 rounded-full animate-pulse">
                    <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">Update Available</h4>
                    <p className="text-xs text-blue-100">A new version of the system has been released.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white text-blue-700 text-sm font-bold rounded shadow hover:bg-blue-50 transition-colors"
                >
                    Refresh Now
                </button>
                <button onClick={() => setDismissed(true)} className="p-1 hover:bg-blue-700 rounded transition-colors text-blue-200 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default VersionChecker;
