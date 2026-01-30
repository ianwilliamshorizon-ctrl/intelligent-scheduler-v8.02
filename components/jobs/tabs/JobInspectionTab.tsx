import React from 'react';
import { ChecklistSection, TyreCheckData, VehicleDamagePoint } from '../../../types';
import InspectionChecklist from '../../InspectionChecklist';
import TyreCheck from '../../TyreCheck';
import VehicleDamageReport from '../../VehicleDamageReport';

interface JobInspectionTabProps {
    checklistData?: ChecklistSection[]; // Made optional
    tyreData?: TyreCheckData;           // Made optional
    damagePoints?: VehicleDamagePoint[]; // Made optional
    vehicleModel?: string;
    diagramImageId?: string | null;
    isReadOnly: boolean;
    onChecklistUpdate: (updatedChecklist: ChecklistSection[]) => void;
    onTyreUpdate: (updatedTyreData: TyreCheckData) => void;
    onDamageReportUpdate: (updatedDamagePoints: VehicleDamagePoint[]) => void;
}

export const JobInspectionTab: React.FC<JobInspectionTabProps> = ({
    checklistData = [],     // Default to empty array
    tyreData,               // Handle specifically below
    damagePoints = [],      // Default to empty array
    vehicleModel = 'Unknown Model',
    diagramImageId,
    isReadOnly,
    onChecklistUpdate,
    onTyreUpdate,
    onDamageReportUpdate
}) => {
    // Safety check for Tyre Data - if undefined, provide the structure your component expects
    const safeTyreData: TyreCheckData = tyreData || {
        frontLeft: { depth: '', pressure: '', condition: 'Good' },
        frontRight: { depth: '', pressure: '', condition: 'Good' },
        rearLeft: { depth: '', pressure: '', condition: 'Good' },
        rearRight: { depth: '', pressure: '', condition: 'Good' },
        spare: { depth: '', pressure: '', condition: 'Good' },
        notes: ''
    };

    return (
        <div className="space-y-6">
            <section>
                <h3 className="text-lg font-medium mb-2">Inspection Checklist</h3>
                <InspectionChecklist
                    checklistData={checklistData}
                    onUpdate={onChecklistUpdate}
                    isReadOnly={isReadOnly}
                />
            </section>

            <hr className="border-gray-200" />

            <section>
                <h3 className="text-lg font-medium mb-2">Tyre Condition Report</h3>
                <TyreCheck
                    tyreData={safeTyreData}
                    onUpdate={onTyreUpdate}
                    isReadOnly={isReadOnly}
                />
            </section>

            <hr className="border-gray-200" />

            <section>
                <h3 className="text-lg font-medium mb-2">Vehicle Damage Report</h3>
                {/* FIX: If diagramImageId is missing, VehicleDamageReport 
                  should handle it, but we pass empty points to prevent crashes.
                */}
                <VehicleDamageReport
                    activePoints={damagePoints}
                    onUpdate={onDamageReportUpdate}
                    isReadOnly={isReadOnly}
                    vehicleModel={vehicleModel}
                    imageId={diagramImageId || null}
                />
            </section>
        </div>
    );
};