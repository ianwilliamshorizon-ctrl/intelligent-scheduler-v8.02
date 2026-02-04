
import React, { useMemo } from 'react';
import { ChecklistSection, TyreCheckData, VehicleDamagePoint, InspectionTemplate } from '../../../types';
import InspectionChecklist from '../../InspectionChecklist';
import TyreCheck from '../../TyreCheck';
import VehicleDamageReport from '../../VehicleDamageReport';
import { useData } from '../../../core/state/DataContext';
import { FileText, RefreshCw } from 'lucide-react';

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
    const { inspectionTemplates } = useData();

    const handleApplyTemplate = (templateId: string) => {
        const template = inspectionTemplates.find(t => t.id === templateId);
        if (!template) return;

        if (checklistData.length > 0) {
            if (!confirm("Applying a new template will overwrite the existing checklist. Continue?")) return;
        }

        const newChecklist: ChecklistSection[] = template.sections.map(s => ({
            id: s.id,
            title: s.title,
            items: s.items.map(i => ({
                id: crypto.randomUUID(),
                label: i.label,
                status: 'na'
            })),
            comments: ''
        }));
        
        onChecklistUpdate(newChecklist);
    };

    const hasChecklist = checklistData && checklistData.length > 0;

    return (
        <div className="space-y-6">
            {!isReadOnly && (
                <div className="p-3 bg-gray-100 rounded-lg flex justify-between items-center border border-gray-200">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600"/>
                        <span className="text-sm font-semibold text-gray-700">Checklist Template:</span>
                        {hasChecklist ? (
                            <span className="text-sm text-gray-600">Custom / Loaded</span>
                        ) : (
                            <span className="text-sm text-gray-500 italic">None selected</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                         <select 
                            className="text-sm border rounded p-1.5 bg-white max-w-xs"
                            onChange={(e) => { if(e.target.value) handleApplyTemplate(e.target.value); e.target.value = ''; }}
                            defaultValue=""
                        >
                            <option value="" disabled>Load Template...</option>
                            {inspectionTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {hasChecklist ? (
                <InspectionChecklist
                    checklistData={checklistData}
                    onUpdate={onChecklistUpdate}
                    isReadOnly={isReadOnly}
                />
            ) : (
                <div className="text-center py-10 bg-gray-50 border-2 border-dashed rounded-lg text-gray-500">
                    <p>No inspection checklist loaded.</p>
                    <p className="text-sm">Select a template above to begin.</p>
                </div>
            )}

            <TyreCheck
                tyreData={tyreData}
                onUpdate={onTyreUpdate}
                isReadOnly={isReadOnly}
            />
            <VehicleDamageReport
                activePoints={damagePoints}
                onUpdate={onDamageReportUpdate}
                isReadOnly={isReadOnly}
                vehicleModel={vehicleModel}
                imageId={diagramImageId}
            />
        </div>
    );
};