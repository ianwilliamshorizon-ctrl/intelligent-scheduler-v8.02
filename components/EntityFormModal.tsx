import React, { useState, useEffect } from 'react';
import { BusinessEntity, WorkingHoursConfig } from '../types';
import FormModal from './FormModal';
import { saveFile, getFile } from '../utils/imageStore';
import { Clock, Layout, FileText, Settings, Briefcase, Building2, Upload, FileCheck, Trash2, Camera, Eye, Sparkles, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import PrintableInvoice from './PrintableInvoice';
import PrintableJobCard from './PrintableJobCard';
import * as T from '../types';
import { useData } from '../core/state/DataContext';
import DocumentLayoutDesignerModal from './management/DocumentLayoutDesignerModal';

const EntityFormInput = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input className="w-full p-2 border border-gray-300 rounded-lg text-sm" {...props} />
    </div>
);

const EntityFormTextarea = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea className="w-full p-2 border border-gray-300 rounded-lg text-sm" {...props} />
    </div>
);

const EntityFormSelect = ({ label, children, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm" {...props}>{children}</select>
    </div>
);

const ColorPicker = ({ label, value, onChange, name }: { label: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, name: string }) => {
    const colors = ['blue', 'green', 'purple', 'gray', 'yellow', 'pink', 'orange', 'red', 'indigo', 'slate'];
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative">
                <EntityFormSelect name={name} value={value} onChange={onChange}>
                    {colors.map(color => <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>)}
                </EntityFormSelect>
                <div className={`absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-${value}-500 shadow-sm border border-white`}></div>
            </div>
        </div>
    )
};

interface EntityFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (entity: BusinessEntity) => void;
    entity: BusinessEntity | null;
    isDebugMode: boolean;
}

const EntityFormModal: React.FC<EntityFormModalProps> = ({ isOpen, onClose, onSave, entity, isDebugMode }) => {
    const { taxRates, servicePackages, inspectionTemplates, inspectionDiagrams } = useData();
    const [activeTab, setActiveTab] = useState<'core' | 'workshop' | 'terms' | 'documents'>('core');
    const [formData, setFormData] = useState<Partial<BusinessEntity> & { tempLogoUrl?: string }>({});
    const [previewType, setPreviewType] = useState<'job_card' | 'invoice' | null>(null);
    const [isSubDesignerOpen, setIsSubDesignerOpen] = useState(false);
    const [subDesignerDocType, setSubDesignerDocType] = useState<'job_card' | 'invoice'>('job_card');

    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Sample_${previewType}`,
    });

    const handlePreview = (type: 'job_card' | 'invoice') => {
        setPreviewType(type);
        setTimeout(() => {
            handlePrint();
        }, 100);
    };

    const defaultWorkingHours: WorkingHoursConfig = {
        startHour: 8.5,
        endHour: 17.5,
        isOpenSaturday: true,
        saturdayStartHour: 8.5,
        saturdayEndHour: 12.5,
        isOpenSunday: false,
        region: 'england-and-wales'
    };

    useEffect(() => {
        const initialData: Partial<BusinessEntity> = entity ? { ...entity } : { id: crypto.randomUUID() };
        if (!initialData.workingHours && initialData.type === 'Workshop') {
            initialData.workingHours = { ...defaultWorkingHours };
        }
        setFormData({ ...initialData, tempLogoUrl: undefined });
        if (entity?.logoImageId) {
            getFile(entity.logoImageId).then(url => {
                if(url) setFormData(p => ({ ...p, tempLogoUrl: url }));
            });
        }
    }, [entity, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const inputType = e.target.getAttribute('type');
        const numValue = (inputType === 'number') ? parseFloat(value) || undefined : value;
        setFormData(prev => ({ ...prev, [name]: numValue }));
    };

    const handleWorkingHoursChange = (field: keyof WorkingHoursConfig, value: any) => {
        setFormData(prev => ({
            ...prev,
            workingHours: {
                ...(prev.workingHours || defaultWorkingHours),
                [field]: value
            }
        }));
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const imageId = `logo_${formData.id || crypto.randomUUID()}`;
            try {
                await saveFile(imageId, file);
                const previewUrl = URL.createObjectURL(file);
                setFormData(prev => ({ ...prev, logoImageId: imageId, tempLogoUrl: previewUrl }));
            } catch (err) {
                console.error("Failed to save logo", err);
                alert("Could not save logo image.");
            }
        }
    };

    const handleSave = () => {
        const { tempLogoUrl, ...dataToSave } = formData;
        onSave(dataToSave as BusinessEntity);
        onClose();
    };

    const handleOpenDesigner = (docType: 'job_card' | 'invoice') => {
        setSubDesignerDocType(docType);
        setIsSubDesignerOpen(true);
    };

    const handleSaveFromSubDesigner = async (updatedEntity: BusinessEntity) => {
        setFormData(prev => ({
            ...prev,
            ...updatedEntity
        }));
    };

    const tabs = [
        { id: 'core', label: 'Entity & Finance', icon: Building2 },
        { id: 'workshop', label: 'Workshop Operations', icon: Clock },
        { id: 'terms', label: 'Terms of Business', icon: Settings },
        { id: 'documents', label: 'Document Layouts', icon: Layout },
    ];

    return (
        <>
            <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={`Manage Entity: ${formData.name || 'New'}`} maxWidth="max-w-5xl">
                <div className="flex flex-col h-[70vh]">
                {/* Internal Tabs */}
                <div className="flex border-b mb-6 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {/* Tab 1: Core Details & Finance */}
                    {activeTab === 'core' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <EntityFormInput label="Entity Name" name="name" value={formData.name || ''} onChange={handleChange} />
                                <EntityFormSelect label="Type" name="type" value={formData.type || ''} onChange={handleChange}>
                                    <option value="Workshop">Workshop</option>
                                    <option value="Sales">Sales</option>
                                    <option value="Storage">Storage</option>
                                    <option value="Rentals">Rentals</option>
                                </EntityFormSelect>
                                <EntityFormInput label="Short Code" name="shortCode" value={formData.shortCode || ''} onChange={handleChange} maxLength={3} />
                                <EntityFormInput label="Outbound Email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="e.g. info@brookspeed.com" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <ColorPicker label="UI Theme Color" name="color" value={formData.color || 'gray'} onChange={handleChange}/>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                                    <div className="flex items-center gap-4 p-3 border rounded-xl bg-gray-50/50">
                                        <div className="h-16 w-16 bg-white border rounded-lg flex items-center justify-center overflow-hidden shadow-inner">
                                            {formData.tempLogoUrl ? (
                                                <img src={formData.tempLogoUrl} alt="logo preview" className="h-full w-full object-contain p-1" />
                                            ) : (
                                                <Camera className="text-gray-300" size={24} />
                                            )}
                                        </div>
                                        <div className="flex-grow">
                                            <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                                            <p className="mt-1 text-[10px] text-gray-400">Recommended: PNG/JPG with transparent background</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Registered Address & Identifiers */}
                            <div className="pt-4 border-t space-y-4">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Registered Address & Company Numbers</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EntityFormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} />
                                    <EntityFormInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} />
                                    <EntityFormInput label="City" name="city" value={formData.city || ''} onChange={handleChange} />
                                    <EntityFormInput label="Postcode" name="postcode" value={formData.postcode || ''} onChange={handleChange} />
                                    <EntityFormInput label="Company Phone" name="phone" value={formData.phone || ''} onChange={handleChange} />
                                    <EntityFormInput label="Company Registration Number" name="companyNumber" value={formData.companyNumber || ''} onChange={handleChange} placeholder="e.g. 04829104" />
                                    <EntityFormInput label="VAT Registration Number" name="vatNumber" value={formData.vatNumber || ''} onChange={handleChange} placeholder="e.g. GB 829 4019 32" />
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="pt-4 border-t space-y-4">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bank Remittance Information</h4>
                                    <p className="text-[11px] text-slate-500">Appears on invoices and estimates for customer BACS electronic payments.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <EntityFormInput label="Bank Account / Bank Name" name="bankAccountName" value={formData.bankAccountName || ''} onChange={handleChange} placeholder="e.g. Barclays Bank UK" />
                                    <EntityFormInput label="Bank Sort Code" name="bankSortCode" value={formData.bankSortCode || ''} onChange={handleChange} placeholder="e.g. 20-45-78" />
                                    <EntityFormInput label="Bank Account Number" name="bankAccountNumber" value={formData.bankAccountNumber || ''} onChange={handleChange} placeholder="e.g. 83920194" />
                                </div>
                            </div>

                            {/* Footer Text */}
                            <div className="pt-4 border-t">
                                <EntityFormTextarea 
                                    label="Invoice Footer / Legal Registration Text" 
                                    name="invoiceFooterText" 
                                    value={formData.invoiceFooterText || ''} 
                                    onChange={handleChange} 
                                    rows={2} 
                                    placeholder="e.g. Registered in England & Wales. Thank you for your business." 
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Workshop Operations */}
                    {activeTab === 'workshop' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <EntityFormInput label="Labor Rate (£)" name="laborRate" type="number" step="0.01" value={formData.laborRate || ''} onChange={handleChange} />
                                <EntityFormInput label="Labor Cost Rate (£)" name="laborCostRate" type="number" step="0.01" value={formData.laborCostRate || ''} onChange={handleChange} />
                                <EntityFormInput label="Daily Capacity (hours)" name="dailyCapacityHours" type="number" step="0.5" value={formData.dailyCapacityHours || ''} onChange={handleChange} />
                            </div>
                            
                            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <h4 className="font-bold text-sm text-indigo-900 mb-4 flex items-center gap-2"><Clock size={16}/> Workshop Hours</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1.5">Weekday Start (e.g. 8.5)</label>
                                        <input type="number" step="0.5" value={formData.workingHours?.startHour || 8.5} onChange={(e) => handleWorkingHoursChange('startHour', parseFloat(e.target.value))} className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1.5">Weekday End (e.g. 17.5)</label>
                                        <input type="number" step="0.5" value={formData.workingHours?.endHour || 17.5} onChange={(e) => handleWorkingHoursChange('endHour', parseFloat(e.target.value))} className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1.5">Holidays Region</label>
                                        <select value={formData.workingHours?.region || 'england-and-wales'} onChange={(e) => handleWorkingHoursChange('region', e.target.value)} className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                                            <option value="england-and-wales">England & Wales</option>
                                            <option value="scotland">Scotland</option>
                                            <option value="northern-ireland">Northern Ireland</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-3 flex items-center gap-6 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                                         <div className="flex items-center gap-3">
                                            <input type="checkbox" id="isOpenSaturday" checked={formData.workingHours?.isOpenSaturday || false} onChange={(e) => handleWorkingHoursChange('isOpenSaturday', e.target.checked)} className="h-5 w-5 text-indigo-600 rounded-lg border-indigo-300" />
                                            <label htmlFor="isOpenSaturday" className="text-sm font-bold text-gray-700">Open Saturday</label>
                                        </div>
                                        {formData.workingHours?.isOpenSaturday && (
                                            <div className="flex gap-4 animate-fade-in">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-400">From</span>
                                                    <input type="number" step="0.5" value={formData.workingHours?.saturdayStartHour || 8.5} onChange={(e) => handleWorkingHoursChange('saturdayStartHour', parseFloat(e.target.value))} className="w-20 p-1.5 border rounded-lg bg-gray-50 text-xs text-center" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-400">To</span>
                                                    <input type="number" step="0.5" value={formData.workingHours?.saturdayEndHour || 12.5} onChange={(e) => handleWorkingHoursChange('saturdayEndHour', parseFloat(e.target.value))} className="w-20 p-1.5 border rounded-lg bg-gray-50 text-xs text-center" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold text-sm text-gray-700 border-b pb-2 flex items-center gap-2">Automated Reminders</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EntityFormTextarea label="MOT Email Template" name="motReminderEmailTemplate" value={formData.motReminderEmailTemplate || ''} onChange={handleChange} rows={3} />
                                    <EntityFormTextarea label="MOT SMS Template" name="motReminderSmsTemplate" value={formData.motReminderSmsTemplate || ''} onChange={handleChange} rows={2} />
                                    <EntityFormTextarea label="Service Email Template" name="serviceReminderEmailTemplate" value={formData.serviceReminderEmailTemplate || ''} onChange={handleChange} rows={3} />
                                    <EntityFormTextarea label="Service SMS Template" name="serviceReminderSmsTemplate" value={formData.serviceReminderSmsTemplate || ''} onChange={handleChange} rows={2} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Terms of Business & Contracts */}
                    {activeTab === 'terms' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950">Terms of Business & Handover Disclaimers</h4>
                                <p className="text-[11px] text-indigo-700 mt-0.5">
                                    These terms automatically populate the Authorisation & Signatures block on your Job Cards, Invoices, and Agreements.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <EntityFormTextarea 
                                    label="Workshop Job Card & Invoice Terms of Business" 
                                    name="termsAndConditions" 
                                    value={formData.termsAndConditions || ''} 
                                    onChange={handleChange} 
                                    rows={4} 
                                    placeholder="I hereby authorize the repair work and acknowledge receipt of vehicle in satisfactory condition. All parts replaced remain the property of the workshop until invoice is paid in full."
                                />
                                <EntityFormTextarea label="Storage Terms & Conditions" name="storageTermsAndConditions" value={formData.storageTermsAndConditions || ''} onChange={handleChange} rows={4} />
                                <EntityFormTextarea label="Courtesy Car Agreement Terms" name="courtesyCarTermsAndConditions" value={formData.courtesyCarTermsAndConditions || ''} onChange={handleChange} rows={4} />
                                <EntityFormTextarea label="Rental Vehicle Agreement Terms" name="rentalTermsAndConditions" value={formData.rentalTermsAndConditions || ''} onChange={handleChange} rows={4} />
                                <EntityFormTextarea label="Sale or Return (SOR) Contract Terms" name="sorTermsAndConditions" value={formData.sorTermsAndConditions || ''} onChange={handleChange} rows={4} />
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Document Layout Form Builder */}
                    {activeTab === 'documents' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-5 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                                <h4 className="text-sm font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                                    <Sparkles size={16} className="text-indigo-600" />
                                    Modular Drag-and-Drop Document Form Builder
                                </h4>
                                <p className="text-xs text-indigo-700 leading-relaxed">
                                    Customize block layouts, box styles, container colors, and typography for Job Cards, Invoices, and Estimates with live WYSIWYG A4 sheet preview.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Job Card Layout Card */}
                                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <FileText size={22} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight">Workshop Job Card Layout</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technician Work Sheet & Signoff</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Configure vehicle details, technician instructions, parts & labour lists, labour tracking, and customer signature sign-off.
                                    </p>
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDesigner('job_card')}
                                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Layout size={14} /> Open Job Card Form Builder
                                        </button>
                                    </div>
                                </div>

                                {/* Invoice Layout Card */}
                                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                            <Building2 size={22} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight">Customer Invoice Layout</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing & Remittance Statement</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Configure billing details, line items table, financial VAT totals, bank remittance information, and legal footers.
                                    </p>
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDesigner('invoice')}
                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Layout size={14} /> Open Invoice Form Builder
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Sample Document Previews */}
                            <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Live Sample Print Previews</h4>
                                    <p className="text-[11px] text-slate-500">Preview the new modular document engines and print or export to PDF.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePreview('job_card')}
                                        className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Eye size={13} /> Preview Job Card
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePreview('invoice')}
                                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Eye size={13} /> Preview Invoice
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-Modal: Document Layout Designer when launched from inside EntityFormModal */}
            {isSubDesignerOpen && (
                <DocumentLayoutDesignerModal
                    isOpen={isSubDesignerOpen}
                    onClose={() => setIsSubDesignerOpen(false)}
                    entity={formData as BusinessEntity}
                    initialDocType={subDesignerDocType}
                    onSaveEntity={handleSaveFromSubDesigner}
                />
            )}
        </FormModal>

            {/* Hidden Printing Area */}
            <div className="hidden">
                <div ref={printRef}>
                    {previewType === 'job_card' && (
                        <PrintableJobCard 
                            job={SAMPLE_JOB}
                            customer={SAMPLE_CUSTOMER}
                            vehicle={SAMPLE_VEHICLE}
                            estimates={[SAMPLE_ESTIMATE]}
                            entity={formData as BusinessEntity}
                            taxRates={taxRates}
                            engineers={[]}
                            inspectionTemplates={inspectionTemplates}
                            inspectionDiagrams={inspectionDiagrams}
                        />
                    )}
                    {previewType === 'invoice' && (
                        <PrintableInvoice 
                            invoice={SAMPLE_INVOICE}
                            customer={SAMPLE_CUSTOMER}
                            vehicle={SAMPLE_VEHICLE}
                            entity={formData as BusinessEntity}
                            job={SAMPLE_JOB}
                            taxRates={taxRates}
                            servicePackages={servicePackages}
                            inspectionTemplates={inspectionTemplates}
                            inspectionDiagrams={inspectionDiagrams}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

const SAMPLE_CUSTOMER: T.Customer = {
    id: 'sample', forename: 'John', surname: 'Sample', email: 'john@example.com', phone: '01234 567890', addressLine1: '123 Sample Street', city: 'Sampleton', postcode: 'SA1 1MP', createdDate: ''
};

const SAMPLE_VEHICLE: T.Vehicle = {
    id: 'sample', registration: 'AB12 CDE', make: 'PORSCHE', model: '911 GT3 RS', year: 2024, colour: 'Guards Red', customerId: 'sample', vin: 'WP0ZZZ99ZNS123456', mileage: 12450
};

const SAMPLE_JOB: T.Job = {
    id: 'JOB-SAMPLE',
    jobNumber: '10842',
    entityId: 'sample',
    customerId: 'sample',
    vehicleId: 'sample',
    description: 'Annual Major Service, Brake Fluid Flush & Diagnostic Health Check',
    status: 'In Progress',
    scheduledDate: '2026-04-22',
    notes: 'Customer reported slight pedal play. Check front/rear brake pads, discs, and fluid lines. Valet upon completion.',
    keyNumber: '42',
    mileage: 12450,
    lineItems: [
        { id: '1', description: 'Major Service Inspection & Diagnostic Scan', quantity: 2.0, unitPrice: 110, unitCost: 0, isLabor: true, taxCodeId: 'T1' },
        { id: '2', description: 'Mobil 1 ESP 0W-40 Synthetic Engine Oil', quantity: 8.5, unitPrice: 18.5, unitCost: 10, isPackageComponent: true, taxCodeId: 'T1' },
        { id: '3', description: 'OEM Oil Filter Insert & O-Ring', quantity: 1, unitPrice: 28, unitCost: 14, isPackageComponent: true, taxCodeId: 'T1' },
        { id: '4', description: 'NGK Iridium Spark Plugs (Set of 6)', quantity: 6, unitPrice: 22, unitCost: 11, taxCodeId: 'T1' },
        { id: '5', description: 'Brake Fluid System Flush & Bleed (DOT 4)', quantity: 1, unitPrice: 75, unitCost: 20, isLabor: true, taxCodeId: 'T1' }
    ],
    segments: [
        { id: 'seg1', engineerId: 'eng1', startTime: '09:00', endTime: '11:00', date: '2026-04-22', duration: 120 },
        { id: 'seg2', engineerId: 'eng1', startTime: '11:30', endTime: '13:00', date: '2026-04-22', duration: 90 }
    ],
    technicianObservations: [
        'Front brake discs at 31.8mm (minimum thickness 30.0mm) - serviceable.',
        'Front brake pads at 75% remaining.',
        'Vehicle health check completed. All electronic fault codes cleared.'
    ]
};

const SAMPLE_INVOICE: T.Invoice = {
    id: 'INV-SAMPLE',
    entityId: 'sample',
    customerId: 'sample',
    vehicleId: 'sample',
    issueDate: '2026-04-22',
    dueDate: '2026-05-22',
    status: 'Paid',
    lineItems: [
        { id: '1', description: 'Major Service Package', quantity: 1, unitPrice: 350, unitCost: 0, taxCodeId: 'T1' },
        { id: '2', description: 'Engine Oil', quantity: 8, unitPrice: 15, unitCost: 0, taxCodeId: 'T1', isPackageComponent: true, servicePackageId: 'pkg1' },
        { id: '3', description: 'Oil Filter', quantity: 1, unitPrice: 25, unitCost: 0, taxCodeId: 'T1', isPackageComponent: true, servicePackageId: 'pkg1' },
        { id: '4', description: 'Brake Fluid Flush', quantity: 1, unitPrice: 85, unitCost: 0, taxCodeId: 'T1', isLabor: true },
        { id: '5', description: 'Brake Pads (Front)', quantity: 1, unitPrice: 120, unitCost: 0, taxCodeId: 'T1' }
    ],
    payments: [],
    totalAmount: 540
};

const SAMPLE_ESTIMATE: T.Estimate = {
    id: 'EST-SAMPLE',
    estimateNumber: '1001',
    entityId: 'sample',
    customerId: 'sample',
    vehicleId: 'sample',
    issueDate: '2026-04-22',
    expiryDate: '2026-05-22',
    status: 'Draft',
    lineItems: [
        { id: '1', description: 'Annual Inspection', quantity: 1, unitPrice: 150, unitCost: 0, taxCodeId: 'T1' },
        { id: '2', description: 'Spark Plugs (Set of 6)', quantity: 1, unitPrice: 180, unitCost: 0, taxCodeId: 'T1' },
        { id: '3', description: 'Labor - Spark Plug Replacement', quantity: 1.5, unitPrice: 80, unitCost: 0, taxCodeId: 'T1', isLabor: true }
    ]
};

export default EntityFormModal;
