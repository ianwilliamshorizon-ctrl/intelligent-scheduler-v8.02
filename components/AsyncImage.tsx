import React from 'react';
import AsyncMedia from './AsyncMedia';

interface AsyncImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    imageId: string;
}

const AsyncImage: React.FC<AsyncImageProps> = ({ imageId, ...props }) => {
    // Forward all image attributes to AsyncMedia's image renderer
    // Note: AsyncMedia currently only supports className and alt from standard img props
    return (
        <AsyncMedia 
            imageId={imageId} 
            className={props.className} 
            alt={props.alt} 
        />
    );
};

export default AsyncImage;
