import React from 'react';
import { ChecklistSection, TyreCheckData, VehicleDamagePoint } from '../../../types';
import { ClipboardCheck, Disc, MapPin } from 'lucide-react';
import InspectionChecklist from '../../InspectionChecklist';
import TyreCheck from '../../TyreCheck';
import VehicleDamageReport from '../../VehicleDamageReport';

interface JobInspectionTabProps {
    checklistData: ChecklistSection[];
    tyreData: TyreCheckData;
    damagePoints: VehicleDamagePoint[];
    vehicleModel?: string;
    diagramImageId?: string | null;
    isReadOnly: boolean;
    onChecklistUpdate: (updatedChecklist: ChecklistSection[]) => void;
    onTyreUpdate: (updatedTyreData: TyreCheckData) => void;
    onDamageReportUpdate: (updatedDamagePoints: VehicleDamagePoint[]) => void;
}

export const JobInspectionTab: React.FC<JobInspectionTabProps> = ({
    checklistData,
    tyreData,
    damagePoints,
    vehicleModel,
    diagramImageId,
    isReadOnly,
    onChecklistUpdate,
    onTyreUpdate,
    onDamageReportUpdate
}) => {
    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Health Check / Inspection Checklist Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-1 bg-indigo-600 rounded-full"></div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <ClipboardCheck size={20} className="text-indigo-600" />
                            Vehicle Health Check
                        </h3>
                    </div>
                    {isReadOnly && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            Read Only
                        </span>
                    )}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <InspectionChecklist
                        checklistData={checklistData}
                        onUpdate={onChecklistUpdate}
                        isReadOnly={isReadOnly}
                    />
                </div>
            </section>

            {/* Tyre Depth and Condition Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-1 bg-emerald-600 rounded-full"></div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Disc size={20} className="text-emerald-600" />
                        Tyre Inspection
                    </h3>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <TyreCheck
                        tyreData={tyreData}
                        onUpdate={onTyreUpdate}
                        isReadOnly={isReadOnly}
                    />
                </div>
            </section>

            {/* Visual Damage Report Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-1 bg-amber-500 rounded-full"></div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <MapPin size={20} className="text-amber-500" />
                        Damage Mapping
                    </h3>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <div className="mb-6 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                        <p className="text-sm text-amber-900/70 leading-relaxed">
                            <strong>Instructions:</strong> Click or tap on the diagram below to mark scratches, dents, or chips. 
                            Active points will be saved automatically to the job record.
                        </p>
                    </div>
                    <VehicleDamageReport
                        activePoints={damagePoints}
                        onUpdate={onDamageReportUpdate}
                        isReadOnly={isReadOnly}
                        vehicleModel={vehicleModel}
                        imageId={diagramImageId}
                    />
                </div>
            </section>
        </div>
    );
};