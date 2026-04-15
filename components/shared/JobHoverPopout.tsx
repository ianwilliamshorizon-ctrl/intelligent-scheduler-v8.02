import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Job, Vehicle, Customer, PurchaseOrder, User, Engineer } from '../../types';
import { ConciergeJobCard } from '../concierge/ConciergeJobCard';

interface JobHoverPopoutProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    purchaseOrders: PurchaseOrder[];
    engineers: Engineer[];
    currentUser: User;
    onEdit: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onOpenAssistant: (jobId: string) => void;
    onGenerateInvoice?: (jobId: string) => void;
    onCollect?: (jobId: string) => void;
    onQcApprove: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason?: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    children: React.ReactNode;
}

export const JobHoverPopout: React.FC<JobHoverPopoutProps> = (props) => {
    const { children } = props;
    const [isHovered, setIsHovered] = useState(false);
    const [popOutPosition, setPopOutPosition] = useState<'top' | 'bottom'>('top');
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            
            // If the card is in the top 40% of the viewport, show pop-out below it
            if (rect.top < window.innerHeight * 0.4) {
                setPopOutPosition('bottom');
            } else {
                setPopOutPosition('top');
            }
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTimeout.current = setTimeout(() => {
            setIsHovered(false);
        }, 100); // 100ms grace period to move to the popout
    };

    const portalContent = isHovered && (
        <div 
            className="fixed z-[9999] pointer-events-auto"
            style={{
                top: popOutPosition === 'top' ? `${coords.top}px` : `${coords.top + coords.height}px`,
                left: `${(() => {
                    const popoutWidth = 360;
                    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
                    const padding = 12;
                    const centerX = coords.left + coords.width / 2;
                    let leftEdge = centerX - popoutWidth / 2;
                    if (leftEdge < padding) leftEdge = padding;
                    else if (leftEdge + popoutWidth > viewportWidth - padding) leftEdge = viewportWidth - padding - popoutWidth;
                    return leftEdge;
                })()}px`,
                transform: popOutPosition === 'top' ? 'translateY(-100%)' : 'translateY(0%)',
                paddingTop: popOutPosition === 'bottom' ? '12px' : '0',
                paddingBottom: popOutPosition === 'top' ? '12px' : '0',
                width: `360px`
            }}
            onMouseEnter={() => {
                if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                setIsHovered(true);
            }}
            onMouseLeave={handleMouseLeave}
        >
            <div className={`shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-xl ring-4 ring-black/5 ring-offset-0 animate-in fade-in zoom-in-95 duration-200 origin-${popOutPosition === 'top' ? 'bottom' : 'top'}`}>
                 <ConciergeJobCard {...props} />
            </div>
        </div>
    );

    return (
        <div 
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {isHovered && createPortal(portalContent, document.body)}
        </div>
    );
};
