
import React, { useRef, useState } from 'react';
import { VehicleDamagePoint } from '../types';
import { XCircle } from 'lucide-react';
import PorscheFrames from './PorscheFrames';
import AsyncImage from './AsyncImage';
import { getHexFromColorName, getMarkerColorClass } from '../utils/colorUtils';

interface DamageMarkerProps {
    point: VehicleDamagePoint;
    index: number;
    onUpdate?: (id: string, notes: string) => void;
    onRemove?: (id: string) => void;
    isReadOnly: boolean;
    colorClass: string;
}

const DamageMarker: React.FC<DamageMarkerProps> = ({ point, index, onUpdate, onRemove, isReadOnly, colorClass }) => {
    const [isEditing, setIsEditing] = useState(point.notes === '' && !!onUpdate);
    const [notes, setNotes] = useState(point.notes);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        if (onUpdate) onUpdate(point.id, notes);
        setIsEditing(false);
    };

    const markerStyle: React.CSSProperties = {
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: 'translate(-50%, -50%)'
    };

    return (
        <div className="absolute group" style={markerStyle}>
            <div 
                className={`w-6 h-6 rounded-full border-2 border-white shadow-md ${colorClass} flex items-center justify-center text-white font-bold text-xs`}
                onClick={() => !isReadOnly && onUpdate && setIsEditing(true)}
            >
                {index + 1}
            </div>
            
            {!isReadOnly && onRemove && (
                <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); onRemove(point.id); }} 
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                    <XCircle size={20} className="text-red-600 bg-white rounded-full" />
                </button>
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
    imageUrl?: string | null;
    referencePoints?: { points: VehicleDamagePoint[], colorClass: string };
    activeColorClass?: string;
    vehicleColor?: string;
}

const VehicleDamageReport: React.FC<VehicleDamageReportProps> = ({ activePoints, onUpdate, isReadOnly, vehicleModel, imageId, imageUrl, referencePoints, activeColorClass, vehicleColor }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Determine dynamic colors
    const vehicleHex = getHexFromColorName(vehicleColor);
    const dynamicMarkerClass = getMarkerColorClass(vehicleHex);
    
    // Favor explicitly passed class, then dynamic fallback, then hardcoded red as last resort
    const effectiveActiveColorClass = activeColorClass || dynamicMarkerClass;
    const effectiveReferenceColorClass = referencePoints?.colorClass || 'bg-blue-500';

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
    
    const activeNotes = activePoints.filter(p => p.notes);
    const referenceNotes = referencePoints ? referencePoints.points.filter(p => p.notes) : [];

    return (
        <div className="grid grid-cols-3 gap-x-8">
            <div
                className={`col-span-2 relative w-full mx-auto ${!isReadOnly ? 'cursor-crosshair' : ''}`}
                ref={containerRef}
                onClick={handleContainerClick}
            >
                <div 
                    className="relative w-full rounded-lg border overflow-hidden"
                    style={{ backgroundColor: vehicleHex }}
                >
                    <div className="relative w-full mix-blend-multiply">
                        {imageId ? (
                            <AsyncImage imageId={imageId} alt="Vehicle Diagram" className="w-full h-auto" />
                        ) : imageUrl ? (
                            <img src={imageUrl} alt="Vehicle Diagram" className="w-full h-auto" />
                        ) : (
                            <PorscheFrames view="top" vehicleModel={vehicleModel} />
                        )}
                    </div>
                    
                    {referencePoints && referencePoints.points.map((point, index) => (
                        <DamageMarker key={point.id} point={point} index={index} isReadOnly={true} colorClass={effectiveReferenceColorClass} />
                    ))}

                    {activePoints.map((point, index) => (
                        <DamageMarker
                            key={point.id}
                            point={point}
                            index={index}
                            onUpdate={handleUpdatePoint}
                            onRemove={handleRemovePoint}
                            isReadOnly={isReadOnly}
                            colorClass={effectiveActiveColorClass}
                        />
                    ))}
                </div>
            </div>

            {(activeNotes.length > 0 || referenceNotes.length > 0) && (
                <div className="col-span-1 text-xs space-y-3 pt-2">
                     {referenceNotes.length > 0 && (
                        <div>
                            <h5 className="font-bold text-gray-700 mb-1">Pre-existing Damage:</h5>
                            <ol className="list-decimal list-inside space-y-1">
                                {referenceNotes.map((p, index) => <li key={`ref-${p.id}`}><span className="font-semibold">{`#${index + 1}:`}</span> {p.notes}</li>)}
                            </ol>
                        </div>
                    )}
                    {activeNotes.length > 0 && (
                        <div>
                            <h5 className="font-bold text-gray-700 mb-1">{referenceNotes.length > 0 ? 'New Damage Recorded:' : 'Damage Recorded:'}</h5>
                            <ol className="list-decimal list-inside space-y-1">
                                {activeNotes.map((p, index) => <li key={p.id}><span className="font-semibold">{`#${index + 1}:`}</span> {p.notes}</li>)}
                            </ol>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VehicleDamageReport;