
import React, { useMemo } from 'react';
import {
    Job,
    Vehicle,
    Customer,
    Estimate,
    BusinessEntity,
    Engineer,
    TaxRate,
    EstimateLineItem,
    InspectionTemplate,
    ChecklistSection,
    TyreLocation,
    ChecklistItemStatus
} from '../types';
import InspectionChecklist from './InspectionChecklist';

interface PrintableJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    estimates?: Estimate[];
    entity?: BusinessEntity;
    engineers?: Engineer[];
    taxRates?: TaxRate[];
    printBlankInspectionSheet?: boolean;
    inspectionTemplates?: InspectionTemplate[];
}

const PrintableJobCard: React.FC<PrintableJobCardProps> = ({
    job,
    vehicle,
    customer,
    estimates = [],
    entity,
    engineers = [],
    taxRates = [],
    printBlankInspectionSheet,
    inspectionTemplates = [],
}) => {
    if (!job) return null;

    const jobData = job as any;
    const fName = customer?.forename || jobData.customerForename || "";
    const sName = customer?.surname || jobData.customerSurname || "";
    const customerFullName = `${fName} ${sName}`.trim();
    const displayName = customerFullName || (job.customerId ? `ACCOUNT: ${job.customerId}` : "DATA MISSING");

    const segments = Array.isArray(job.segments) ? job.segments : (Array.isArray(jobData.tasks) ? jobData.tasks : []);

    const technicianIds = new Set(segments.map((s: any) => s?.engineerId).filter(Boolean));

    const safeEngineers = Array.isArray(engineers) ? engineers : [];
    const technicianNames = Array.from(technicianIds)
        .map(id => safeEngineers.find(e => e.id === id)?.name)
        .filter(Boolean)
        .join(', ');

    const inspectionTemplate = useMemo(() => {
        if (!job?.inspectionTemplateId) return null;
        const safeTemplates = Array.isArray(inspectionTemplates) ? inspectionTemplates : [];
        return safeTemplates.find(t => t.id === job.inspectionTemplateId);
    }, [job?.inspectionTemplateId, inspectionTemplates]);

    const vehicleImage = useMemo(() => {
        const images = Array.isArray(vehicle?.images) ? vehicle.images : [];
        return images.find(img => img.isPrimaryDiagram) || images[0];
    }, [vehicle]);

    const hasFilledChecklist = useMemo(() => {
        if (!job?.inspectionChecklist) return false;
        return job.inspectionChecklist.some(section =>
            (section.items || []).some(item => item.status !== 'na' || (item.comment && item.comment.trim() !== ''))
        );
    }, [job?.inspectionChecklist]);

    const blankChecklistData: ChecklistSection[] = useMemo(() => {
        if (!inspectionTemplate || !Array.isArray(inspectionTemplate.sections)) return [];
        return inspectionTemplate.sections.map(section => ({
            id: section.id,
            title: section.title,
            items: Array.isArray(section.items) ? section.items.map(item => ({
                id: item.id,
                label: item.label,
                status: 'na',
                comment: ''
            })) : []
        }));
    }, [inspectionTemplate]);

    const pageStyle: React.CSSProperties = {
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
    };

    const tyreLocations: TyreLocation[] = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'spare'];
    const tyreLocationLabels: Record<TyreLocation, string> = { frontLeft: 'F/L', frontRight: 'F/R', rearLeft: 'R/L', rearRight: 'R/R', spare: 'Spare' };
    const statusLabels: Record<ChecklistItemStatus, string> = { ok: 'OK', attention: 'ATTN', urgent: 'URGENT', na: 'N/A' };
    const totalCalculatedHours = useMemo(() => {
        const estItems = (estimates || []).flatMap(e => e.lineItems || []);
        const hourTotal = estItems
            .filter(li => {
                const isLabor = li.isLabor ||
                    li.type === 'labor' ||
                    li.partNumber === 'LABOUR' ||
                    li.partNumber === 'MOT' ||
                    li.description?.toLowerCase().includes('labour');
                return isLabor;
            })
            .reduce((sum, li) => sum + Number(li.quantity || 0), 0);

        return hourTotal > 0 ? hourTotal : (job.estimatedHours || 0);
    }, [estimates, job.estimatedHours]);

    const mainContent = (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
            <header className="flex justify-between items-start pb-6 border-b-4 border-gray-900 mb-8">
                <div className="flex items-center gap-6">
                    {entity?.logoUrl && (
                        <img src={entity.logoUrl} alt="Logo" className="h-20 object-contain" />
                    )}
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">
                            {entity?.name || 'WORKSHOP JOB CARD'}
                        </h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="bg-gray-900 text-white px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-widest">
                                Technician Copy
                            </span>
                            <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">
                                Job Sheet #{job.id}
                            </h2>
                        </div>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    <div className="mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Job Status</p>
                        <p className="font-black text-lg text-indigo-600 uppercase">{job.status}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Key Number</p>
                        <p className="font-black text-2xl text-gray-900">{job.keyNumber || 'N/A'}</p>
                    </div>
                </div>
            </header>

            <main className="flex-grow space-y-8">
                <section className="grid grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Customer Information</h3>
                        <p className="text-lg font-black text-gray-900 uppercase">{displayName}</p>
                        <div className="mt-2 text-xs space-y-1 text-gray-600">
                            <p>{customer?.addressLine1 || "Address not provided"}</p>
                            <p>{customer?.city} {customer?.postcode}</p>
                            <div className="pt-2 mt-2 border-t border-gray-200 flex flex-col font-bold text-gray-900">
                                <span>Tel: {customer?.mobile || customer?.phone || 'No Contact Number'}</span>
                                <span className="text-indigo-600 font-normal">{customer?.email || 'No Email Recorded'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Vehicle Details</h3>
                        <p className="text-lg font-black text-gray-900 uppercase">{vehicle?.make} {vehicle?.model || 'Unknown Vehicle'}</p>
                        <div className="mt-2">
                            <span className="bg-yellow-400 text-black px-4 py-1.5 rounded font-mono font-bold text-xl border-2 border-black shadow-sm inline-block">
                                {vehicle?.registration || 'NO REG'}
                            </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 text-[10px] font-mono text-gray-500 uppercase">
                            <span>VIN: {vehicle?.vin?.slice(-8) || 'N/A'}</span>
                            <span className="text-right">Colour: {vehicle?.colour || 'N/A'}</span>
                        </div>
                    </div>
                </section>

                <section className="border-2 border-gray-900 rounded-lg overflow-hidden">
                    <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest">Primary Work Description</h3>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Hours: {totalCalculatedHours}h</span>
                    </div>
                    <div className="p-4 bg-white">
                        <p className="text-lg font-bold text-gray-900 mb-2 underline decoration-indigo-500 underline-offset-4">
                            {job.description}
                        </p>
                        <div className="p-3 bg-gray-50 rounded text-gray-800 whitespace-pre-wrap min-h-[60px] border border-gray-100 italic">
                            {job.notes || "No booking notes provided."}
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Required Parts & Labour Items</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                                <tr>
                                    <th className="px-4 py-2 w-1/4">Ref / Part No.</th>
                                    <th className="px-4 py-2 w-1/2">Description</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-center w-16">Done</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(estimates || []).length > 0 ? (
                                    (estimates || []).flatMap(est => (est.lineItems || []).map((item: EstimateLineItem) => {
                                        const isPackageHeader = item.servicePackageId && !item.isPackageComponent;
                                        const rowClass = isPackageHeader ? "bg-gray-100 font-black text-gray-950" : "text-sm";

                                        return (
                                            <tr key={item.id} className={rowClass}>
                                                <td className="px-4 py-3 font-mono text-[10px] text-gray-400 uppercase">
                                                    {isPackageHeader ? 'PACKAGE' : (item.partNumber || (item.isLabor ? 'LABOUR' : 'PART'))}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={isPackageHeader ? "text-lg uppercase tracking-tight" : "text-gray-900 font-semibold"}>
                                                        {item.description}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold">
                                                    {!isPackageHeader && item.quantity}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {!isPackageHeader && <div className="w-5 h-5 border-2 border-gray-300 rounded mx-auto bg-white"></div>}
                                                </td>
                                            </tr>
                                        );
                                    }))
                                ) : (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400 italic">No line items linked to this job card.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div style={{ pageBreakBefore: 'always' }} />

                <section className="flex-grow flex flex-col">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Technician Findings / Required Repairs</h3>
                    <div className="flex-grow border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50/30 min-h-[200px]">
                        <div className="space-y-4">
                            {(job.technicianObservations && job.technicianObservations.length > 0) ? (
                                job.technicianObservations.map((note, index) => (
                                    <p key={index} className="text-sm border-b border-gray-200 pb-2">{note}</p>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 italic">No notes recorded.</p>
                            )}
                            {[...Array(Math.max(0, 10 - (job.technicianObservations || []).length))].map((_, i) => (
                                <div key={i} className="border-b-2 border-dotted border-gray-300 h-8"></div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mt-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Vehicle Damage & Tyre Report</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="relative w-full mx-auto rounded-lg overflow-hidden shadow-md bg-gray-200 border border-gray-300">
                            {vehicleImage ? (
                                <img src={vehicleImage.dataUrl} alt="Vehicle Diagram" className="w-full" />
                            ) : (
                                <div className="h-48 flex items-center justify-center"><p className="text-gray-500">No vehicle image</p></div>
                            )}
                            {(job.damagePoints || []).map(point => (
                                <div key={point.id} className="absolute w-5 h-5 rounded-full bg-red-500 bg-opacity-75 border-2 border-white shadow-lg" style={{ top: `${point.y}%`, left: `${point.x}%`, transform: 'translate(-50%, -50%)' }} title={point.notes}></div>
                            ))}
                        </div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white text-[10px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 uppercase text-gray-500 border-b">
                                    <tr>
                                        <th className="px-3 py-1.5">Tyre</th>
                                        <th className="px-2 py-1.5">Outer</th>
                                        <th className="px-2 py-1.5">Mid</th>
                                        <th className="px-2 py-1.5">Inner</th>
                                        <th className="px-2 py-1.5">PSI</th>
                                        <th className="px-3 py-1.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-mono">
                                    {tyreLocations.map(location => {
                                        const tyreData = job.tyreCheck?.[location];
                                        return (
                                            <tr key={location} className="text-xs">
                                                <th className="px-3 py-2 font-bold uppercase">{tyreLocationLabels[location]}</th>
                                                <td className="px-2 py-2">{tyreData?.outer || '-'}</td>
                                                <td className="px-2 py-2">{tyreData?.middle || '-'}</td>
                                                <td className="px-2 py-2">{tyreData?.inner || '-'}</td>
                                                <td className="px-2 py-2">{tyreData?.pressure || '-'}</td>
                                                <td className="px-3 py-2 font-bold">{statusLabels[tyreData?.indicator || 'na']}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="mt-8 pt-6 border-t-2 border-gray-900 text-[11px]">
                <div className="grid grid-cols-2 gap-16">
                    <div>
                        <p className="mb-8 uppercase font-bold text-gray-400 tracking-widest">Lead Technician</p>
                        <p className="mb-1 text-sm text-black font-black">{technicianNames || '__________________________'}</p>
                        <div className="border-t border-black pt-1">Sign-off Signature</div>
                    </div>
                    <div className="text-right">
                        <p className="mb-8 uppercase font-bold text-gray-400 tracking-widest">Quality Assurance / Date</p>
                        <p className="mb-1 text-black font-bold text-sm">___ / ___ / 202___</p>
                        <div className="border-t border-black pt-1 w-48 ml-auto text-right">Manager Signature</div>
                    </div>
                </div>
                <div className="mt-6 text-center text-[9px] text-gray-400 uppercase tracking-widest">
                    Generated via Workshop Management System
                </div>
            </footer>
        </div>
    );

    const blankInspectionSheet = printBlankInspectionSheet && inspectionTemplate && (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
            <header className="flex justify-between items-center mb-6 border-b pb-2">
                <h2 className="text-2xl font-bold text-gray-800">{inspectionTemplate.name}</h2>
                <div className="text-right text-sm">
                    <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                    <p><strong>Job:</strong> {job?.id}</p>
                </div>
            </header>
            <main>
                <InspectionChecklist
                    checklistData={blankChecklistData}
                    onUpdate={() => { }}
                    isReadOnly={true}
                />
            </main>
        </div>
    );

    const filledInspectionSheet = hasFilledChecklist && (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
            <header className="flex justify-between items-center mb-6 border-b pb-2">
                <h2 className="text-2xl font-bold text-gray-800">{inspectionTemplate?.name || 'Inspection Report'}</h2>
                <div className="text-right text-sm">
                    <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                    <p><strong>Job:</strong> {job?.id}</p>
                </div>
            </header>
            <main>
                <InspectionChecklist
                    checklistData={job.inspectionChecklist || []}
                    onUpdate={() => { }}
                    isReadOnly={true}
                />
            </main>
        </div>
    );


    return (
        <div style={{ backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 15mm; 
                    }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body * { 
                        visibility: hidden; 
                    }
                    .rebuild-print-container, .rebuild-print-container * { 
                        visibility: visible !important; 
                    }
                    .rebuild-print-container { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important;
                    }
                    .printable-page { page-break-after: always; }

                    /* Repeating Header/Footer Logic */
                    .page-header-space { height: 15mm; }
                    .page-footer-space { height: 10mm; }

                    .page-header {
                        position: fixed;
                        top: 0;
                        width: 100%;
                        height: 15mm;
                        display: none; /* Only show on subsequent pages */
                        border-bottom: 1px solid #e5e7eb;
                        align-items: center;
                        justify-content: space-between;
                        font-size: 10px;
                        font-weight: bold;
                        color: #6b7280;
                    }

                    .page-footer {
                        position: fixed;
                        bottom: 0px;
                        width: 100%;
                        height: 10mm;
                        display: flex;
                        align-items: center;
                        border-top: 1px solid #e5e7eb;
                        font-size: 9px;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        color: #9ca3af;
                    }

                    /* Only show header from page 2 onwards by using a simple trick with first-page detection */
                    .page-header { display: flex !important; visibility: hidden !important; }
                    
                }

                @media print {
                    .first-page-hide { display: none !important; }
                }
            `}} />

            <div className="rebuild-print-container font-sans">
                {/* Fixed Repeating Footer */}
                <div className="page-footer hidden print:flex items-center justify-between">
                    <span>{entity?.name || 'Workshop Job Card'} - Job #{job.id}</span>
                    <div className="flex gap-2">
                        <span>Printed: {new Date().toLocaleDateString('en-GB')}</span>
                    </div>
                </div>

                {/* Main Print Table to force margins and header/footer space */}
                <table className="w-full">
                    <thead className="hidden print:table-header-group">
                        <tr>
                            <td>
                                <div className="h-[15mm] flex items-center justify-between border-b mb-4 opacity-0 print:opacity-100">
                                    <div className="flex gap-4">
                                        <span className="text-xs font-black text-gray-900">JOB SHEET #{job.id}</span>
                                        <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-mono font-bold text-xs border border-black">{vehicle?.registration}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">{displayName}</span>
                                </div>
                            </td>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <td>
                                <div className="rebuild-print-content">
                                    {mainContent}
                                    {filledInspectionSheet}
                                    {blankInspectionSheet}
                                </div>
                            </td>
                        </tr>
                    </tbody>

                    <tfoot className="hidden print:table-footer-group">
                        <tr><td><div className="h-[10mm]"></div></td></tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default PrintableJobCard;
