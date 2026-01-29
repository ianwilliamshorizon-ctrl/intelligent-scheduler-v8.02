import React, { useState, useEffect } from 'react';
import { getImage } from '../utils/imageStore';
import { Loader2 } from 'lucide-react';

interface AsyncImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    imageId: string;
}

const AsyncImage: React.FC<AsyncImageProps> = ({ imageId, ...props }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);

        getImage(imageId)
            .then(dataUrl => {
                if (isMounted && dataUrl) {
                    setImageUrl(dataUrl);
                }
            })
            .catch(err => console.error(`Failed to load image ${imageId}`, err))
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [imageId]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <Loader2 className="animate-spin text-gray-500" />
            </div>
        );
    }

    if (!imageUrl) {
        return (
             <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-xs text-center p-1">
                Image not found
            </div>
        );
    }

    return <img src={imageUrl} {...props} />;
};

export default AsyncImage;
