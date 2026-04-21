import React, { useState, useEffect } from 'react';
import { getImage } from '../utils/imageStore';
import { Loader2 } from 'lucide-react';

interface AsyncMediaProps {
    imageId: string;
    className?: string;
    alt?: string;
    showControls?: boolean;
}

const AsyncMedia: React.FC<AsyncMediaProps> = ({ imageId, className, alt = 'Media content', showControls = true }) => {
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isVideo, setIsVideo] = useState(false);

    useEffect(() => {
        if (!imageId) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        const loadMedia = async () => {
            try {
                const dataUrl = await getImage(imageId);
                if (!isMounted) return;

                if (dataUrl) {
                    setMediaUrl(dataUrl);
                    
                    const lowerUrl = dataUrl.toLowerCase();
                    const isVideoContent = 
                        lowerUrl.startsWith('data:video') || 
                        lowerUrl.includes('.mp4') || 
                        lowerUrl.includes('.webm') || 
                        lowerUrl.includes('.ogg') || 
                        lowerUrl.includes('.mov') ||
                        lowerUrl.includes('/video');
                    
                    setIsVideo(isVideoContent);
                } else {
                    setMediaUrl(null);
                }
            } catch (err) {
                console.error(`[AsyncMedia] Failed to load ${imageId}:`, err);
                if (isMounted) setMediaUrl(null);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadMedia();

        return () => {
            isMounted = false;
        };
    }, [imageId]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 ${className || 'w-full h-full'}`}>
                <Loader2 className="animate-spin text-gray-400" size={20} />
            </div>
        );
    }

    if (!mediaUrl) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 text-gray-400 text-[10px] text-center p-2 ${className || 'w-full h-full'}`}>
                Media not found
            </div>
        );
    }

    if (isVideo) {
        return (
            <video 
                src={mediaUrl} 
                className={className} 
                controls={showControls}
                playsInline
                muted={!showControls}
            />
        );
    }

    return (
        <img 
            src={mediaUrl} 
            alt={alt} 
            className={className} 
        />
    );
};

export default AsyncMedia;
