import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../core/config/firebaseConfig';
import { getImage } from '../utils/imageStore';
import { Loader2, AlertCircle } from 'lucide-react';

interface AsyncMediaProps {
    imageId: string;
    alt?: string;
    className?: string;
    type?: 'photo' | 'video';
}

export const AsyncMedia: React.FC<AsyncMediaProps> = ({ imageId, alt = "Media", className, type }) => {
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadMedia = async () => {
            if (!imageId) {
                setIsLoading(false);
                return;
            }

            try {
                // 1. Try to load from Local IndexedDB (imageStore) first
                const localData = await getImage(imageId);
                if (localData && isMounted) {
                    setMediaUrl(localData);
                    setIsLoading(false);
                    return;
                }

                // 2. If not found locally, try Firebase Storage
                try {
                    const storageRef = ref(storage, `vehicle-media/${imageId}`);
                    const url = await getDownloadURL(storageRef);
                    if (isMounted) {
                        setMediaUrl(url);
                        setIsLoading(false);
                    }
                } catch (storageErr) {
                    // console.log("Not in storage:", imageId);
                    if (isMounted) {
                        setError(true);
                        setIsLoading(false);
                    }
                }
            } catch (err) {
                console.error("Error in AsyncMedia:", err);
                if (isMounted) {
                    setError(true);
                    setIsLoading(false);
                }
            }
        };

        loadMedia();
        return () => { isMounted = false; };
    }, [imageId]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 animate-pulse ${className}`}>
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
        );
    }

    if (error || !mediaUrl) {
        return (
            <div className={`flex flex-col items-center justify-center bg-gray-50 border border-dashed border-gray-200 text-gray-400 p-2 ${className}`}>
                <AlertCircle size={16} className="mb-1 opacity-50" />
                <span className="text-[10px] font-medium">Not found</span>
            </div>
        );
    }

    // Determine if it's a video based on explicit type, imageId or URL content
    const isVideo = type === 'video' || 
                   imageId.toLowerCase().includes('video') || 
                   mediaUrl.toLowerCase().includes('.mp4') || 
                   mediaUrl.toLowerCase().includes('.mov') ||
                   mediaUrl.toLowerCase().includes('.webm') ||
                   mediaUrl.startsWith('data:video');

    if (isVideo) {
        return (
            <video 
                src={mediaUrl} 
                className={className} 
                controls 
                playsInline
                preload="metadata"
            />
        );
    }

    return (
        <img 
            src={mediaUrl} 
            alt={alt} 
            className={className} 
            loading="lazy"
            onError={() => setError(true)}
        />
    );
};

export default AsyncMedia;
