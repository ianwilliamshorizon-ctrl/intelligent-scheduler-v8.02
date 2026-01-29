
import React, { useRef, useState } from 'react';
import { VehicleDamagePoint } from '../types';
import { XCircle } from 'lucide-react';
import PorscheFrames from './PorscheFrames';
import AsyncImage from './AsyncImage';

interface DamageMarkerProps {
    point: VehicleDamagePoint;
    onUpdate?: (id: string, notes: string) => void;
    onRemove?: (id: string) => void;
    isReadOnly: boolean;
    colorClass: string;
}

const DamageMarker: React.FC<DamageMarkerProps> = ({ point, onUpdate, onRemove, isReadOnly, colorClass }) => {
    const [isEditing, setIsEditing] = useState(point.notes === '' && !!onUpdate);
    const [notes, setNotes] = useState(point.notes);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        if (onUpdate) onUpdate(point.id, notes);
        setIsEditing(false);
    };

    return (
        <div className="absolute group" style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${colorClass} ${!isReadOnly && onUpdate ? 'cursor-pointer' : ''}`} onClick={() => !isReadOnly && onUpdate && setIsEditing(true)} />
            
            {!isReadOnly && onRemove && (
                <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); onRemove(point.id); }} 
                    className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                    <XCircle size={18} className="text-red-600 bg-white rounded-full" />
                </button>
            )}
            
            {(point.notes && !isEditing) && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {point.notes}
                </div>
            )}
            
            {isEditing && !isReadOnly && onUpdate && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 z-10">
                    <input
                        ref={inputRef}
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        className="w-full p-1 border rounded text-xs"
                        placeholder="Damage notes..."
                        autoFocus
                    />
                </div>
            )}
        </div>
    );
};

interface VehicleDamageReportProps {
    activePoints: VehicleDamagePoint[];
    onUpdate: (updatedPoints: VehicleDamagePoint[]) => void;
    isReadOnly: boolean;
    vehicleModel?: string;
    imageId?: string | null;
    referencePoints?: { points: VehicleDamagePoint[], colorClass: string };
    activeColorClass?: string;
}


const VehicleDamageReport: React.FC<VehicleDamageReportProps> = ({ activePoints, onUpdate, isReadOnly, vehicleModel, imageId, referencePoints, activeColorClass = 'bg-red-500' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || !containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newPoint: VehicleDamagePoint = {
            id: crypto.randomUUID(),
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            notes: ''
        };
        onUpdate([...activePoints, newPoint]);
    };

    const handleUpdatePoint = (id: string, notes: string) => {
        onUpdate(activePoints.map(p => p.id === id ? { ...p, notes } : p));
    };

    const handleRemovePoint = (id: string) => {
        onUpdate(activePoints.filter(p => p.id !== id));
    };
    
    const hasActiveNotes = activePoints.some(p => p.notes);
    const hasReferenceNotes = referencePoints && referencePoints.points.some(p => p.notes);

    return (
        <div className="space-y-4">
            <div
                className={`relative w-full max-w-lg mx-auto ${!isReadOnly ? 'cursor-crosshair' : ''}`}
                ref={containerRef}
                onClick={handleContainerClick}
            >
                <div 
                    className="relative w-full bg-gray-100 rounded-lg border overflow-hidden"
                >
                    {imageId ? (
                        <AsyncImage imageId={imageId} alt="Vehicle Diagram" className="w-full h-auto" />
                    ) : (
                        <PorscheFrames view="top" vehicleModel={vehicleModel} />
                    )}
                    
                    {referencePoints && referencePoints.points.map(point => (
                        <DamageMarker key={point.id} point={point} isReadOnly={true} colorClass={referencePoints.colorClass} />
                    ))}

                    {activePoints.map(point => (
                        <DamageMarker
                            key={point.id}
                            point={point}
                            onUpdate={handleUpdatePoint}
                            onRemove={handleRemovePoint}
                            isReadOnly={isReadOnly}
                            colorClass={activeColorClass}
                        />
                    ))}
                </div>
            </div>
             {isReadOnly && (hasActiveNotes || hasReferenceNotes) && (
                <div className="mt-4 text-xs space-y-2 page-break-inside-avoid">
                    {hasReferenceNotes && (
                        <div>
                            <h5 className="font-bold text-gray-700">Pre-existing Damage Notes:</h5>
                            <ul className="list-disc list-inside pl-2">
                                {referencePoints!.points.filter(p => p.notes).map(p => <li key={`ref-${p.id}`}>{p.notes}</li>)}
                            </ul>
                        </div>
                    )}
                    {hasActiveNotes && (
                         <div>
                            <h5 className="font-bold text-gray-700">{referencePoints ? 'New Damage Notes:' : 'Damage Notes:'}</h5>
                            <ul className="list-disc list-inside pl-2">
                                {activePoints.filter(p => p.notes).map((p, index) => (
                                    <li key={`${p.id}-${index}`}>{p.notes}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VehicleDamageReport;
