import React from 'react';
import { TyreCheckData, TyreLocation, ChecklistItemStatus } from '../types';
import { Check, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface TyreCheckProps {
    tyreData: TyreCheckData;
    onUpdate: (updatedData: TyreCheckData) => void;
    isReadOnly: boolean;
}

const statusConfig: Record<ChecklistItemStatus, { icon: React.ElementType, color: string, label: string }> = {
    ok: { icon: Check, color: 'bg-green-500', label: 'OK' },
    attention: { icon: AlertTriangle, color: 'bg-yellow-500', label: 'Needs Attention' },
    urgent: { icon: XCircle, color: 'bg-red-500', label: 'Urgent' },
    na: { icon: HelpCircle, color: 'bg-gray-400', label: 'N/A' },
};

const tyreLabels: Record<TyreLocation, string> = {
    frontRight: 'Front Right (O/S/F)',
    frontLeft: 'Front Left (N/S/F)',
    rearRight: 'Rear Right (O/S/R)',
    rearLeft: 'Rear Left (N/S/R)',
    spare: 'Spare',
};

const TyreCheck: React.FC<TyreCheckProps> = ({ tyreData, onUpdate, isReadOnly }) => {

    const handleUpdate = (location: TyreLocation, field: string, value: string | number | ChecklistItemStatus) => {
        const updatedTyre = { ...tyreData[location], [field]: value };
        onUpdate({ ...tyreData, [location]: updatedTyre });
    };
    
    return (
        <div className="border rounded-lg bg-white overflow-hidden avoid-break">
            <h3 className="text-md font-bold p-3 bg-gray-100 border-b">Tyre Report</h3>
            <div className="divide-y">
                {Object.keys(tyreLabels).map(loc => {
                    const location = loc as TyreLocation;
                    const data = tyreData[location];
                    if (!data) return null; 

                    const hasTreadData = data.outer || data.middle || data.inner;
                    if (isReadOnly && data.indicator === 'na' && !hasTreadData && !data.pressure && !data.comments) return null;

                    return (
                        <div key={location} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                            <h4 className="w-full sm:w-48 font-semibold text-sm flex-shrink-0">{tyreLabels[location]}</h4>
                            
                            <div style={{ width: '190px' }}>
                                <label className="text-xs text-gray-500">Tread Depth (mm): O | M | I</label>
                                <div className="flex gap-2">
                                    <input type="number" step="0.1" value={data.outer ?? ''} onChange={e => handleUpdate(location, 'outer', e.target.value)} placeholder="O" className="w-1/3 p-1 border rounded text-xs text-center" disabled={isReadOnly} />
                                    <input type="number" step="0.1" value={data.middle ?? ''} onChange={e => handleUpdate(location, 'middle', e.target.value)} placeholder="M" className="w-1/3 p-1 border rounded text-xs text-center" disabled={isReadOnly} />
                                    <input type="number" step="0.1" value={data.inner ?? ''} onChange={e => handleUpdate(location, 'inner', e.target.value)} placeholder="I" className="w-1/3 p-1 border rounded text-xs text-center" disabled={isReadOnly} />
                                </div>
                            </div>
                            
                            <div className="w-24">
                                <label className="text-xs text-gray-500">Pressure</label>
                                <input type="number" value={data.pressure ?? ''} onChange={e => handleUpdate(location, 'pressure', e.target.value)} placeholder="PSI" className="w-full p-1 border rounded text-xs" disabled={isReadOnly} />
                            </div>

                             <div className="flex-grow sm:flex-grow-0" style={{ minWidth: '200px' }}>
                                <label className="text-xs text-gray-500">Comments</label>
                                <input type="text" value={data.comments || ''} onChange={e => handleUpdate(location, 'comments', e.target.value)} className="w-full p-1 border rounded text-xs" disabled={isReadOnly} />
                            </div>

                            <div className="w-full sm:w-auto flex items-center justify-end gap-1 sm:ml-auto">
                                {Object.keys(statusConfig).map(s => {
                                    const status = s as ChecklistItemStatus;
                                    const config = statusConfig[status];
                                    const hexColors: Record<ChecklistItemStatus, string> = {
                                        ok: '#22c55e',
                                        attention: '#eab308',
                                        urgent: '#ef4444',
                                        na: '#9ca3af'
                                    };
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => !isReadOnly && handleUpdate(location, 'indicator', status)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-full text-white transition-transform duration-150 ${data.indicator === status ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'opacity-50 hover:opacity-100'} ${!isReadOnly ? config.color : ''}`}
                                            style={{ backgroundColor: isReadOnly ? hexColors[status] : undefined }}
                                            title={config.label}
                                            disabled={isReadOnly}
                                        >
                                            <config.icon size={16} />
                                        </button>
                                    );
                                })}
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TyreCheck;