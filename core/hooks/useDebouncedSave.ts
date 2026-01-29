
import { useEffect, useRef, useState } from 'react';
import { saveDocument } from '../db';

/**
 * Auto-Sync Hook
 * Watches a specific document object. When it changes, it waits for 'delay' ms.
 * If no other changes happen, it writes to Firestore.
 */
export function useDebouncedSave<T extends { id: string }>(
    collectionName: string,
    data: T | null,
    delay: number = 1000
) {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    // Keep track of the initial data to avoid saving on load
    const initialRender = useRef(true);

    useEffect(() => {
        if (initialRender.current) {
            initialRender.current = false;
            return;
        }

        if (!data || !data.id) return;

        const handler = setTimeout(async () => {
            setIsSaving(true);
            try {
                await saveDocument(collectionName, data);
                setLastSaved(new Date().toISOString());
                console.log(`☁️ Auto-Synced ${collectionName}/${data.id}`);
            } catch (error) {
                console.error("Auto-Sync Failed:", error);
            } finally {
                setIsSaving(false);
            }
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [data, delay, collectionName]);

    return { isSaving, lastSaved };
}
