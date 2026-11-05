import React, { useState, useMemo } from 'react';
import { ChecklistSection, TyreCheckData, VehicleDamagePoint } from '../../../types';
import InspectionChecklist from '../../InspectionChecklist';
import TyreCheck from '../../TyreCheck';
import VehicleDamageReport from '../../VehicleDamageReport';
import { useData } from '../../../core/state/DataContext';
import { FileText, Sparkles, Play } from 'lucide-react';
import { GuidedInspectionModal } from '../../GuidedInspectionModal';

interface JobInspectionTabProps {
    checklistData: ChecklistSection[];
    tyreData: TyreCheckData;
    damagePoints: VehicleDamagePoint[];
    vehicleRegistration?: string;
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
    vehicleRegistration,
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
    const [isGuidedModalOpen, setIsGuidedModalOpen] = useState(false);

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
                <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl flex flex-wrap justify-between items-center gap-3 border border-slate-800 shadow-sm text-white">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <span className="text-sm font-black text-white block">Guided Vehicle Inspection</span>
                            <span className="text-xs text-slate-400">Step-by-step hands-free voice host for workshop engineers</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {hasChecklist && (
                            <button
                                type="button"
                                onClick={() => setIsGuidedModalOpen(true)}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition shadow-md flex items-center gap-2 cursor-pointer"
                            >
                                <Play size={14} className="fill-white" />
                                <span>Start Guided Inspection</span>
                            </button>
                        )}
                        <select 
                            className="text-xs border border-slate-700 rounded-xl p-2 bg-slate-800 text-white max-w-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer"
                            value={selectedTemplateId || ''}
                            onChange={handleSelectChange}
                        >
                            <option value="" disabled className="text-slate-400 bg-slate-800">Change Template...</option>
                            {sortedTemplates.map(t => (
                                <option key={t.id} value={t.id} className="text-white bg-slate-800">{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {isGuidedModalOpen && hasChecklist && (
                <GuidedInspectionModal
                    isOpen={isGuidedModalOpen}
                    onClose={() => setIsGuidedModalOpen(false)}
                    checklistData={checklistData}
                    onChecklistUpdate={onChecklistUpdate}
                    vehicleRegistration={vehicleRegistration}
                    vehicleModel={vehicleModel}
                />
            )}

            {hasChecklist ? (
                <InspectionChecklist
                    checklistData={checklistData}
                    onUpdate={onChecklistUpdate}
                    isReadOnly={isReadOnly}
                    vehicleRegistration={vehicleRegistration}
                    vehicleModel={vehicleModel}
                    hideGuidedHostButton={true}
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

export default JobInspectionTab;
