import React, { useMemo } from 'react';
import { ChecklistSection, TyreCheckData, VehicleDamagePoint } from '../../../types';
import InspectionChecklist from '../../InspectionChecklist';
import TyreCheck from '../../TyreCheck';
import VehicleDamageReport from '../../VehicleDamageReport';
import { useData } from '../../../core/state/DataContext';
import { FileText } from 'lucide-react';

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
    onApplyTemplate: (template: any) => void;
    selectedTemplateId?: string;
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
    onDamageReportUpdate,
    onApplyTemplate,
    selectedTemplateId
}) => {
    const { inspectionTemplates } = useData();

    const sortedTemplates = useMemo(() => {
        if (!inspectionTemplates) return [];
        return [...inspectionTemplates].sort((a, b) => {
            const aLen = a.sections?.length || 0;
            const bLen = b.sections?.length || 0;
            return aLen - bLen;
        });
    }, [inspectionTemplates]);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        if (!templateId) return;

        const template = sortedTemplates.find(t => t.id === templateId);
        if (template) {
            onApplyTemplate(template);
        }
    };

    const hasChecklist = checklistData && checklistData.length > 0;

    return (
        <div className="space-y-6">
            {!isReadOnly && (
                <div className="p-3 bg-gray-100 rounded-lg flex justify-between items-center border border-gray-200">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600"/>
                        <span className="text-sm font-semibold text-gray-700">Checklist Template:</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <select 
                            className="text-sm border rounded p-1.5 bg-white max-w-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={selectedTemplateId || ''}
                            onChange={handleSelectChange}
                        >
                            <option value="" disabled>Load Template...</option>
                            {sortedTemplates.map(t => (
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
                    <p className="font-medium">No inspection checklist loaded.</p>
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