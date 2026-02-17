import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext';

export const useAutoLogout = (timeoutMs = 30 * 60 * 1000) => {
    const { logout, currentUser } = useApp();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (currentUser) {
                console.log("Session expired due to inactivity. Logging out.");
                logout();
            }
        }, timeoutMs);
    };

    useEffect(() => {
        // Only run if user is logged in
        if (!currentUser) return;

        // Listen for activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetTimer));

        // Initial timer start
        resetTimer();

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [currentUser]);
};