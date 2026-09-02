import { Job, InspectionFinding, ChecklistSection, ChecklistItem } from '../../types';

export const COMMON_FINDING_SUGGESTIONS: Record<string, string[]> = {
    'Brakes': [
        'Discs Worn Below Minimum Thickness',
        'Brake Pads Worn (<2mm Remaining)',
        'Brake Disc Face Heavily Scored / Lip Worn',
        'Brake Caliper Seized / Binding',
        'Brake Fluid Moisture >3% (Contaminated)',
        'Brake Flexi-Hose Perished / Bulging'
    ],
    'Tyres': [
        'Tread Depth Below Legal Limit (<1.6mm)',
        'Inner Shoulder Cord / Wire Exposed',
        'Sidewall Bulge / Severe Impact Damage',
        'Uneven / Severe Edge Wear (Alignment Out)',
        'Puncture / Nail in Tread Shoulder (Non-Repairable)',
        'Tyre Age Cracking / Perished (>5 Years Old)'
    ],
    'Leaks & Fluids': [
        'Heavy Engine Oil Sump / Gasket Leak',
        'Coolant Leak from Radiator / Hose Junction',
        'Gearbox / Transmission Oil Seepage',
        'Power Steering Rack / Line Fluid Leak',
        'Brake Fluid Seepage at Caliper Bleed Nipple',
        'Differential Oil Seal Weeping'
    ],
    'Suspension & Steering': [
        'Suspension Coil Spring Snapped / Cracked',
        'Shock Absorber Fluid Leaking / Failed',
        'Anti-Roll Bar Link Bush Split / Excessive Play',
        'Track Rod End Ball Joint Excessive Play',
        'Wishbone / Control Arm Rear Bush Torn',
        'Wheel Bearing Rumbling / Excessive Roughness'
    ],
    'Exhaust': [
        'Exhaust Flexi-Pipe Blowing / Ruptured',
        'Exhaust Heat Shield Loose / Rattling',
        'Silencer Box Corroded / Perforated',
        'DPF / Cat Pressure Sensor Pipe Fractured',
        'Exhaust Mount Rubbers Broken / Missing'
    ],
    'Engine & Drivetrain': [
        'Drive Belt (Serpentine) Heavily Cracked / Glazed',
        'CV Joint Boot Split / Grease Leaking',
        'Engine Mount Collapsed / Excessive Movement',
        'Turbo Oil Feed Line Weeping',
        'Dual Mass Flywheel Rattle on Idle'
    ],
    'Electrical': [
        'Battery Health Test Failed (Recommends Replace)',
        'Alternator Charging Voltage Low (<13.2V)',
        'Exterior Lighting Unit Failed / Inoperative',
        'ABS / ESP Wheel Speed Sensor Fault'
    ],
    'Body & Glass': [
        'Windscreen Chip / Crack in Line of Sight',
        'Undertray Broken / Dragging Loose',
        'Door Mirror Glass Broken / Inoperative'
    ],
    'Other': [
        'Advisory Maintenance Recommended',
        'Component Requires Specialist Attention'
    ]
};

/**
 * Automatically syncs an inspection finding directly into the job's
 * inspectionChecklist and technicianObservations without duplicate data entry.
 */
export const syncFindingToJob = (job: Job, finding: InspectionFinding): Job => {
    // 1. Update or append to job.inspectionFindings
    const existingFindings = job.inspectionFindings || [];
    const findingIndex = existingFindings.findIndex(f => f.id === finding.id);
    let updatedFindings: InspectionFinding[];
    if (findingIndex >= 0) {
        updatedFindings = [...existingFindings];
        updatedFindings[findingIndex] = finding;
    } else {
        updatedFindings = [finding, ...existingFindings];
    }

    // 2. Automatically sync to job.inspectionChecklist
    let updatedChecklist: ChecklistSection[] = job.inspectionChecklist ? [...job.inspectionChecklist] : [];
    let matchedItem = false;

    // Search keywords based on category and item label
    const keywords = [
        finding.category.toLowerCase(),
        ...finding.itemLabel.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    ];

    if (updatedChecklist.length > 0) {
        updatedChecklist = updatedChecklist.map(section => {
            const sectionTitle = section.title.toLowerCase();
            const isCategoryMatch = sectionTitle.includes(finding.category.toLowerCase()) ||
                (finding.category === 'Brakes' && sectionTitle.includes('brake')) ||
                (finding.category === 'Tyres' && (sectionTitle.includes('tyre') || sectionTitle.includes('tire') || sectionTitle.includes('wheel'))) ||
                (finding.category === 'Suspension & Steering' && (sectionTitle.includes('suspension') || sectionTitle.includes('steering'))) ||
                (finding.category === 'Leaks & Fluids' && (sectionTitle.includes('fluid') || sectionTitle.includes('leak') || sectionTitle.includes('under bonnet')));

            const updatedItems = section.items.map(item => {
                const itemLabel = item.label.toLowerCase();
                const isItemMatch = isCategoryMatch && keywords.some(kw => itemLabel.includes(kw));

                if (isItemMatch && !matchedItem) {
                    matchedItem = true;
                    const photoCountText = finding.photos && finding.photos.length > 0 ? ` [${finding.photos.length} photo(s)]` : '';
                    return {
                        ...item,
                        status: finding.severity,
                        comment: `${finding.itemLabel}: ${finding.notes}${photoCountText}`
                    };
                }
                return item;
            });

            return { ...section, items: updatedItems };
        });
    }

    // If no matching checklist item was found, create or append to the Lift Inspection Findings section
    if (!matchedItem) {
        const findingsSectionTitle = "Lift Inspection Findings & Urgent Recommendations";
        const sectionIndex = updatedChecklist.findIndex(s => s.title === findingsSectionTitle);
        const photoCountText = finding.photos && finding.photos.length > 0 ? ` [${finding.photos.length} photo(s)]` : '';
        const newItem: ChecklistItem = {
            id: `chk_${finding.id}`,
            label: `${finding.category}: ${finding.itemLabel}`,
            status: finding.severity,
            comment: `${finding.notes}${photoCountText}`
        };

        if (sectionIndex >= 0) {
            const section = updatedChecklist[sectionIndex];
            const existingItemIdx = section.items.findIndex(i => i.id === newItem.id || i.label === newItem.label);
            let newItems = [...section.items];
            if (existingItemIdx >= 0) {
                newItems[existingItemIdx] = newItem;
            } else {
                newItems.push(newItem);
            }
            updatedChecklist[sectionIndex] = { ...section, items: newItems };
        } else {
            updatedChecklist.push({
                id: `sec_findings_${Date.now()}`,
                title: findingsSectionTitle,
                items: [newItem],
                pageBreakBefore: false
            });
        }
    }

    // 3. Automatically sync to job.technicianObservations
    const severityPrefix = finding.severity === 'urgent' ? '🔴 [URGENT FINDING]' : '🟡 [ADVISORY FINDING]';
    const obsText = `${severityPrefix} ${finding.category} - ${finding.itemLabel}: ${finding.notes}`;
    const existingObs = job.technicianObservations || [];
    
    // Replace if existing observation with same category & label exists, otherwise append
    const cleanObs = existingObs.filter(o => !o.includes(`${finding.category} - ${finding.itemLabel}`));
    const updatedObservations = [...cleanObs, obsText];

    return {
        ...job,
        inspectionFindings: updatedFindings,
        inspectionChecklist: updatedChecklist,
        technicianObservations: updatedObservations
    };
};
