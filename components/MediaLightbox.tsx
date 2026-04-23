
import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import AsyncMedia from './AsyncMedia';

interface MediaLightboxProps {
    isOpen: boolean;
    onClose: () => void;
    mediaIds: string[];
    initialIndex?: number;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({ isOpen, onClose, mediaIds, initialIndex = 0 }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        setCurrentIndex(initialIndex);
        setZoom(1);
        setRotation(0);
    }, [initialIndex, isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex]);

    if (!isOpen || mediaIds.length === 0) return null;

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % mediaIds.length);
        setZoom(1);
        setRotation(0);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + mediaIds.length) % mediaIds.length);
        setZoom(1);
        setRotation(0);
    };

    const currentId = mediaIds[currentIndex];

    return (
        <div className="fixed inset-0 bg-black/95 z-[999] flex flex-col animate-fade-in">
            {/* Header / Controls */}
            <header className="flex justify-between items-center p-4 text-white z-10">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full border border-white/10">
                        {currentIndex + 1} / {mediaIds.length}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={() => setZoom(z => Math.min(z + 0.5, 3))} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Zoom In"><ZoomIn size={20}/></button>
                    <button onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Zoom Out"><ZoomOut size={20}/></button>
                    <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Rotate"><RotateCcw size={20}/></button>
                    <div className="w-px h-6 bg-white/20 mx-2"></div>
                    <button onClick={onClose} className="p-2 hover:bg-red-500 rounded-full transition-colors" title="Close"><X size={24}/></button>
                </div>
            </header>

            {/* Main Viewport */}
            <div className="flex-grow relative flex items-center justify-center overflow-hidden touch-none">
                {mediaIds.length > 1 && (
                    <>
                        <button 
                            onClick={handlePrev}
                            className="absolute left-4 z-10 p-4 bg-white/5 hover:bg-white/20 text-white rounded-full transition-all border border-white/10 group"
                        >
                            <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <button 
                            onClick={handleNext}
                            className="absolute right-4 z-10 p-4 bg-white/5 hover:bg-white/20 text-white rounded-full transition-all border border-white/10 group"
                        >
                            <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </>
                )}

                <div 
                    className="w-full h-full flex items-center justify-center transition-transform duration-300"
                    style={{ 
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                >
                    <AsyncMedia 
                        imageId={currentId} 
                        className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-sm"
                        alt="Full screen media"
                    />
                </div>
            </div>

            {/* Thumbnails (Optional) */}
            <footer className="p-6 flex justify-center gap-2 overflow-x-auto no-scrollbar">
                {mediaIds.map((id, idx) => (
                    <button 
                        key={id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${idx === currentIndex ? 'border-indigo-500 scale-110 shadow-lg shadow-indigo-500/20' : 'border-transparent opacity-40 hover:opacity-100'}`}
                    >
                        <AsyncMedia imageId={id} className="w-full h-full object-cover" />
                    </button>
                ))}
            </footer>
        </div>
    );
};

export default MediaLightbox;
