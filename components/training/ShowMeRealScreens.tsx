import React from 'react';
import {
    Search, Building2, HelpCircle, Award, Car, Wrench, Package,
    CheckCircle2, AlertTriangle, Send, ShieldCheck, Camera, Upload,
    Clock, FileText, Download, Plus, KeyRound, Gauge
} from 'lucide-react';
import { TrainingModuleId } from '../../core/data/trainingModules';

interface ShowMeRealScreenProps {
    moduleId: TrainingModuleId;
    stepIndex: number;
    targetId: string;
}

const hl = (active: boolean) =>
    active
        ? 'ring-2 ring-indigo-600 ring-offset-1 shadow-md transition-all duration-300'
        : 'transition-all duration-300';

export const ShowMeRealScreen: React.FC<ShowMeRealScreenProps> = ({ moduleId, stepIndex, targetId }) => {
    // 1. FIRST-TIME USER: Real MainLayout Header + Nav + Global Search
    if (moduleId === 'first-time-user') {
        return (
            <div className="bg-gray-100 rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="bg-white border-b border-gray-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-700 text-sm tracking-tight">BROOKSPEED</span>
                        <div className={`px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold flex items-center gap-1 text-[11px] ${hl(targetId === 'entity-pill')}`}>
                            <Building2 className="w-3 h-3" />
                            Brookspeed Porsche &amp; Performance
                        </div>
                    </div>
                    <div className={`relative flex-1 max-w-xs ${hl(targetId === 'global-search')}`}>
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <div className="w-full pl-8 pr-3 py-1 rounded-lg border border-gray-300 bg-gray-50 text-[11px] text-gray-800 font-medium">
                            {stepIndex >= 1 ? 'PO21 ABC' : 'Search VRM, Customer, Job #...'}
                        </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center gap-1 text-[11px] ${hl(targetId === 'help-btn')}`}>
                        <HelpCircle className="w-3.5 h-3.5" />
                        <Award className="w-3 h-3" />
                        CPD 3/6
                    </div>
                </div>
                <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex gap-3 text-[11px] font-semibold text-gray-600 overflow-x-auto">
                    <span className="text-indigo-600 border-b-2 border-indigo-600 pb-1">Dashboard</span>
                    <span>Dispatch</span>
                    <span>Inquiries</span>
                    <span>Estimates</span>
                    <span>Jobs</span>
                    <span>Workflow</span>
                    <span>Invoices</span>
                </div>
                <div className="p-3">
                    {stepIndex === 1 && (
                        <div className="bg-white border border-indigo-200 rounded-lg p-2.5 shadow-sm max-w-md mx-auto space-y-1">
                            <div className="text-[10px] font-bold uppercase text-gray-400">Quick Search Results</div>
                            <div className="flex items-center justify-between p-1.5 rounded bg-indigo-50 text-indigo-950 font-semibold">
                                <span>PO21 ABC — Porsche 911 Carrera S</span>
                                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-indigo-200">2 Jobs • 1 Est</span>
                            </div>
                        </div>
                    )}
                    {stepIndex !== 1 && (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <div className="text-[10px] text-gray-500">Booked Today</div>
                                <div className="text-base font-black text-gray-900">12 Vehicles</div>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <div className="text-[10px] text-gray-500">Open Inquiries</div>
                                <div className="text-base font-black text-indigo-600">5 Inbox</div>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <div className="text-[10px] text-gray-500">Ready for QC</div>
                                <div className="text-base font-black text-emerald-600">3 Jobs</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 2. INQUIRIES: Real Kanban Columns & Smart Create Estimate
    if (moduleId === 'inquiries') {
        return (
            <div className="bg-gray-100 rounded-xl border border-gray-200 p-3 text-xs">
                <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-2">
                        <div className="font-bold text-gray-700 text-[11px] flex justify-between">
                            <span>Inbox</span>
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 rounded-full text-[10px]">{stepIndex === 2 ? '0' : '1'}</span>
                        </div>
                        {stepIndex < 2 && (
                            <div className={`bg-white p-2.5 rounded-lg border border-gray-200 space-y-1.5 ${hl(targetId === 'inq-card')}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-mono font-bold text-[10px] text-indigo-700">INQ-402</span>
                                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-bold">PO21 ABC</span>
                                </div>
                                <div className="font-bold text-gray-900">Major Service + Brake Fluid</div>
                                <div className="text-[10px] text-gray-500">Mr J. Taylor • 07700 900123</div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-2.5 space-y-2">
                        <div className="font-bold text-gray-800 text-[11px]">Inquiry Triage</div>
                        <div className={`p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] space-y-0.5 ${hl(targetId === 'inq-dup')}`}>
                            <div className="font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Matched Existing Customer
                            </div>
                            <div>J. Taylor (CUST-104) • Porsche 911</div>
                        </div>
                        <button
                            type="button"
                            className={`w-full py-1.5 px-2 rounded-lg bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center gap-1 ${hl(targetId === 'inq-convert')}`}
                        >
                            <FileText className="w-3 h-3" />
                            Smart Create Estimate
                        </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-2">
                        <div className="font-bold text-gray-700 text-[11px] flex justify-between">
                            <span>Quoted or Responded</span>
                            <span className="bg-emerald-100 text-emerald-700 px-1.5 rounded-full text-[10px]">{stepIndex === 2 ? '1' : '0'}</span>
                        </div>
                        {stepIndex === 2 && (
                            <div className="bg-white p-2.5 rounded-lg border border-emerald-300 space-y-1">
                                <div className="font-mono font-bold text-[10px] text-emerald-700">INQ-402 → EST-1084</div>
                                <div className="font-bold text-gray-900">Major Service + Brake Fluid</div>
                                <div className="text-[10px] text-emerald-700 font-semibold">Linked to Customer &amp; Vehicle</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 3. FCS DISPATCH: Unallocated Queue + Ramp Timeline + Capacity Bar
    if (moduleId === 'fcs') {
        return (
            <div className="bg-gray-100 rounded-xl border border-gray-200 p-3 text-xs space-y-2.5">
                <div className={`bg-white rounded-lg border border-gray-200 px-3 py-1.5 flex items-center justify-between ${hl(targetId === 'fcs-cap')}`}>
                    <span className="font-bold text-gray-800 text-[11px]">Workshop Daily Capacity</span>
                    <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 transition-all" style={{ width: stepIndex >= 1 ? '82%' : '74%' }} />
                        </div>
                        <span className="font-mono font-bold text-[11px] text-indigo-700">{stepIndex >= 1 ? '82%' : '74%'}</span>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-white rounded-lg border border-gray-200 p-2 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase text-gray-500">Unallocated</div>
                        {stepIndex === 0 && (
                            <div className={`p-2 rounded-lg border border-emerald-300 bg-emerald-50/70 space-y-1 ${hl(targetId === 'fcs-unalloc')}`}>
                                <div className="flex justify-between font-bold text-[10px]">
                                    <span>JOB-882</span>
                                    <span className="text-emerald-700">3.0h</span>
                                </div>
                                <div className="font-semibold text-gray-900">PO21 ABC • Major Service</div>
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold">
                                    Parts: Fully Received
                                </span>
                            </div>
                        )}
                        {stepIndex >= 1 && (
                            <div className="text-[10px] text-gray-400 italic py-4 text-center">Queue clear</div>
                        )}
                    </div>
                    <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-2 space-y-1.5">
                        <div className="grid grid-cols-4 text-[10px] font-mono text-gray-400 border-b border-gray-100 pb-1">
                            <span>Ramp / Tech</span><span>09:00</span><span>10:00</span><span>11:00</span>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-1 py-1">
                            <span className="font-bold text-gray-700 text-[11px]">Ramp 1 (Sam)</span>
                            <div className="col-span-2 bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-700 truncate">
                                JOB-879 • MOT &amp; Checks
                            </div>
                        </div>
                        <div className={`grid grid-cols-4 items-center gap-1 py-1 rounded-lg ${hl(targetId === 'fcs-bay')}`}>
                            <span className="font-bold text-gray-800 text-[11px]">Ramp 2 (Alex)</span>
                            <div className="text-[10px] text-gray-400">Free</div>
                            {stepIndex >= 1 ? (
                                <div className="col-span-2 bg-indigo-600 text-white rounded px-2 py-1 text-[10px] font-bold shadow-xs">
                                    JOB-882 • PO21 ABC (3.0h)
                                </div>
                            ) : (
                                <div className="col-span-2 border-2 border-dashed border-indigo-300 rounded px-2 py-1 text-[10px] text-indigo-500 text-center">
                                    Drop Job Here
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 4. ESTIMATES: Real Version Badge + Drift Alert + Pre-Invoice Guardrail
    if (moduleId === 'estimates') {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-gray-900">Estimate #EST-1084 • PO21 ABC</span>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                        stepIndex === 1
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    } ${hl(targetId === 'est-drift' || targetId === 'est-ver')}`}>
                        {stepIndex === 1 ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                        {stepIndex === 0 && 'v1 • Sent & Secured (£420.00)'}
                        {stepIndex === 1 && 'Drift +£89.00 vs v1 (Sent £420.00)'}
                        {stepIndex === 2 && 'v2 • Change Notice Sent (£509.00)'}
                    </div>
                </div>
                <div className="p-3 space-y-2">
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                        <div className="px-3 py-1.5 flex justify-between">
                            <span>Annual Minor Service (Porsche 911)</span>
                            <span className="font-mono font-bold">£420.00</span>
                        </div>
                        {stepIndex >= 1 && (
                            <div className="px-3 py-1.5 flex justify-between bg-amber-50/50">
                                <span>+ Brake Fluid Change (Added post-send)</span>
                                <span className="font-mono font-bold text-amber-800">£89.00</span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                        {stepIndex === 0 && (
                            <span className={`px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1 text-[11px] ${hl(targetId === 'est-send')}`}>
                                <Send className="w-3 h-3" /> Email Estimate (Locks v1)
                            </span>
                        )}
                        {stepIndex >= 1 && (
                            <>
                                <span className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1 text-[11px]">
                                    <ShieldCheck className="w-3 h-3" /> Record Verbal / Check-In Approval
                                </span>
                                <span className={`px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1 text-[11px] ${hl(targetId === 'est-ver')}`}>
                                    <Send className="w-3 h-3" /> Send Change Notice &amp; Bump to v2
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 5. WORKFLOW / CHECK-IN: Real CheckInModal UI
    if (moduleId === 'workflow') {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="px-3 py-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-gray-900">
                        <Car className="w-4 h-4 text-indigo-600" />
                        Vehicle Check-In — Job #JOB-882 (PO21 ABC)
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stepIndex >= 2 ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {stepIndex >= 2 ? 'Pending QC -> Complete' : 'Booked In -> On Site'}
                    </span>
                </div>
                <div className="p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><KeyRound className="w-3 h-3 text-indigo-600" /> Key #</span>
                            <span className="font-black text-slate-900">14</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Gauge className="w-3 h-3 text-indigo-600" /> Mileage</span>
                            <span className="font-black text-slate-900">42,150 mi</span>
                        </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                        <div className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-amber-600" /> Job Card Checks &amp; Extra Service Packages
                        </div>
                        <div className={`flex items-center gap-2 ${hl(targetId === 'wf-check')}`}>
                            <div className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-800">
                                Noise from suspension
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Check
                            </span>
                        </div>
                        <div className={`flex items-center justify-between pt-1 border-t border-amber-200/70 ${hl(targetId === 'wf-pkg')}`}>
                            {stepIndex >= 1 ? (
                                <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold text-[11px]">
                                    Brake Fluid Change (£89.00)
                                </span>
                            ) : (
                                <span className="text-[11px] text-gray-600">Select vehicle-matched package...</span>
                            )}
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] flex items-center gap-1">
                                <Package className="w-3 h-3" /> Add Service Package
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 6. INVENTORY / POs
    if (moduleId === 'inventory') {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-gray-900">Purchase Orders — JOB-882</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stepIndex === 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} ${hl(targetId === 'inv-stat')}`}>
                        {stepIndex === 2 ? 'Job Parts: Fully Received' : stepIndex === 1 ? 'Job Parts: On Order' : 'Awaiting Order'}
                    </span>
                </div>
                <div className="p-3 space-y-2">
                    <div className="grid grid-cols-4 font-bold text-[10px] uppercase text-gray-500 border-b border-gray-100 pb-1">
                        <span>PO #</span><span>Supplier</span><span>Expected</span><span>Action</span>
                    </div>
                    <div className="grid grid-cols-4 items-center py-1.5">
                        <span className={`font-mono font-bold text-indigo-700 ${hl(targetId === 'inv-po')}`}>PO-2041</span>
                        <span className={`text-gray-800 truncate ${hl(targetId === 'inv-sup')}`}>Porsche Bournemouth</span>
                        <span className="text-gray-600">Tomorrow 09:00</span>
                        <span className="px-2 py-1 rounded bg-indigo-600 text-white font-bold text-[10px] text-center">
                            {stepIndex === 2 ? 'Received ✓' : stepIndex === 1 ? 'Mark Received' : 'Raise PO'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // 7. INVOICING
    if (moduleId === 'invoicing') {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-gray-900">Invoice #INV-3091 • PO21 ABC</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stepIndex >= 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {stepIndex >= 1 ? 'Paid in Full (Card)' : 'Ready to Invoice'}
                    </span>
                </div>
                <div className="p-3 space-y-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                        <div>
                            <div className="font-bold text-gray-900">Major Service + Brake Fluid Change</div>
                            <div className="text-[10px] text-gray-500">Drift Guardrail: Authorized (£509.00 inc VAT)</div>
                        </div>
                        <div className="text-base font-black text-gray-900 font-mono">£509.00</div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <span className={`px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-[11px] ${hl(targetId === 'invc-gen')}`}>
                            Generate Invoice
                        </span>
                        <span className={`px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] ${hl(targetId === 'invc-pay')}`}>
                            Record Card Payment
                        </span>
                        <span className={`px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold text-[11px] flex items-center gap-1 ${hl(targetId === 'invc-nom')}`}>
                            <Download className="w-3 h-3" /> Nominal CSV
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // 8. DIRECTORS / IMPORTS / CPD MATRIX
    if (moduleId === 'directors') {
        return (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-xs space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                    <div className={`bg-white p-2.5 rounded-lg border border-gray-200 ${hl(targetId === 'dir-kpi')}`}>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Monthly GP</div>
                        <div className="text-base font-black text-emerald-700">64.2%</div>
                    </div>
                    <div className={`bg-white p-2.5 rounded-lg border border-gray-200 ${hl(targetId === 'dir-imp')}`}>
                        <div className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1"><Upload className="w-3 h-3 text-indigo-600" /> CSV Import</div>
                        <div className="text-[11px] font-bold text-gray-900 mt-0.5">24 New • 3 Dupes Skipped</div>
                    </div>
                    <div className={`bg-white p-2.5 rounded-lg border border-gray-200 ${hl(targetId === 'dir-cpd')}`}>
                        <div className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1"><Award className="w-3 h-3 text-indigo-600" /> Staff CPD</div>
                        <div className="text-base font-black text-indigo-700">92% Current</div>
                    </div>
                </div>
            </div>
        );
    }

    // 9. MOBILE COMPANION
    return (
        <div className="bg-gray-100 rounded-xl border border-gray-200 p-3 flex justify-center">
            <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden text-xs">
                <div className="bg-indigo-600 text-white px-3 py-2 flex items-center justify-between font-bold">
                    <span>Brookspeed Mobile Tech</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">PWA Live</span>
                </div>
                <div className="p-3 space-y-2">
                    <div className={`p-2 rounded-lg border border-gray-200 bg-gray-50 flex justify-between items-center ${hl(targetId === 'mob-shell')}`}>
                        <div>
                            <div className="font-bold text-gray-900">JOB-882 • PO21 ABC</div>
                            <div className="text-[10px] text-gray-500">Check: Noise from suspension</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                            {stepIndex === 2 ? 'Pending QC' : 'In Progress'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className={`p-2 rounded-lg border border-gray-200 flex items-center gap-1.5 font-semibold text-gray-700 ${hl(targetId === 'mob-photo')}`}>
                            <Camera className="w-3.5 h-3.5 text-indigo-600" />
                            {stepIndex >= 1 ? 'Photo Synced ✓' : 'Take Photo'}
                        </div>
                        <div className={`p-2 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center gap-1.5 font-semibold text-emerald-800 ${hl(targetId === 'mob-evhc')}`}>
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            {stepIndex === 2 ? 'QC Submitted' : 'Complete Job'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
