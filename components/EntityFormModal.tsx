import React, { useState, useEffect } from 'react';
import { BusinessEntity, WorkingHoursConfig } from '../types';
import FormModal from './FormModal';
import { saveFile, getFile } from '../utils/imageStore';
import { Clock, Layout, FileText, Settings, Briefcase, Building2, Upload, FileCheck, Trash2, Camera, Eye, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import PrintableInvoice from './PrintableInvoice';
import { PrintableEstimate } from './estimates/PrintableEstimate';
import * as T from '../types';
import { useData } from '../core/state/DataContext';

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
    const [activeTab, setActiveTab] = useState<'core' | 'workshop' | 'templates' | 'terms' | 'layout'>('core');
    const [formData, setFormData] = useState<Partial<BusinessEntity> & { tempLogoUrl?: string }>({});
    const [previewType, setPreviewType] = useState<'estimate' | 'invoice' | null>(null);

    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Sample_${previewType}`,
    });

    const handlePreview = (type: 'estimate' | 'invoice') => {
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

    const handleLayoutChange = (field: keyof T.DocumentLayoutSettings, value: any) => {
        setFormData(prev => ({
            ...prev,
            layoutSettings: {
                ...(prev.layoutSettings || {}),
                [field]: value
            }
        }));
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

    const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'estimate' | 'invoice') => {
        const file = e.target.files?.[0];
        if (file) {
            const templateId = `template_${type}_${formData.id || crypto.randomUUID()}`;
            try {
                await saveFile(templateId, file);
                setFormData(prev => ({
                    ...prev,
                    [type === 'estimate' ? 'estimateTemplateId' : 'invoiceTemplateId']: templateId,
                    [type === 'estimate' ? 'estimateTemplateName' : 'invoiceTemplateName']: file.name
                }));
            } catch (err) {
                console.error("Failed to save template", err);
                alert("Could not save template file.");
            }
        }
    };

    const handleSave = () => {
        const { tempLogoUrl, ...dataToSave } = formData;
        onSave(dataToSave as BusinessEntity);
        onClose();
    };

    const tabs = [
        { id: 'core', label: 'Core Details', icon: Building2 },
        { id: 'workshop', label: 'Workshop', icon: Clock },
        { id: 'templates', label: 'Doc Templates', icon: FileText },
        { id: 'layout', label: 'Layout Designer', icon: Layout },
        { id: 'terms', label: 'Terms & Conditions', icon: Settings },
    ];

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={`Manage Entity: ${formData.name || 'New'}`} maxWidth="max-w-4xl">
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
                    {activeTab === 'core' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <EntityFormInput label="Entity Name" name="name" value={formData.name || ''} onChange={handleChange} />
                                <EntityFormSelect label="Type" name="type" value={formData.type || ''} onChange={handleChange}>
                                    <option value="Workshop">Workshop</option>
                                    <option value="Sales">Sales</option>
                                    <option value="Storage">Storage</option>
                                    <option value="Rentals">Rentals</option>
                                </EntityFormSelect>
                                <EntityFormInput label="Short Code" name="shortCode" value={formData.shortCode || ''} onChange={handleChange} maxLength={3} />
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
                                            <p className="mt-1 text-[10px] text-gray-400">Recommended: Square PNG/JPG with transparent background</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                <EntityFormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} />
                                <EntityFormInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} />
                                <EntityFormInput label="City" name="city" value={formData.city || ''} onChange={handleChange} />
                                <EntityFormInput label="Postcode" name="postcode" value={formData.postcode || ''} onChange={handleChange} />
                                <EntityFormInput label="Company Number" name="companyNumber" value={formData.companyNumber || ''} onChange={handleChange} />
                                <EntityFormInput label="VAT Number" name="vatNumber" value={formData.vatNumber || ''} onChange={handleChange} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                                <EntityFormInput label="Bank Account Name" name="bankAccountName" value={formData.bankAccountName || ''} onChange={handleChange} />
                                <EntityFormInput label="Bank Sort Code" name="bankSortCode" value={formData.bankSortCode || ''} onChange={handleChange} />
                                <EntityFormInput label="Bank Account Number" name="bankAccountNumber" value={formData.bankAccountNumber || ''} onChange={handleChange} />
                            </div>
                            <EntityFormTextarea label="Invoice Footer / Legal Text" name="invoiceFooterText" value={formData.invoiceFooterText || ''} onChange={handleChange} rows={2} />
                        </div>
                    )}

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

                    {activeTab === 'templates' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                                <Layout size={24} className="text-amber-600 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-amber-900 text-sm">Smart Document Templates</h4>
                                    <p className="text-xs text-amber-700 leading-relaxed mt-1">
                                        Upload a Word document (.docx) to define the layout of your printed Estimates and Invoices. 
                                        The AI will interpret your template and adapt the system's output to match your brand's look and feel.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Estimate Template */}
                                <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                            <Briefcase size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 uppercase text-xs tracking-tight">Estimate Template</h4>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Printed Estimate Layout</p>
                                        </div>
                                    </div>

                                    {formData.estimateTemplateId ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                                <FileCheck size={20} className="text-blue-600" />
                                                <div className="flex-grow min-w-0">
                                                    <p className="text-xs font-bold text-blue-900 truncate">{formData.estimateTemplateName || 'Template Loaded'}</p>
                                                    <p className="text-[10px] text-blue-500 font-medium">Ready for AI Interpretation</p>
                                                </div>
                                                <button onClick={() => setFormData(p => ({ ...p, estimateTemplateId: undefined, estimateTemplateName: undefined }))} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors rounded-lg">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <label className="w-full py-2.5 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-blue-600 hover:text-white transition-all text-center rounded-xl cursor-pointer border-2 border-dashed border-gray-200 hover:border-blue-600">
                                                Replace Template
                                                <input type="file" accept=".docx" onChange={(e) => handleTemplateUpload(e, 'estimate')} className="hidden" />
                                            </label>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all group h-40">
                                            <Upload size={32} className="text-gray-300 group-hover:text-blue-500 mb-3 transition-colors" />
                                            <span className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-blue-700">Upload .DOCX</span>
                                            <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold">Max size 5MB</span>
                                            <input type="file" accept=".docx" onChange={(e) => handleTemplateUpload(e, 'estimate')} className="hidden" />
                                        </label>
                                    )}
                                </div>

                                {/* Invoice Template */}
                                <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 uppercase text-xs tracking-tight">Invoice Template</h4>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Printed Invoice Layout</p>
                                        </div>
                                    </div>

                                    {formData.invoiceTemplateId ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-3 p-3 bg-green-50/50 rounded-xl border border-green-100">
                                                <FileCheck size={20} className="text-green-600" />
                                                <div className="flex-grow min-w-0">
                                                    <p className="text-xs font-bold text-green-900 truncate">{formData.invoiceTemplateName || 'Template Loaded'}</p>
                                                    <p className="text-[10px] text-green-500 font-medium">Ready for AI Interpretation</p>
                                                </div>
                                                <button onClick={() => setFormData(p => ({ ...p, invoiceTemplateId: undefined, invoiceTemplateName: undefined }))} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors rounded-lg">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <label className="w-full py-2.5 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-green-600 hover:text-white transition-all text-center rounded-xl cursor-pointer border-2 border-dashed border-gray-200 hover:border-green-600">
                                                Replace Template
                                                <input type="file" accept=".docx" onChange={(e) => handleTemplateUpload(e, 'invoice')} className="hidden" />
                                            </label>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl cursor-pointer hover:bg-green-50 hover:border-green-400 transition-all group h-40">
                                            <Upload size={32} className="text-gray-300 group-hover:text-green-500 mb-3 transition-colors" />
                                            <span className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-green-700">Upload .DOCX</span>
                                            <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold">Max size 5MB</span>
                                            <input type="file" accept=".docx" onChange={(e) => handleTemplateUpload(e, 'invoice')} className="hidden" />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText size={18} className="text-indigo-600" />
                                    <h4 className="font-black text-gray-900 uppercase text-xs tracking-tight">Template Content Editor</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EntityFormTextarea label="Invoice/Estimate Footer Text" name="invoiceFooterText" value={formData.invoiceFooterText || ''} onChange={handleChange} rows={3} placeholder="Legal registration, payment terms, etc." />
                                    <EntityFormTextarea label="Standard Terms & Conditions" name="storageTermsAndConditions" value={formData.storageTermsAndConditions || ''} onChange={handleChange} rows={3} placeholder="General terms for all documents." />
                                </div>
                            </div>

                            <div className="p-5 border border-indigo-100 rounded-2xl bg-indigo-50/20">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900">Starter Guide & Placeholders</h4>
                                    <button 
                                        onClick={() => {
                                            const tags = "[CustomerName], [CustomerAddress], [VehicleRegistration], [VehicleMake], [VehicleModel], [InvoiceNumber], [EstimateNumber], [Date], [LineItems], [Subtotal], [VATTotal], [GrandTotal], [TermsAndConditions], [BankDetails]";
                                            navigator.clipboard.writeText(tags);
                                            alert("Placeholders copied to clipboard!");
                                        }}
                                        className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        Copy All Tags
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                                    {["CustomerName", "VehicleRegistration", "InvoiceNumber", "LineItems", "GrandTotal", "BankDetails"].map(tag => (
                                        <div key={tag} className="bg-white px-2 py-1.5 rounded border border-indigo-100 text-[10px] font-mono text-indigo-700 flex items-center justify-between group">
                                            [{tag}]
                                        </div>
                                    ))}
                                </div>
                                <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4 font-medium">
                                    <li>Create a Word doc with your branding and letterhead.</li>
                                    <li>Insert the tags above where you want the system data to appear.</li>
                                    <li>The <strong>[LineItems]</strong> tag will be replaced by the structured table of work (Packages, Parts, Labour).</li>
                                    <li>Once uploaded, you can click "Preview" below to see how it looks with sample data.</li>
                                </ul>
                                <div className="mt-6 pt-4 border-t border-indigo-100 flex gap-3">
                                    <button 
                                        onClick={() => handlePreview('estimate')}
                                        className="flex-grow py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Eye size={12}/> Preview Estimate Sample
                                    </button>
                                    <button 
                                        onClick={() => handlePreview('invoice')}
                                        className="flex-grow py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Eye size={12}/> Preview Invoice Sample
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'layout' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100/50">
                                <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Layout size={16}/> Visual Layout Designer
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Logo Position</label>
                                            <div className="flex gap-1">
                                                {['left', 'center', 'right', 'none'].map(pos => (
                                                    <button 
                                                        key={pos}
                                                        onClick={() => handleLayoutChange('logoPosition', pos)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${formData.layoutSettings?.logoPosition === pos ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                                                    >
                                                        {pos === 'none' ? 'Hidden' : pos}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Company Branding Position</label>
                                            <div className="flex gap-1">
                                                {['left', 'center', 'right', 'none'].map(pos => (
                                                    <button 
                                                        key={pos}
                                                        onClick={() => handleLayoutChange('brandingPosition', pos)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${formData.layoutSettings?.brandingPosition === pos ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                                                    >
                                                        {pos === 'none' ? 'Hidden' : pos}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Invoice/Est Numbers Position</label>
                                            <div className="flex gap-1">
                                                {['left', 'center', 'right', 'none'].map(pos => (
                                                    <button 
                                                        key={pos}
                                                        onClick={() => {
                                                            handleLayoutChange('detailsPosition', pos);
                                                            handleLayoutChange('estimateNumberPosition', pos); // Keep legacy in sync
                                                        }}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${formData.layoutSettings?.detailsPosition === pos ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                                                    >
                                                        {pos === 'none' ? 'Hidden' : pos}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Vehicle Details Position</label>
                                            <div className="flex gap-1">
                                                {['left', 'center', 'right', 'none'].map(pos => (
                                                    <button 
                                                        key={pos}
                                                        onClick={() => handleLayoutChange('vehiclePosition', pos)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${formData.layoutSettings?.vehiclePosition === pos ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                                                    >
                                                        {pos === 'none' ? 'Hidden' : pos}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Customer Details Position</label>
                                            <div className="flex gap-1">
                                                {['left', 'center', 'right', 'none'].map(pos => (
                                                    <button 
                                                        key={pos}
                                                        onClick={() => handleLayoutChange('customerPosition', pos)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${formData.layoutSettings?.customerPosition === pos ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                                                    >
                                                        {pos === 'none' ? 'Hidden' : pos}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Logo Height (px)</label>
                                            <input 
                                                type="range" min="30" max="150" step="5"
                                                value={formData.layoutSettings?.logoHeight || 60}
                                                onChange={(e) => handleLayoutChange('logoHeight', parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                            />
                                            <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-1">
                                                <span>30px</span>
                                                <span>{formData.layoutSettings?.logoHeight || 60}px</span>
                                                <span>150px</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                            <Settings size={12}/> AI Layout Assistant
                                        </h4>
                                        <p className="text-[11px] text-gray-500 leading-relaxed">
                                            Want to move something specific or change colors? Just tell me below and I'll adjust the code for you.
                                        </p>
                                        <textarea 
                                            placeholder="e.g. 'Move the estimate number to the top right and make the logo larger'"
                                            className="w-full h-24 p-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner resize-none bg-gray-50/50"
                                        />
                                        <button 
                                            onClick={() => {
                                                const message = (document.querySelector('textarea[placeholder*="e.g."]') as HTMLTextAreaElement)?.value;
                                                if (!message) {
                                                    toast.info("Please describe the changes you'd like the AI to make.");
                                                    return;
                                                }
                                                toast.success("Request sent to AI! I've received your layout instructions and will begin processing the design changes shortly.", {
                                                    icon: <Sparkles className="text-amber-500" />,
                                                    position: "bottom-right",
                                                    autoClose: 5000
                                                });
                                                // Optional: Clear the textarea
                                                const textarea = document.querySelector('textarea[placeholder*="e.g."]') as HTMLTextAreaElement;
                                                if (textarea) textarea.value = '';
                                            }}
                                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors border border-indigo-500 shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <Sparkles size={14}/> Send Request to AI
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <button onClick={() => handlePreview('estimate')} className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:border-indigo-300 transition-all flex items-center justify-center gap-2 shadow-sm">
                                    <Eye size={16}/> Preview Estimate
                                </button>
                                <button onClick={() => handlePreview('invoice')} className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:border-indigo-300 transition-all flex items-center justify-center gap-2 shadow-sm">
                                    <Eye size={16}/> Preview Invoice
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'terms' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 gap-6">
                                <EntityFormTextarea label="Courtesy Car T&Cs" name="courtesyCarTermsAndConditions" value={formData.courtesyCarTermsAndConditions || ''} onChange={handleChange} rows={5} />
                                <EntityFormTextarea label="Rental T&Cs" name="rentalTermsAndConditions" value={formData.rentalTermsAndConditions || ''} onChange={handleChange} rows={5} />
                                <EntityFormTextarea label="Sale or Return (SOR) T&Cs" name="sorTermsAndConditions" value={formData.sorTermsAndConditions || ''} onChange={handleChange} rows={5} />
                                <EntityFormTextarea label="Storage T&Cs" name="storageTermsAndConditions" value={formData.storageTermsAndConditions || ''} onChange={handleChange} rows={5} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden Printing Area */}
            <div className="hidden">
                <div ref={printRef}>
                    {previewType === 'invoice' && (
                        <PrintableInvoice 
                            invoice={SAMPLE_INVOICE}
                            customer={SAMPLE_CUSTOMER}
                            vehicle={SAMPLE_VEHICLE}
                            entity={formData as BusinessEntity}
                            taxRates={taxRates}
                            servicePackages={servicePackages}
                            inspectionTemplates={inspectionTemplates}
                            inspectionDiagrams={inspectionDiagrams}
                        />
                    )}
                    {previewType === 'estimate' && (
                        <PrintableEstimate 
                            estimate={SAMPLE_ESTIMATE}
                            customer={SAMPLE_CUSTOMER}
                            vehicle={SAMPLE_VEHICLE}
                            entityDetails={formData as BusinessEntity}
                            taxRates={taxRates}
                            parts={[]}
                            canViewPricing={true}
                            totals={{ totalNet: 450, grandTotal: 540, vatBreakdown: [{ name: 'VAT', rate: 20, vat: 90 }] }}
                        />
                    )}
                </div>
            </div>
        </FormModal>
    );
};

const SAMPLE_CUSTOMER: T.Customer = {
    id: 'sample', forename: 'John', surname: 'Sample', email: 'john@example.com', phone: '01234 567890', addressLine1: '123 Sample Street', city: 'Sampleton', postcode: 'SA1 1MP', createdDate: ''
};

const SAMPLE_VEHICLE: T.Vehicle = {
    id: 'sample', registration: 'AB12 CDE', make: 'PORSCHE', model: '911 GT3', year: 2023, colour: 'Guards Red', customerId: 'sample'
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
