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
    vehicleColor?: string;
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
    vehicleColor,
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
        <div className="space-y-6 text-slate-900">
            {!isReadOnly && (
                <div className="p-3 bg-slate-100 rounded-xl flex flex-wrap justify-between items-center gap-2 border border-slate-200 text-slate-900">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600"/>
                        <span className="text-sm font-bold text-slate-800">Checklist Template:</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <select 
                            className="text-sm border border-slate-300 rounded-lg p-2 bg-white text-slate-900 max-w-md focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                            value={selectedTemplateId || ''}
                            onChange={handleSelectChange}
                        >
                            <option value="" disabled className="text-slate-500 bg-white">Load Template...</option>
                            {sortedTemplates.map(t => (
                                <option key={t.id} value={t.id} className="text-slate-900 bg-white">{t.name}</option>
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
                <div className="text-center py-10 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-slate-700">
                    <p className="font-bold text-slate-800">No inspection checklist loaded.</p>
                    <p className="text-sm text-slate-500">Select a template above to begin.</p>
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
                vehicleColor={vehicleColor}
                imageId={diagramImageId}
            />
        </div>
    );
};