import React, { useState, useEffect } from 'react';
import { Inquiry, User, Customer, Vehicle, Estimate, PurchaseOrder } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { useApp } from '../core/state/AppContext';
import { getCustomerDisplayName, generateCustomerId } from '../core/utils/customerUtils';
import { formatTitleCase } from '../core/utils/formatUtils';
import { 
    Wand2, Loader2, Link as LinkIcon, UserCheck, Car, XCircle, User as UserIcon, 
    FileText, CalendarCheck, Edit, Camera, PlusCircle, Search, ChevronDown, ChevronUp, 
    Copy, Eye, Edit3, Mail, Sparkles, Check, Paperclip, MessageSquare, Phone, MapPin, ExternalLink,
    Clock, Shield, AlertCircle
} from 'lucide-react';
import { parseInquiryMessage, generateEmailReply, updateEstimateWithAI } from '../core/services/geminiService';
import { sendOutboundEmail } from '../core/services/emailService';
import { useData } from '../core/state/DataContext';
import { generateInquiryNumber } from '../core/utils/numberGenerators';
import { toast } from 'react-toastify';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { lookupAddressByPostcode, AddressDetails } from '../services/postcodeLookupService';
import { extractInquiryDetailsFromText, parseEmailThread } from '../core/utils/inquiryUtils';
import { getWheelbaseAlertInfo } from '../core/utils/vehicleUtils';
import { getImage, saveImage } from '../utils/imageStore';

interface InquiryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (inquiry: Inquiry, closeModal?: boolean) => void;
    inquiry: Partial<Inquiry> | null;
    users: User[];
    customers: Customer[];
    vehicles: Vehicle[];
    estimates: Estimate[];
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void; 
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
    updateEstimate?: (estimate: Estimate) => void;
    onAddNewCustomer?: () => void;
    onCreateNewEstimate?: (inquiry: Inquiry) => void;
    onSmartCreateEstimate?: (inquiry: Inquiry, prompt: string) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewVehicle?: (vehicleId: string) => void;
}

// FIXED: Added updateEstimate to the destructuring list below
const InquiryFormModal: React.FC<InquiryFormModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    inquiry, 
    users, 
    customers, 
    vehicles, 
    estimates, 
    onViewEstimate, 
    onScheduleEstimate, 
    onEditEstimate,
    updateEstimate,
    onAddNewCustomer,
    onCreateNewEstimate,
    onSmartCreateEstimate,
    onViewCustomer,
    onViewVehicle
}) => {
    const { currentUser, selectedEntityId, businessEntities: entities } = useApp();
    const { purchaseOrders, inquiries, saveRecord } = useData();
    const [formData, setFormData] = useState<Partial<Inquiry>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');
    const [isUpdatingAI, setIsUpdatingAI] = useState(false);
    const [suggestedCustomers, setSuggestedCustomers] = useState<Customer[]>([]);
    const [suggestedVehicle, setSuggestedVehicle] = useState<Vehicle | null>(null);
    const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
    const [addressList, setAddressList] = useState<AddressDetails[]>([]);
    const [isLookingUpVehicle, setIsLookingUpVehicle] = useState(false);

    // Email Reader state
    const [isFormattedView, setIsFormattedView] = useState(true);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Reply state
    const [replyText, setReplyText] = useState('');
    const [isDraftingReply, setIsDraftingReply] = useState(false);
    const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'communication' | 'estimates'>('details');

    // Split Name states
    const [firstNameInput, setFirstNameInput] = useState('');
    const [surnameInput, setSurnameInput] = useState('');

    const parsedThread = React.useMemo(() => parseEmailThread(formData.message || ''), [formData.message]);

    const copyToClipboard = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
        toast.success(`Copied ${fieldName} to clipboard`);
    };

    const handleQuickReply = async () => {
        setActiveTab('communication');
        if (!replyText && formData.message) {
            setIsDraftingReply(true);
            try {
                const draft = await generateEmailReply(formData.message, 'Brookspeed', formData.actionNotes, formData.logs);
                setReplyText(draft);
            } catch (e) {
                console.error(e);
            } finally {
                setIsDraftingReply(false);
            }
        }
    };

    const handleQuickEstimate = () => {
        if (onSmartCreateEstimate) {
            const fullPrompt = [
                `Customer Name: ${formData.fromName || 'Unknown'}`,
                formData.fromEmail ? `Email: ${formData.fromEmail}` : null,
                formData.fromPhone ? `Phone: ${formData.fromPhone}` : null,
                formData.vehicleRegistration ? `Vehicle Registration: ${formData.vehicleRegistration}` : null,
                (formData.vehicleMake || formData.vehicleModel) ? `Vehicle Make & Model: ${formData.vehicleYear || ''} ${formData.vehicleMake || ''} ${formData.vehicleModel || ''}`.trim() : null,
                `Request Details: ${parsedThread.latestMessage || formData.message || ''}`
            ].filter(Boolean).join('\n');
            onSmartCreateEstimate(formData as Inquiry, fullPrompt);
        } else if (onCreateNewEstimate) {
            onCreateNewEstimate(formData as Inquiry);
        }
    };

    const handleDownloadMedia = async (item: any) => {
        try {
            const win = window.open('about:blank', '_blank');
            const dataUrl = await getImage(item.id);
            if (dataUrl && win) {
                const isPhoto = item.type === 'Photo';
                win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Attachment: ${item.name || 'File'}</title>
                        <style>
                            body { margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #0f172a; min-height: 100vh; font-family: system-ui, sans-serif; }
                            .download-btn { padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-bottom: 24px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
                            .download-btn:hover { background: #4338ca; }
                            img { max-width: 90vw; max-height: 80vh; object-fit: contain; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 8px; }
                            p { color: white; font-size: 1.2rem; }
                        </style>
                    </head>
                    <body>
                        <a href="${dataUrl}" download="${item.name || 'attachment'}" class="download-btn">Download ${item.name || 'File'}</a>
                        ${isPhoto ? `<img src="${dataUrl}" alt="Attachment preview" />` : `<p>This file type cannot be previewed in the browser.</p>`}
                    </body>
                    </html>
                `);
                win.document.close();
            } else {
                win?.close();
                if (!dataUrl) toast.error('Could not retrieve file data.');
            }
        } catch (err) {
            console.error("Error opening media:", err);
        }
    };


    useEffect(() => {
        const parts = (formData.fromName || '').split(' ');
        const derivedFirst = parts[0] || '';
        const derivedSurname = parts.slice(1).join(' ') || '';
        
        const currentLocal = `${firstNameInput} ${surnameInput}`.trim();
        if (currentLocal !== (formData.fromName || '').trim()) {
            setFirstNameInput(derivedFirst);
            setSurnameInput(derivedSurname);
        }
    }, [formData.fromName, firstNameInput, surnameInput]);

    const checkCustomerMatch = (first: string, last: string) => {
        const lowerName = `${first} ${last}`.toLowerCase().trim();
        if (lowerName.length > 2) {
            const searchWords = lowerName.split(/\s+/).filter(w => w.length > 1);
            const matches = customers.filter(c => {
                const fullName = `${c.title || ''} ${c.forename || ''} ${c.surname || ''}`.toLowerCase();
                const company = (c.companyName || '').toLowerCase();
                if (fullName.includes(lowerName) || company.includes(lowerName)) return true;
                if (lowerName.includes(fullName.trim()) && fullName.trim().length > 3) return true;
                if (searchWords.length > 0 && searchWords.every(w => fullName.includes(w))) return true;
                return false;
            });
            if (matches.length > 0 && !formData.linkedCustomerId) {
                setSuggestedCustomers(matches);
            } else {
                setSuggestedCustomers([]);
            }
        } else {
            setSuggestedCustomers([]);
        }
    };

    const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFirstNameInput(val);
        setFormData(p => ({ ...p, fromName: `${val} ${surnameInput}`.trim() }));
        checkCustomerMatch(val, surnameInput);
    };

    const handleSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSurnameInput(val);
        setFormData(p => ({ ...p, fromName: `${firstNameInput} ${val}`.trim() }));
        checkCustomerMatch(firstNameInput, val);
    };

    const checkVehicleMatch = (reg: string) => {
        const cleanReg = reg.toUpperCase().replace(/\s/g, '');
        if (cleanReg.length >= 2) {
            const existingVehicle = vehicles.find(v => v.registration.toUpperCase().replace(/\s/g, '') === cleanReg);
            if (existingVehicle && !formData.linkedVehicleId) {
                setSuggestedVehicle(existingVehicle);
            } else {
                setSuggestedVehicle(null);
            }
        } else {
            setSuggestedVehicle(null);
        }
    };

    const handleLookupAddress = async () => {
        if (!formData.postcode) return;
        setIsLookingUpAddress(true);
        setAddressList([]);
        try {
            const addresses = await lookupAddressByPostcode(formData.postcode);
            setAddressList(addresses);
        } catch (error: any) { 
            toast.warn(error.message === 'NoResultsFound' ? 'No addresses found for this postcode.' : (error.message || 'Failed to lookup address.'));
        } finally { 
            setIsLookingUpAddress(false); 
        }
    };

    const handleAutoCreateCustomer = () => {
        if (!formData.fromName || !formData.fromEmail) {
            toast.error("Need at least a name and email to create a customer.");
            return;
        }

        const names = formData.fromName.split(' ');
        const forename = names[0] || '';
        const surname = names.slice(1).join(' ') || '';

        const newCustomer: Customer = {
            id: generateCustomerId(surname, customers),
            forename,
            surname,
            email: formData.fromEmail,
            phone: formData.fromPhone || '',
            mobile: formData.fromPhone || '',
            addressLine1: formData.addressLine1 || '',
            addressLine2: formData.addressLine2 || '',
            city: formData.city || '',
            county: formData.county || '',
            postcode: formData.postcode || '',
            category: 'Retail',
            isBusinessCustomer: false,
            createdDate: new Date().toISOString(),
            marketingConsent: false,
            serviceReminderConsent: false,
            declinedCommunication: false,
            communicationPreference: 'None'
        };

        saveRecord('customers', newCustomer);
        
        let newVehicleId = null;
        if (formData.vehicleRegistration) {
            newVehicleId = crypto.randomUUID();
            const newVehicle: Vehicle = {
                id: newVehicleId,
                registration: (formData.vehicleRegistration || '').toUpperCase().trim(),
                make: formatTitleCase(formData.vehicleMake || ''),
                model: formatTitleCase(formData.vehicleModel || ''),
                year: formData.vehicleYear ? parseInt(formData.vehicleYear) : undefined,
                manufactureDate: formData.vehicleManufactureDate || undefined,
                vin: formData.vehicleVin || undefined,
                nextMotDate: formData.vehicleMotExpiry || undefined,
                motExpiryDate: formData.vehicleMotExpiry || undefined,
                customerId: newCustomer.id,
            };
            saveRecord('vehicles', newVehicle);
        }

        setFormData(p => ({
            ...p,
            linkedCustomerId: newCustomer.id,
            linkedVehicleId: newVehicleId || p.linkedVehicleId,
            vehicleRegistration: p.vehicleRegistration ? p.vehicleRegistration.toUpperCase().trim() : p.vehicleRegistration,
            vehicleMake: formatTitleCase(p.vehicleMake || ''),
            vehicleModel: formatTitleCase(p.vehicleModel || ''),
        }));

        toast.success("Customer and Vehicle automatically created and linked!");
    };

    const handleLookupVehicle = async () => {
        if (!formData.vehicleRegistration) return;
        setIsLookingUpVehicle(true);
        try {
            const data = await lookupVehicleByVRM(formData.vehicleRegistration);
            if (data && data.make) {
                const make = formatTitleCase(data.make || '');
                const model = formatTitleCase(data.model || '');
                const year = data.year?.toString() || '';
                const reg = (data.registration || formData.vehicleRegistration || '').toUpperCase().trim();
                const vin = data.vin || '';
                const nextMotDate = data.nextMotDate || '';
                const manufactureDate = data.manufactureDate || '';

                setFormData(p => ({
                    ...p,
                    vehicleMake: make || p.vehicleMake,
                    vehicleModel: model || p.vehicleModel,
                    vehicleYear: year || p.vehicleYear,
                    vehicleRegistration: reg,
                    vehicleVin: vin || p.vehicleVin,
                    vehicleMotExpiry: nextMotDate || p.vehicleMotExpiry,
                    vehicleManufactureDate: manufactureDate || p.vehicleManufactureDate,
                }));

                // Also update the linked vehicle record if one exists
                if (formData.linkedVehicleId) {
                    const linkedVehicle = vehicles.find(v => v.id === formData.linkedVehicleId);
                    if (linkedVehicle) {
                        saveRecord('vehicles', {
                            ...linkedVehicle,
                            make: make || linkedVehicle.make,
                            model: model || linkedVehicle.model,
                            year: year ? parseInt(year) : linkedVehicle.year,
                            manufactureDate: manufactureDate || linkedVehicle.manufactureDate,
                            vin: vin || linkedVehicle.vin,
                            wheelbaseType: data.wheelbaseType || linkedVehicle.wheelbaseType,
                            nextMotDate: nextMotDate || linkedVehicle.nextMotDate,
                            motExpiryDate: nextMotDate || linkedVehicle.motExpiryDate || linkedVehicle.nextMotDate,
                            colour: data.colour || linkedVehicle.colour,
                        });
                    }
                }

                toast.success('Vehicle details found via DVLA');
            } else {
                toast.warn('Vehicle found but no make/model returned.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to lookup vehicle');
        } finally {
            setIsLookingUpVehicle(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        setFormData(prev => {
            if (inquiry && inquiry.id) {
                // Prevent background sync from overwriting local changes if we're already editing this inquiry
                if (prev && prev.id === inquiry.id) return prev;
                const linkedCustomer = inquiry.linkedCustomerId ? customers.find(c => c.id === inquiry.linkedCustomerId) : null;
                const linkedVehicle = inquiry.linkedVehicleId ? vehicles.find(v => v.id === inquiry.linkedVehicleId) : null;
                const extracted = extractInquiryDetailsFromText(inquiry.subject, inquiry.message);
                return { 
                    ...inquiry,
                    fromName: inquiry.fromName || extracted.fromName || (linkedCustomer ? getCustomerDisplayName(linkedCustomer) : ''),
                    fromEmail: inquiry.fromEmail || linkedCustomer?.email || '',
                    fromPhone: inquiry.fromPhone || linkedCustomer?.mobile || linkedCustomer?.phone || '',
                    addressLine1: inquiry.addressLine1 || linkedCustomer?.addressLine1 || '',
                    addressLine2: inquiry.addressLine2 || linkedCustomer?.addressLine2 || '',
                    city: inquiry.city || linkedCustomer?.city || '',
                    county: inquiry.county || linkedCustomer?.county || '',
                    postcode: inquiry.postcode || extracted.postcode || linkedCustomer?.postcode || '',
                    vehicleMake: inquiry.vehicleMake || extracted.vehicleMake || linkedVehicle?.make || '',
                    vehicleModel: inquiry.vehicleModel || extracted.vehicleModel || linkedVehicle?.model || '',
                    vehicleRegistration: inquiry.vehicleRegistration || extracted.vehicleRegistration || linkedVehicle?.registration || '',
                    vehicleYear: inquiry.vehicleYear || linkedVehicle?.year?.toString() || '',
                    vehicleVin: inquiry.vehicleVin || linkedVehicle?.vin || '',
                    vehicleMotExpiry: inquiry.vehicleMotExpiry || linkedVehicle?.nextMotDate || linkedVehicle?.motExpiryDate || '',
                    vehicleManufactureDate: inquiry.vehicleManufactureDate || linkedVehicle?.manufactureDate || ''
                };
            } else {
                // Initialize a new inquiry, using any pre-filled data provided.
                // Returning a completely fresh object guarantees that linkedCustomerId
                // and linkedVehicleId from a previously-viewed inquiry can never
                // carry forward into a new one.
                return {
                    entityId: inquiry?.entityId || (selectedEntityId === 'all' ? (entities && entities.length > 0 ? entities[0].id : '') : selectedEntityId),
                    fromName: inquiry?.fromName || '',
                    fromContact: inquiry?.fromContact || '',
                    fromEmail: inquiry?.fromEmail || '',
                    fromPhone: inquiry?.fromPhone || '',
                    message: inquiry?.message || '',
                    status: inquiry?.status || 'Inbox',
                    isUrgent: inquiry?.isUrgent || false,
                    actionNotes: inquiry?.actionNotes || '',
                    takenByUserId: currentUser.id,
                    assignedToUserId: '',
                    assignedToEntityId: '',
                    logs: [{
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        userId: currentUser.id,
                        actionType: 'Created',
                        notes: 'Inquiry initialized'
                    }],
                    linkedCustomerId: inquiry?.linkedCustomerId || null,
                    linkedVehicleId: inquiry?.linkedVehicleId || null,
                    linkedEstimateId: inquiry?.linkedEstimateId || null,
                };
            }
        });
        
        if (inquiry && inquiry.id && inquiry.hasNewReply) {
            saveRecord('inquiries', { ...inquiry, hasNewReply: false } as Inquiry);
        }
        
        // Always explicitly reset all auxiliary/local state so that no stale values
        // bleed through when the modal is re-opened or switched to a different inquiry
        // while still mounted (e.g. the modal stays open and the inquiry prop changes).
        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomers([]);
        setSuggestedVehicle(null);
        setAddressList([]);
        setReplyText('');
        setReplyAttachments([]);
        setIsDraftingReply(false);
        setIsSendingReply(false);

        // Reset split-name inputs directly from the incoming inquiry so they
        // cannot retain a previously typed name across sessions.
        const incomingName = (inquiry?.fromName || '').trim();
        const nameParts = incomingName.split(' ');
        setFirstNameInput(nameParts[0] || '');
        setSurnameInput(nameParts.slice(1).join(' ') || '');

        if (inquiry && inquiry.logs && inquiry.logs.some(l => l.actionType === 'Email Sent')) {
            setActiveTab('estimates');
        } else {
            setActiveTab('details');
        }
    }, [isOpen, inquiry, selectedEntityId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'vehicleRegistration') {
            checkVehicleMatch(value);
        }

        setFormData(p => {
            const val = name === 'vehicleRegistration' ? value.toUpperCase() : value;
            const nextData = { ...p, [name]: val };

            if (name === 'subject') {
                const extracted = extractInquiryDetailsFromText(value, p.message);
                if (extracted.vehicleRegistration && !p.vehicleRegistration) {
                    nextData.vehicleRegistration = extracted.vehicleRegistration;
                    checkVehicleMatch(extracted.vehicleRegistration);
                }
                if (extracted.fromName && !p.fromName) {
                    nextData.fromName = extracted.fromName;
                }
                if (extracted.vehicleMake && !p.vehicleMake) {
                    nextData.vehicleMake = extracted.vehicleMake;
                }
                if (extracted.vehicleModel && !p.vehicleModel) {
                    nextData.vehicleModel = extracted.vehicleModel;
                }
                if (extracted.postcode && !p.postcode) {
                    nextData.postcode = extracted.postcode;
                }
            }

            if (name === 'fromName' && value.length > 2) {
                const lowerName = value.toLowerCase().trim();
                const existingCustomer = customers.find(c => 
                    getCustomerDisplayName(c).toLowerCase() === lowerName || 
                    (c.companyName || '').toLowerCase() === lowerName
                );

                if (existingCustomer && !p.linkedCustomerId) {
                    nextData.linkedCustomerId = existingCustomer.id;
                    nextData.fromEmail = existingCustomer.email || nextData.fromEmail || '';
                    nextData.fromPhone = existingCustomer.mobile || existingCustomer.phone || nextData.fromPhone || '';
                    nextData.addressLine1 = existingCustomer.addressLine1 || nextData.addressLine1 || '';
                    nextData.addressLine2 = existingCustomer.addressLine2 || nextData.addressLine2 || '';
                    nextData.city = existingCustomer.city || nextData.city || '';
                    nextData.county = existingCustomer.county || nextData.county || '';
                    nextData.postcode = existingCustomer.postcode || nextData.postcode || '';
                    // Also clear suggested customer since we auto-linked
                    setSuggestedCustomers([]);
                }
            }

            if (name === 'status' && value === 'Waiting on Customer') {
                const fDate = new Date();
                fDate.setDate(fDate.getDate() + 3);
                nextData.followUpDate = fDate.toISOString().split('T')[0];
            }

            return nextData;
        });
    };

    const handleAIUpdateEstimate = async (linkedEstimate: Estimate) => {
        if (!updateEstimate) {
            toast.error("Estimate updating is not available here.");
            return;
        }
        
        try {
            setIsUpdatingAI(true);
            const newItems = await updateEstimateWithAI(linkedEstimate.lineItems || [], formData.message || '', formData.logs || [], formData.actionNotes);
            const subtotal = newItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
            const vat = subtotal * 0.20; // 20% VAT
            const totalAmount = subtotal + vat;
            
            const updatedEstimate = {
                ...linkedEstimate,
                lineItems: newItems,
                subtotal,
                vat,
                totalAmount
            };
            
            updateEstimate(updatedEstimate);
            toast.success("Estimate updated via AI!");
        } catch (err: any) {
            console.error("AI Update failed:", err);
            toast.error(err.message || "Failed to update estimate via AI");
        } finally {
            setIsUpdatingAI(false);
        }
    };

    const handleSave = () => {
        if (!formData.fromName || !formData.message) {
            toast.error('"From" name and message are required.');
            return;
        }

        let updatedLogs = formData.logs || [];
        let updatedFollowUpDate = formData.followUpDate;

        if (inquiry) {
            if (formData.actionNotes !== inquiry.actionNotes) {
                const newLog = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id,
                    actionType: 'Notes Updated',
                    notes: `Action Notes updated.`
                };
                updatedLogs = [...updatedLogs, newLog];
            }
            
            if (formData.status !== inquiry.status) {
                const newLog = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id,
                    actionType: 'Status Update',
                    notes: `Status changed from ${inquiry.status} to ${formData.status}.`
                };
                updatedLogs = [...updatedLogs, newLog];
                
                if (formData.status === 'Waiting on Customer') {
                    const fDate = new Date();
                    fDate.setDate(fDate.getDate() + 3);
                    updatedFollowUpDate = fDate.toISOString().split('T')[0];
                }
            }
        }

        const inquiryToSave: Inquiry = {
            id: formData.id || crypto.randomUUID(),
            createdAt: formData.createdAt || new Date().toISOString(),
            takenByUserId: formData.takenByUserId || currentUser.id,
            inquiryNumber: formData.inquiryNumber || generateInquiryNumber(inquiries),
            ...formData,
            logs: updatedLogs,
            followUpDate: updatedFollowUpDate,
            hasNewReply: false
        } as Inquiry;
        
        if (formData.linkedCustomerId) {
            const existingCustomer = customers.find(c => c.id === formData.linkedCustomerId);
            if (existingCustomer) {
                const updatedCustomer: Customer = {
                    ...existingCustomer,
                    addressLine1: existingCustomer.addressLine1 || formData.addressLine1 || '',
                    addressLine2: existingCustomer.addressLine2 || formData.addressLine2 || '',
                    city: existingCustomer.city || formData.city || '',
                    county: existingCustomer.county || formData.county || '',
                    postcode: existingCustomer.postcode || formData.postcode || '',
                    email: existingCustomer.email || formData.fromEmail || '',
                    phone: existingCustomer.phone || formData.fromPhone || '',
                    mobile: existingCustomer.mobile || formData.fromPhone || '',
                };
                if (
                    updatedCustomer.addressLine1 !== existingCustomer.addressLine1 ||
                    updatedCustomer.addressLine2 !== existingCustomer.addressLine2 ||
                    updatedCustomer.city !== existingCustomer.city ||
                    updatedCustomer.county !== existingCustomer.county ||
                    updatedCustomer.postcode !== existingCustomer.postcode ||
                    updatedCustomer.email !== existingCustomer.email ||
                    updatedCustomer.phone !== existingCustomer.phone ||
                    updatedCustomer.mobile !== existingCustomer.mobile
                ) {
                    saveRecord('customers', updatedCustomer);
                }
            }
        }

        onSave(inquiryToSave, true);

        // TRIGGER AI NEXT STEP SUGGESTION
        const isStatusChanged = !inquiry || formData.status !== inquiry.status || formData.actionStatus !== inquiry.actionStatus;
        if (isStatusChanged) {
            import('../core/services/geminiService').then(({ generateNextStepSuggestion }) => {
                generateNextStepSuggestion(inquiryToSave).then(suggestion => {
                    const updatedInquiry = { ...inquiryToSave, aiNextStepSuggestion: suggestion };
                    onSave(updatedInquiry, false);
                }).catch(err => console.error("Failed to generate AI next step suggestion:", err));
            });
        }
    };


    const handleLinkCustomer = (customer: Customer) => {
        const updatedCustomer: Customer = {
            ...customer,
            addressLine1: customer.addressLine1 || formData.addressLine1 || '',
            addressLine2: customer.addressLine2 || formData.addressLine2 || '',
            city: customer.city || formData.city || '',
            county: customer.county || formData.county || '',
            postcode: customer.postcode || formData.postcode || '',
            email: customer.email || formData.fromEmail || '',
            phone: customer.phone || formData.fromPhone || '',
        };
        if (
            updatedCustomer.addressLine1 !== customer.addressLine1 ||
            updatedCustomer.addressLine2 !== customer.addressLine2 ||
            updatedCustomer.city !== customer.city ||
            updatedCustomer.county !== customer.county ||
            updatedCustomer.postcode !== customer.postcode ||
            updatedCustomer.email !== customer.email ||
            updatedCustomer.phone !== customer.phone
        ) {
            saveRecord('customers', updatedCustomer);
        }

        setFormData(p => ({ 
            ...p, 
            linkedCustomerId: customer.id,
            fromEmail: updatedCustomer.email || p.fromEmail || '',
            fromPhone: updatedCustomer.mobile || updatedCustomer.phone || p.fromPhone || '',
            addressLine1: updatedCustomer.addressLine1 || p.addressLine1 || '',
            addressLine2: updatedCustomer.addressLine2 || p.addressLine2 || '',
            city: updatedCustomer.city || p.city || '',
            county: updatedCustomer.county || p.county || '',
            postcode: updatedCustomer.postcode || p.postcode || ''
        }));
        setSuggestedCustomers([]);
    };

    const handleLinkVehicle = (vehicle: Vehicle) => {
        setFormData(p => ({ 
            ...p, 
            linkedVehicleId: vehicle.id,
            vehicleMake: vehicle.make ? formatTitleCase(vehicle.make) : p.vehicleMake,
            vehicleModel: vehicle.model ? formatTitleCase(vehicle.model) : p.vehicleModel,
            vehicleRegistration: (vehicle.registration || p.vehicleRegistration || '').toUpperCase().trim(),
            vehicleYear: vehicle.year?.toString() || p.vehicleYear,
            vehicleVin: vehicle.vin || p.vehicleVin,
            vehicleMotExpiry: vehicle.nextMotDate || vehicle.motExpiryDate || p.vehicleMotExpiry,
            vehicleManufactureDate: vehicle.manufactureDate || p.vehicleManufactureDate
        }));
        setSuggestedVehicle(null);
    };

    const handleUnlinkCustomer = () => {
        setFormData(p => ({ ...p, linkedCustomerId: null }));
    };
    
    const handleUnlinkVehicle = () => {
        setFormData(p => ({ ...p, linkedVehicleId: null }));
    };

    const linkedCustomer = customers.find(c => c.id === formData.linkedCustomerId);
    const customerVehicles = formData.linkedCustomerId ? vehicles.filter(v => v.customerId === formData.linkedCustomerId) : [];
    const linkedVehicle = vehicles.find(v => v.id === formData.linkedVehicleId);
    const linkedEstimate = formData.linkedEstimateId ? estimates.find(e => e.id === formData.linkedEstimateId) : null;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            title={formData.inquiryNumber ? `Edit Inquiry / Message [${formData.inquiryNumber}]` : inquiry?.id ? 'Edit Inquiry / Message' : 'Log New Inquiry / Message'}
            maxWidth="max-w-[95vw] lg:max-w-[96vw] xl:max-w-[1550px]"
        >
            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`${activeTab === 'details' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Initial Email & Details
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('estimates')}
                        className={`${activeTab === 'estimates' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Estimates
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('communication')}
                        className={`${activeTab === 'communication' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Communication, Notes & Logs
                    </button>
                </nav>
            </div>
            <div className="min-h-[500px]">
                {activeTab === 'details' && (
                    <div className="space-y-4">
                        {/* High-Visibility Pale Blue Header Banner */}
                        <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-5 shadow-xs">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div className="space-y-1.5 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-mono font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 shadow-2xs">
                                            <Mail size={13} className="text-indigo-600" /> {formData.inquiryNumber || 'NEW INQUIRY'}
                                        </span>
                                        {formData.isUrgent && (
                                            <span className="text-xs font-bold bg-red-600 text-white px-2.5 py-0.5 rounded-md animate-pulse flex items-center gap-1">
                                                <AlertCircle size={13} /> URGENT
                                            </span>
                                        )}
                                        <span className="text-xs font-semibold bg-white text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                                            {entities?.find(e => e.id === formData.entityId)?.name || 'All Entities'}
                                        </span>
                                        <span className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                                            {formData.status || 'Inbox'}
                                        </span>
                                        {formData.actionStatus && (
                                            <span className="text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300 px-2.5 py-0.5 rounded-md">
                                                {formData.actionStatus}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Prominent Customer Name */}
                                    <div className="flex flex-wrap items-baseline gap-3 pt-0.5">
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                            {formData.fromName || 'Unknown Customer'}
                                        </h2>
                                        {formData.vehicleRegistration && (
                                            <span className="inline-block bg-yellow-400 text-black font-mono font-black text-xs px-2.5 py-0.5 rounded border border-yellow-500 shadow-2xs tracking-wider uppercase">
                                                {formData.vehicleRegistration}
                                            </span>
                                        )}
                                    </div>

                                    {/* Large, Clear Phone and Email Information */}
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm pt-0.5">
                                        {formData.fromPhone ? (
                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                                                <Phone size={15} className="text-indigo-600 shrink-0" />
                                                <a 
                                                    href={`tel:${formData.fromPhone}`} 
                                                    className="font-bold text-sm sm:text-base text-slate-900 hover:text-indigo-600 transition tracking-wide"
                                                    title="Click to call"
                                                >
                                                    {formData.fromPhone}
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(formData.fromPhone!, 'phone number')}
                                                    className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
                                                    title="Copy phone number"
                                                >
                                                    {copiedField === 'phone number' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs italic">
                                                <Phone size={13} /> No phone provided
                                            </div>
                                        )}

                                        {formData.fromEmail ? (
                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                                                <Mail size={15} className="text-indigo-600 shrink-0" />
                                                <a 
                                                    href={`mailto:${formData.fromEmail}`} 
                                                    className="font-semibold text-sm text-indigo-700 hover:text-indigo-900 transition underline"
                                                    title="Click to email"
                                                >
                                                    {formData.fromEmail}
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(formData.fromEmail!, 'email address')}
                                                    className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
                                                    title="Copy email address"
                                                >
                                                    {copiedField === 'email address' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs italic">
                                                <Mail size={13} /> No email provided
                                            </div>
                                        )}

                                        {formData.createdAt && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Clock size={13} />
                                                <span>{new Date(formData.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                            </div>
                                        )}
                                    </div>

                                    {formData.subject && (
                                        <p className="text-xs sm:text-sm text-slate-700 font-medium pt-0.5">
                                            <span className="text-slate-500 font-normal">Subject:</span> {formData.subject}
                                        </p>
                                    )}
                                </div>

                                {/* View Mode Toggle */}
                                <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                                    <div className="bg-white p-1 rounded-lg border border-blue-200 flex items-center shadow-2xs">
                                        <button
                                            type="button"
                                            onClick={() => setIsFormattedView(true)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${isFormattedView ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            <Eye size={14} /> Reader View
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsFormattedView(false)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${!isFormattedView ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            <Edit3 size={14} /> Raw Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3-Column Wide Layout: (1) Email Reader (5 cols) | (2) Contact & Vehicle Intelligence (4 cols) | (3) Fast Actions & Operations (3 cols) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                            {/* Column 1 (5 cols): The Email Body & Thread Viewer */}
                            <div className="lg:col-span-5 space-y-4">
                                {isFormattedView ? (
                                    <div className="space-y-4">
                                        {/* Latest Customer Message Card */}
                                        <div className="bg-white rounded-xl border border-indigo-100 shadow-xs overflow-hidden">
                                            <div className="bg-gradient-to-r from-indigo-50/90 to-white px-4 py-2.5 border-b border-indigo-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                                        <MessageSquare size={15} className="text-indigo-600" />
                                                        Customer Message
                                                    </h4>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={async () => {
                                                        if (!formData.message && !formData.subject) return;
                                                        setIsAnalyzing(true);
                                                        setAiError('');
                                                        try {
                                                            const parsed = await parseInquiryMessage(formData.message || '', formData.subject);
                                                            
                                                            setFormData(p => {
                                                                const newName = parsed.fromName || p.fromName || '';
                                                                const newEmail = parsed.fromEmail || p.fromEmail || '';
                                                                let nextLinkedCustomerId = p.linkedCustomerId;

                                                                if (nextLinkedCustomerId) {
                                                                    const linkedCust = customers.find(c => c.id === nextLinkedCustomerId);
                                                                    if (linkedCust) {
                                                                        const linkedName = getCustomerDisplayName(linkedCust).toLowerCase();
                                                                        if ((parsed.fromEmail && linkedCust.email?.toLowerCase() !== parsed.fromEmail.toLowerCase()) || 
                                                                            (parsed.fromName && linkedName !== parsed.fromName.toLowerCase())) {
                                                                            nextLinkedCustomerId = null;
                                                                        }
                                                                    }
                                                                }

                                                                return {
                                                                    ...p,
                                                                    linkedCustomerId: nextLinkedCustomerId,
                                                                    fromName: newName,
                                                                    fromEmail: newEmail,
                                                                    fromPhone: parsed.fromPhone || p.fromPhone || '',
                                                                    vehicleRegistration: parsed.vehicleRegistration
                                                                        ? parsed.vehicleRegistration.toUpperCase().trim()
                                                                        : p.vehicleRegistration ? p.vehicleRegistration.toUpperCase().trim() : '',
                                                                    vehicleMake: parsed.vehicleMake ? formatTitleCase(parsed.vehicleMake) : (p.vehicleMake ? formatTitleCase(p.vehicleMake) : ''),
                                                                    vehicleModel: parsed.vehicleModel ? formatTitleCase(parsed.vehicleModel) : (p.vehicleModel ? formatTitleCase(p.vehicleModel) : ''),
                                                                    postcode: parsed.postcode ? parsed.postcode.toUpperCase().trim() : (p.postcode || ''),
                                                                };
                                                            });

                                                            if (parsed.fromEmail || parsed.fromPhone || parsed.fromName) {
                                                                const lowerEmail = (parsed.fromEmail || '').toLowerCase();
                                                                const lowerPhone = (parsed.fromPhone || '').replace(/\D/g,'');
                                                                const lowerName = (parsed.fromName || '').toLowerCase();
                                                                const searchWords = lowerName.split(/\s+/).filter(w => w.length > 1);
                                                                
                                                                const matches = customers.filter(c => {
                                                                    if (lowerEmail && c.email?.toLowerCase() === lowerEmail) return true;
                                                                    if (lowerPhone && (c.phone?.replace(/\D/g,'') === lowerPhone || c.mobile?.replace(/\D/g,'') === lowerPhone)) return true;
                                                                    
                                                                    if (lowerName) {
                                                                        const fullName = `${c.title || ''} ${c.forename || ''} ${c.surname || ''}`.toLowerCase();
                                                                        const company = (c.companyName || '').toLowerCase();
                                                                        if (fullName.includes(lowerName) || company.includes(lowerName)) return true;
                                                                        if (lowerName.includes(fullName.trim()) && fullName.trim().length > 3) return true;
                                                                        if (searchWords.length > 0 && searchWords.every(w => fullName.includes(w))) return true;
                                                                    }
                                                                    return false;
                                                                });
                                                                if (matches.length > 0) setSuggestedCustomers(matches);
                                                            }

                                                            if (parsed.vehicleRegistration) {
                                                                const lowerReg = parsed.vehicleRegistration.toLowerCase().replace(/\s/g, '');
                                                                const foundVeh = vehicles.find(v => v.registration?.toLowerCase().replace(/\s/g, '') === lowerReg);
                                                                if (foundVeh) setSuggestedVehicle(foundVeh);
                                                            }

                                                            const aiLogNotes = parsed.summary 
                                                                ? `AI Summary: ${parsed.summary}` 
                                                                : `AI Scan Completed (No summary provided). Data: ${JSON.stringify(parsed)}`;
                                                            
                                                            const newLog = {
                                                                id: crypto.randomUUID(),
                                                                timestamp: new Date().toISOString(),
                                                                userId: currentUser.id,
                                                                actionType: 'AI Scan',
                                                                notes: aiLogNotes
                                                            };
                                                            setFormData(p => ({ ...p, logs: [...(p.logs || []), newLog] }));
                                                            toast.success('Inquiry scanned with AI');
                                                        } catch (e) {
                                                            console.error(e);
                                                            setAiError('Failed to parse message with AI.');
                                                            toast.error('Failed to parse message with AI.');
                                                        } finally {
                                                            setIsAnalyzing(false);
                                                        }
                                                    }}
                                                    disabled={isAnalyzing || (!formData.message && !formData.subject)}
                                                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md shadow-2xs transition disabled:opacity-50 cursor-pointer"
                                                    title="Scan with AI to extract VRM, Customer and Summary"
                                                >
                                                    {isAnalyzing ? <Loader2 size={13} className="animate-spin text-indigo-600" /> : <Wand2 size={13} className="text-indigo-600" />} 
                                                    Scan AI
                                                </button>
                                            </div>

                                            <div className="p-4 sm:p-5">
                                                {parsedThread.latestMessage ? (
                                                    <div className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-sans selection:bg-indigo-100 max-h-[380px] overflow-y-auto pr-1">
                                                        {parsedThread.latestMessage}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic">
                                                        No message body captured.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* AI Summary / Insights Banner if present */}
                                        {formData.actionNotes && (
                                            <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs sm:text-sm text-purple-900 shadow-2xs space-y-1">
                                                <div className="flex items-center gap-1.5 font-bold text-purple-800 uppercase tracking-wider text-xs">
                                                    <Sparkles size={14} className="text-purple-600" />
                                                    AI Insights & Classification
                                                </div>
                                                <div className="whitespace-pre-wrap leading-relaxed text-purple-950 font-medium text-xs">
                                                    {formData.actionNotes}
                                                </div>
                                            </div>
                                        )}

                                        {/* Attachments Strip */}
                                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3.5 space-y-2.5">
                                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Paperclip size={14} className="text-gray-600" />
                                                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                                        Attachments ({formData.media ? formData.media.length : 0})
                                                    </span>
                                                </div>
                                                <label className="cursor-pointer text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition flex items-center gap-1 border border-indigo-200 shadow-2xs">
                                                    <PlusCircle size={13} /> Add
                                                    <input 
                                                        type="file" 
                                                        multiple 
                                                        className="hidden" 
                                                        onChange={async (e) => {
                                                            if (e.target.files && e.target.files.length > 0) {
                                                                const newMedia = [];
                                                                for (const file of e.target.files) {
                                                                    const isImage = file.type.startsWith('image/');
                                                                    const mediaItem = {
                                                                        id: crypto.randomUUID(),
                                                                        type: isImage ? 'Photo' : 'Document',
                                                                        name: file.name,
                                                                        uploadedAt: new Date().toISOString()
                                                                    };
                                                                    await saveImage(mediaItem.id, file);
                                                                    newMedia.push(mediaItem);
                                                                }
                                                                setFormData(p => ({ ...p, media: [...(p.media || []), ...newMedia] }));
                                                                toast.success(`Added ${newMedia.length} attachment(s)`);
                                                            }
                                                            e.target.value = '';
                                                        }} 
                                                    />
                                                </label>
                                            </div>

                                            {formData.media && formData.media.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {formData.media.map((item: any) => {
                                                        const isPhoto = item.type === 'Photo' || (item.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(item.name));
                                                        return (
                                                            <div 
                                                                key={item.id} 
                                                                onClick={() => handleDownloadMedia(item)}
                                                                className="group relative flex items-center gap-2 p-2 border border-gray-200 hover:border-indigo-300 rounded-lg bg-gray-50 hover:bg-indigo-50/50 cursor-pointer transition shadow-2xs"
                                                                title={`Click to view/download ${item.name}`}
                                                            >
                                                                <div className="p-1.5 bg-white rounded-md border border-gray-200 text-indigo-600 shrink-0 group-hover:scale-105 transition">
                                                                    {isPhoto ? <Camera size={16} /> : <FileText size={16} />}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate text-xs font-bold text-gray-800 group-hover:text-indigo-700">
                                                                        {item.name}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-500 uppercase font-semibold">
                                                                        {isPhoto ? 'Photo' : 'Doc'}
                                                                    </div>
                                                                </div>
                                                                <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-gray-400 text-xs py-2 text-center border border-dashed border-gray-200 rounded-lg">
                                                    No attachments attached.
                                                </div>
                                            )}
                                        </div>

                                        {/* Historical Thread Accordion (Collapsible) */}
                                        {parsedThread.hasThread && (
                                            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsHistoryExpanded(prev => !prev)}
                                                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left cursor-pointer border-b border-gray-200/60"
                                                >
                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                        <Clock size={14} className="text-gray-500" />
                                                        <span>Email History ({parsedThread.threadHistory.length} earlier {parsedThread.threadHistory.length === 1 ? 'message' : 'messages'})</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold">
                                                        <span>{isHistoryExpanded ? 'Collapse' : 'Expand'}</span>
                                                        {isHistoryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                    </div>
                                                </button>

                                                {isHistoryExpanded && (
                                                    <div className="p-3 space-y-3 bg-gray-50/50 max-h-[300px] overflow-y-auto">
                                                        {parsedThread.threadHistory.map((threadMsg, idx) => (
                                                            <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-1.5">
                                                                {threadMsg.header && (
                                                                    <div className="text-[11px] font-mono text-gray-600 bg-gray-100 p-1.5 rounded border border-gray-200 whitespace-pre-wrap leading-tight">
                                                                        {threadMsg.header}
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                                    {threadMsg.body}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Raw Edit Mode */
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                                                Raw Email Subject & Message Body
                                            </label>
                                            <button 
                                                type="button" 
                                                onClick={async () => {
                                                    if (!formData.message && !formData.subject) return;
                                                    setIsAnalyzing(true);
                                                    try {
                                                        const parsed = await parseInquiryMessage(formData.message || '', formData.subject);
                                                        toast.success('Inquiry scanned with AI');
                                                    } catch (e) {
                                                        toast.error('Failed to parse message with AI.');
                                                    } finally {
                                                        setIsAnalyzing(false);
                                                    }
                                                }}
                                                disabled={isAnalyzing}
                                                className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded hover:bg-indigo-100 border border-indigo-200 transition"
                                            >
                                                {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} 
                                                Scan with AI
                                            </button>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Subject Line</label>
                                            <input 
                                                type="text" 
                                                name="subject" 
                                                value={formData.subject || ''} 
                                                onChange={handleChange} 
                                                className="w-full p-2 border rounded-md text-sm font-medium" 
                                                placeholder="e.g. Service Inquiry for Porsche 911"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Message Content*</label>
                                            <textarea 
                                                name="message" 
                                                value={formData.message || ''} 
                                                onChange={handleChange} 
                                                rows={18} 
                                                className="w-full p-3 border rounded-md text-sm font-mono leading-relaxed" 
                                                required 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Column 2 (4 cols): Customer Contact & Vehicle Dossier with DVLA and Address Search */}
                            <div className="lg:col-span-4 space-y-4">
                                {/* AI Suggestions Banner if matches found */}
                                {(suggestedCustomers.length > 0 || suggestedVehicle || aiError) && (
                                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 animate-fade-in shadow-2xs">
                                        <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                                            <Wand2 size={14} className="text-indigo-600"/> Auto-Match Suggestions
                                        </h4>
                                        {aiError && <p className="text-red-600 text-xs">{aiError}</p>}
                                        
                                        {suggestedCustomers.length > 0 && !formData.linkedCustomerId && (
                                            <div className="flex flex-col gap-1.5">
                                                {suggestedCustomers.map(cust => (
                                                    <div key={cust.id} className="flex justify-between items-center text-xs p-2 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <UserIcon size={14} className="text-blue-500 shrink-0" />
                                                            <span className="font-bold text-gray-800 truncate">{getCustomerDisplayName(cust)}</span>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleLinkCustomer(cust)} 
                                                            className="flex items-center gap-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-2xs transition shrink-0 cursor-pointer text-xs"
                                                        >
                                                            <LinkIcon size={12}/> Link
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {suggestedVehicle && !formData.linkedVehicleId && (
                                            <div className="flex justify-between items-center text-xs p-2 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <Car size={14} className="text-emerald-500 shrink-0" />
                                                    <span className="font-black text-gray-900 uppercase font-mono">{suggestedVehicle.registration}</span>
                                                    <span className="text-gray-600 truncate">({suggestedVehicle.make} {suggestedVehicle.model})</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleLinkVehicle(suggestedVehicle)} 
                                                    className="flex items-center gap-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-2xs transition shrink-0 cursor-pointer text-xs"
                                                >
                                                    <LinkIcon size={12}/> Link
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Customer Connection & Contact Card */}
                                <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xs space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <UserCheck size={16} className="text-indigo-600" />
                                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                                                Customer Contact
                                            </h3>
                                        </div>
                                        {linkedCustomer && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                    Linked
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={handleUnlinkCustomer} 
                                                    title="Unlink Customer" 
                                                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold transition cursor-pointer"
                                                >
                                                    <XCircle size={13} /> Unlink
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Contact Fields */}
                                    <div className="space-y-2.5">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">First Name*</label>
                                                <input 
                                                    value={firstNameInput} 
                                                    onChange={handleFirstNameChange} 
                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition" 
                                                    required 
                                                    placeholder="First name" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Surname</label>
                                                <input 
                                                    value={surnameInput} 
                                                    onChange={handleSurnameChange} 
                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition" 
                                                    placeholder="Surname" 
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Email</label>
                                                <input 
                                                    type="email" 
                                                    name="fromEmail" 
                                                    value={formData.fromEmail || ''} 
                                                    onChange={handleChange} 
                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition" 
                                                    placeholder="email@example.com" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Phone</label>
                                                <input 
                                                    type="tel" 
                                                    name="fromPhone" 
                                                    value={formData.fromPhone || ''} 
                                                    onChange={handleChange} 
                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition" 
                                                    placeholder="07123456789" 
                                                />
                                            </div>
                                        </div>

                                        {/* Postcode & Address Lookup */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Postcode & Address</label>
                                            <div className="flex gap-1.5">
                                                <input 
                                                    type="text" 
                                                    name="postcode" 
                                                    value={formData.postcode || ''} 
                                                    onChange={handleChange} 
                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs sm:text-sm uppercase font-bold tracking-wider focus:ring-2 focus:ring-indigo-500 transition" 
                                                    placeholder="e.g. GU24 9NY" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleLookupAddress}
                                                    disabled={!formData.postcode || isLookingUpAddress}
                                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold rounded-lg px-3 py-2 flex items-center gap-1 transition text-xs shrink-0 cursor-pointer shadow-2xs"
                                                    title="Lookup address by UK postcode"
                                                >
                                                    {isLookingUpAddress ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                                    <span>Lookup</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Address Lookup Dropdown */}
                                        {addressList.length > 0 && (
                                            <div className="bg-white border-2 border-indigo-300 rounded-lg shadow-md overflow-hidden">
                                                <div className="bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-900 border-b border-indigo-200 flex items-center justify-between">
                                                    <span>Select Address ({addressList.length})</span>
                                                </div>
                                                <ul className="max-h-36 overflow-y-auto divide-y divide-gray-100">
                                                    {addressList.map((addr, idx) => (
                                                        <li key={idx}>
                                                            <button
                                                                type="button"
                                                                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-indigo-50 transition cursor-pointer text-gray-800"
                                                                onClick={() => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        addressLine1: addr.street || '',
                                                                        addressLine2: addr.locality || '',
                                                                        city: addr.postTown || '',
                                                                        county: addr.county || '',
                                                                        postcode: addr.postcode || prev.postcode
                                                                    }));
                                                                    setAddressList([]);
                                                                }}
                                                            >
                                                                {addr.summaryAddress || `${addr.street || ''} ${addr.locality || ''} ${addr.postTown || ''}`}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {(formData.addressLine1 || formData.city) && (
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 flex items-start gap-1.5">
                                                <MapPin size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                                <div className="font-medium text-[11px]">
                                                    <div>{formData.addressLine1} {formData.addressLine2 ? `, ${formData.addressLine2}` : ''}</div>
                                                    <div>{formData.city} {formData.county} <strong className="uppercase">{formData.postcode}</strong></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Customer Link / Auto-Create */}
                                        <div className="pt-1.5 border-t border-gray-100 space-y-1.5">
                                            <SearchableSelect
                                                options={customers.map(c => ({ id: c.id, label: getCustomerDisplayName(c), value: c.id }))}
                                                defaultValue={formData.linkedCustomerId || null}
                                                onSelect={(value) => {
                                                    const cust = customers.find(c => c.id === value);
                                                    setFormData(p => {
                                                        const customersCars = vehicles.filter(v => v.customerId === value);
                                                        let newVehicleId = p.linkedVehicleId;
                                                        if (!newVehicleId || !customersCars.some(car => car.id === newVehicleId)) {
                                                            newVehicleId = customersCars.length === 1 ? customersCars[0].id : null;
                                                        }
                                                        return { 
                                                            ...p, 
                                                            linkedCustomerId: value,
                                                            linkedVehicleId: newVehicleId,
                                                            fromEmail: cust?.email || p.fromEmail || '',
                                                            fromPhone: cust?.mobile || cust?.phone || p.fromPhone || '',
                                                            addressLine1: cust?.addressLine1 || p.addressLine1 || '',
                                                            addressLine2: cust?.addressLine2 || p.addressLine2 || '',
                                                            city: cust?.city || p.city || '',
                                                            county: cust?.county || p.county || '',
                                                            postcode: cust?.postcode || p.postcode || ''
                                                        };
                                                    });
                                                    setSuggestedCustomers([]);
                                                }}
                                                placeholder={linkedCustomer ? "Change linked customer..." : "Link existing customer..."}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Vehicle Connection & DVLA Lookup Card */}
                                <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xs space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <Car size={16} className="text-indigo-600" />
                                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                                                Vehicle & DVLA
                                            </h3>
                                        </div>
                                        {linkedVehicle && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                    Linked
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={handleUnlinkVehicle} 
                                                    title="Unlink Vehicle" 
                                                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold transition cursor-pointer"
                                                >
                                                    <XCircle size={13} /> Unlink
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Vehicle Registration & DVLA Lookup */}
                                    <div className="space-y-2.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Registration (VRM)</label>
                                            <div className="flex gap-1.5">
                                                <input 
                                                    type="text" 
                                                    name="vehicleRegistration" 
                                                    value={formData.vehicleRegistration || ''} 
                                                    onChange={handleChange} 
                                                    className="w-full p-2 border-2 border-yellow-400 bg-yellow-50/50 rounded-lg text-xs sm:text-sm font-black font-mono uppercase tracking-widest text-black focus:ring-2 focus:ring-indigo-500 transition" 
                                                    placeholder="e.g. AB12 CDE" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleLookupVehicle}
                                                    disabled={!formData.vehicleRegistration || isLookingUpVehicle}
                                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold rounded-lg px-3 py-2 flex items-center gap-1 transition text-xs shrink-0 cursor-pointer shadow-2xs"
                                                    title="Search DVLA records by registration number"
                                                >
                                                    {isLookingUpVehicle ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                                    <span>DVLA</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Vehicle Specs Display */}
                                        {(formData.vehicleMake || formData.vehicleModel || formData.vehicleYear || formData.vehicleVin || formData.vehicleMotExpiry || linkedVehicle?.wheelbaseType) && (
                                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 space-y-1">
                                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                                        {formData.vehicleMake} {formData.vehicleModel} {formData.vehicleYear ? `(${formData.vehicleYear})` : ''}
                                                    </div>
                                                    {(() => {
                                                        const wb = getWheelbaseAlertInfo(linkedVehicle?.wheelbaseType);
                                                        if (!wb) return null;
                                                        return (
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${wb.badgeClass}`}>
                                                                {wb.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                                                    {formData.vehicleVin && <div className="truncate">VIN: <span className="font-mono font-bold text-slate-800">{formData.vehicleVin}</span></div>}
                                                    {formData.vehicleMotExpiry && <div className="truncate">MOT: <span className="font-bold text-slate-800">{formData.vehicleMotExpiry}</span></div>}
                                                </div>
                                                {/* Lift Alert */}
                                                {(() => {
                                                    const wb = getWheelbaseAlertInfo(linkedVehicle?.wheelbaseType);
                                                    if (!wb || !wb.isAlert) return null;
                                                    return (
                                                        <div className={`p-2 rounded border flex items-center gap-1.5 text-[11px] font-medium ${wb.bannerClass}`}>
                                                            <span>⚠️</span>
                                                            <div>
                                                                <strong className="uppercase">{wb.fullLabel}:</strong> {wb.warningMessage}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {/* Client's Registered Vehicles Quick-Picker */}
                                        {!linkedVehicle && customerVehicles.length > 0 && (
                                            <div className="space-y-1 pt-1">
                                                <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider">
                                                    Saved Vehicles ({customerVehicles.length})
                                                </label>
                                                <div className="flex flex-col gap-1">
                                                    {customerVehicles.map(v => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData(p => ({
                                                                    ...p,
                                                                    linkedVehicleId: v.id,
                                                                    vehicleMake: v.make || p.vehicleMake,
                                                                    vehicleModel: v.model || p.vehicleModel,
                                                                    vehicleRegistration: v.registration || p.vehicleRegistration,
                                                                    vehicleYear: v.year?.toString() || p.vehicleYear,
                                                                    vehicleVin: v.vin || p.vehicleVin,
                                                                    vehicleMotExpiry: v.nextMotDate || v.motExpiryDate || p.vehicleMotExpiry,
                                                                    vehicleManufactureDate: v.manufactureDate || p.vehicleManufactureDate
                                                                }));
                                                            }}
                                                            className="flex items-center justify-between p-2 text-xs bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition text-left cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-black text-black font-mono bg-yellow-400 px-1.5 py-0.2 rounded border border-yellow-500 uppercase text-[10px]">{v.registration}</span>
                                                                <span className="font-medium text-slate-800 truncate">{v.make} {v.model}</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-indigo-700">Select</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Link Any Existing Vehicle */}
                                        <div className="pt-1.5 border-t border-gray-100">
                                            <SearchableSelect
                                                options={vehicles
                                                    .map(v => {
                                                        const isCust = v.customerId === formData.linkedCustomerId;
                                                        return { 
                                                            id: v.id, 
                                                            label: `${v.registration} - ${v.make} ${v.model}`, 
                                                            value: v.id,
                                                            badge: isCust ? { text: "Client's", className: "bg-indigo-100 text-indigo-800" } : undefined,
                                                            isCust
                                                        };
                                                    })
                                                    .sort((a, b) => (b.isCust ? 1 : 0) - (a.isCust ? 1 : 0))
                                                }
                                                defaultValue={formData.linkedVehicleId || null}
                                                onSelect={(value) => {
                                                    const vehicle = vehicles.find(v => v.id === value);
                                                    const ownerId = vehicle?.customerId;
                                                    setFormData(p => {
                                                        const cust = customers.find(c => c.id === (ownerId || p.linkedCustomerId));
                                                        return { 
                                                            ...p, 
                                                            linkedVehicleId: value,
                                                            linkedCustomerId: ownerId || p.linkedCustomerId,
                                                            fromEmail: p.fromEmail || cust?.email || '',
                                                            fromPhone: p.fromPhone || cust?.phone || cust?.mobile || ''
                                                        };
                                                    });
                                                }}
                                                placeholder={linkedVehicle ? "Change linked vehicle..." : "Link existing vehicle..."}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Column 3 (3 cols): Fast Actions Hub & Operations Status */}
                            <div className="lg:col-span-3 space-y-4">
                                {/* Fast Actions Card */}
                                <div className="bg-gradient-to-b from-indigo-50 via-purple-50/60 to-white p-4 border border-indigo-200 rounded-xl shadow-xs space-y-3">
                                    <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-indigo-100 pb-2">
                                        <Sparkles size={15} className="text-indigo-600" />
                                        Fast Actions
                                    </div>
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={handleQuickEstimate}
                                            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
                                            title="Smart create estimate directly from customer inquiry details"
                                        >
                                            <Wand2 size={15} /> Smart Create Estimate
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleQuickReply}
                                            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg font-bold text-xs sm:text-sm shadow-2xs transition cursor-pointer"
                                            title="Jump to reply and draft response with AI"
                                        >
                                            <Mail size={15} /> Draft AI Reply
                                        </button>
                                        {!linkedCustomer && (
                                            <button 
                                                type="button" 
                                                onClick={handleAutoCreateCustomer}
                                                className="w-full py-2 flex justify-center items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer"
                                                title="Create Customer and Vehicle records in 1 click"
                                            >
                                                <Wand2 size={13} /> Auto-Create Records
                                            </button>
                                        )}
                                    </div>
                                    {linkedEstimate && (
                                        <div className="pt-2 border-t border-indigo-100 space-y-1">
                                            <div className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                                                <FileText size={13} className="text-purple-600" /> Est #{linkedEstimate.estimateNumber}
                                            </div>
                                            {onViewEstimate && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onViewEstimate(linkedEstimate);
                                                        onClose();
                                                    }}
                                                    className="w-full py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition"
                                                >
                                                    Review Estimate &rarr;
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Status, Assignment & Operations */}
                                <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xs space-y-3">
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-2">
                                        Status & Assignment
                                    </h4>
                                    
                                    <div className="space-y-2.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Branch / Entity</label>
                                            <select name="entityId" value={formData.entityId || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-gray-50 font-medium">
                                                {entities?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Status</label>
                                                <select name="status" value={formData.status || 'Inbox'} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-gray-50 font-medium">
                                                    <option value="Inbox">Inbox</option>
                                                    <option value="New Requests">New Requests</option>
                                                    <option value="Our Action">Our Action (Priority)</option>
                                                    <option value="Waiting on Customer">Waiting on Customer</option>
                                                    <option value="Online Approved">Online Approved</option>
                                                    <option value="Scheduled">Scheduled</option>
                                                    <option value="Closed">Closed</option>
                                                </select>
                                            </div>
                                            <div className="w-16">
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Urgent</label>
                                                <label className="relative inline-flex items-center cursor-pointer mt-0.5">
                                                    <input type="checkbox" className="sr-only peer" checked={!!formData.isUrgent} onChange={e => setFormData(p => ({ ...p, isUrgent: e.target.checked }))} />
                                                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Action Status</label>
                                            <select name="actionStatus" value={formData.actionStatus || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-gray-50 font-medium">
                                                <option value="">-- None --</option>
                                                <optgroup label="Communication">
                                                    <option value="New Mail">New Mail</option>
                                                    <option value="Email Sent">Email Sent</option>
                                                    <option value="Email Responded">Email Responded</option>
                                                    <option value="Call Required">Call Required</option>
                                                    <option value="Voicemail Left">Voicemail Left</option>
                                                </optgroup>
                                                <optgroup label="Estimates">
                                                    <option value="Estimate Required">Estimate Required</option>
                                                    <option value="Estimate Sent">Estimate Sent</option>
                                                    <option value="Estimate Approved">Estimate Approved</option>
                                                    <option value="Estimate Rejected">Estimate Rejected</option>
                                                </optgroup>
                                                <optgroup label="Operations">
                                                    <option value="Internal Review">Internal Review</option>
                                                </optgroup>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Follow Up Date</label>
                                            <input type="date" name="followUpDate" value={formData.followUpDate || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-gray-50 font-medium" />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Taken By</label>
                                            <SearchableSelect
                                                options={users.map(u => ({ id: u.id, label: u.name, value: u.id }))}
                                                defaultValue={formData.takenByUserId || null}
                                                onSelect={(value) => {
                                                    if (value !== formData.takenByUserId) {
                                                        const userName = users.find(u => u.id === value)?.name || value;
                                                        const newLog = {
                                                            id: crypto.randomUUID(),
                                                            timestamp: new Date().toISOString(),
                                                            userId: currentUser.id,
                                                            actionType: 'Reassigned',
                                                            notes: `Taken By changed to: ${userName}`
                                                        };
                                                        setFormData(p => ({ ...p, takenByUserId: value, logs: [...(p.logs || []), newLog] }));
                                                    }
                                                }}
                                                placeholder="Taken by..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Assigned To</label>
                                            <SearchableSelect
                                                options={[
                                                    ...users.map(u => ({ id: u.id, label: `👤 ${u.name}`, value: `user_${u.id}` })),
                                                    ...(entities || []).map(e => ({ id: e.id, label: `🏢 ${e.name} (Team)`, value: `entity_${e.id}` }))
                                                ]}
                                                defaultValue={
                                                    formData.assignedToUserId ? `user_${formData.assignedToUserId}` : 
                                                    formData.assignedToEntityId ? `entity_${formData.assignedToEntityId}` : null
                                                }
                                                onSelect={(value) => {
                                                    if (!value) return;
                                                    const isUser = value.startsWith('user_');
                                                    const id = value.replace(/^(user_|entity_)/, '');
                                                    
                                                    const prevId = formData.assignedToUserId || formData.assignedToEntityId;
                                                    if (id !== prevId) {
                                                        const assignName = isUser 
                                                            ? users.find(u => u.id === id)?.name || id
                                                            : entities?.find(e => e.id === id)?.name || id;
                                                        const newLog = {
                                                            id: crypto.randomUUID(),
                                                            timestamp: new Date().toISOString(),
                                                            userId: currentUser.id,
                                                            actionType: 'Assigned',
                                                            notes: `Assigned To changed to: ${assignName}`
                                                        };
                                                        setFormData(p => ({ 
                                                            ...p, 
                                                            assignedToUserId: isUser ? id : undefined,
                                                            assignedToEntityId: !isUser ? id : undefined,
                                                            logs: [...(p.logs || []), newLog] 
                                                        }));
                                                    }
                                                }}
                                                placeholder="Assign to user/team..."
                                            />
                                        </div>

                                        {formData.status === 'Closed' && (
                                            <div>
                                                <label className="block text-[11px] font-bold text-red-600 mb-1">Reason for Closing</label>
                                                <select name="closedReason" value={formData.closedReason || ''} onChange={handleChange} className="w-full p-2 border border-red-200 rounded-lg text-xs bg-red-50 font-medium">
                                                    <option value="">Select a reason...</option>
                                                    <option value="Lost to Competitor">Lost to Competitor</option>
                                                    <option value="Too Expensive">Too Expensive</option>
                                                    <option value="No Response / Ghosted">No Response / Ghosted</option>
                                                    <option value="Project Cancelled / Changed Mind">Project Cancelled / Changed Mind</option>
                                                    <option value="Duplicate Inquiry">Duplicate Inquiry</option>
                                                    <option value="Spam / Invalid">Spam / Invalid</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'communication' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Reply to Inquiry</h4>
                        <div>
                            <textarea 
                                value={replyText} 
                                onChange={e => setReplyText(e.target.value)} 
                                rows={18} 
                                className="w-full p-2 border rounded text-sm mb-2" 
                                placeholder="Type your reply or use AI to draft one..."
                            />
                            
                            <div className="flex flex-col gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition flex items-center gap-1 border border-gray-300">
                                        <Camera size={14} /> Add Attachment(s)
                                        <input 
                                            type="file" 
                                            multiple 
                                            className="hidden" 
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setReplyAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                                                }
                                                e.target.value = ''; // Reset to allow selecting same file again
                                            }} 
                                        />
                                    </label>
                                </div>
                                {replyAttachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {replyAttachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-1 text-[10px] bg-gray-50 border rounded px-2 py-1 shadow-sm">
                                                <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-red-500 hover:text-red-700 ml-1 font-bold"
                                                    title="Remove attachment"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        if (!formData.message) return;
                                        setIsDraftingReply(true);
                                        try {
                                            const draft = await generateEmailReply(formData.message, 'Brookspeed', formData.actionNotes, formData.logs);
                                            setReplyText(draft);
                                        } catch (e) {
                                            console.error(e);
                                            toast.error('Failed to draft reply using AI.');
                                        } finally {
                                            setIsDraftingReply(false);
                                        }
                                    }}
                                    disabled={isDraftingReply || !formData.message}
                                    className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded hover:bg-purple-100 border border-purple-200 transition disabled:opacity-50"
                                >
                                    {isDraftingReply ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Draft with AI
                                </button>

                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        const emailAddress = formData.fromEmail || formData.fromContact;
                                        if (!replyText || !emailAddress || !emailAddress.includes('@')) {
                                            toast.error('Please enter a valid email reply and ensure the customer has an email address.');
                                            return;
                                        }
                                        setIsSendingReply(true);
                                        try {
                                            const emailAttachments = await Promise.all(replyAttachments.map(async file => {
                                                return new Promise<{content: string, filename: string, type: string}>((resolve, reject) => {
                                                    const reader = new FileReader();
                                                    reader.readAsDataURL(file);
                                                    reader.onload = () => {
                                                        const result = reader.result as string;
                                                        const base64Content = result.split(',')[1];
                                                        resolve({
                                                            content: base64Content,
                                                            filename: file.name,
                                                            type: file.type || 'application/octet-stream'
                                                        });
                                                    };
                                                    reader.onerror = error => reject(error);
                                                });
                                            }));

                                            const generatedId = formData.id || crypto.randomUUID();
                                            const generatedInquiryNumber = formData.inquiryNumber || generateInquiryNumber(inquiries);

                                            const success = await sendOutboundEmail({
                                                to: emailAddress,
                                                fromName: 'Brookspeed',
                                                fromEmail: 'info@brookspeed.com',
                                                subject: `Re: Your Inquiry [${generatedInquiryNumber}]`,
                                                body: replyText,
                                                attachments: emailAttachments.length > 0 ? emailAttachments : undefined
                                            });
                                            if (success) {
                                                const newLog = {
                                                    id: crypto.randomUUID(),
                                                    timestamp: new Date().toISOString(),
                                                    userId: currentUser.id,
                                                    actionType: 'Email Sent',
                                                    notes: `To: ${emailAddress}\nAttachments: ${replyAttachments.length}\n\n${replyText}`
                                                };
                                                const updatedLogs = [...(formData.logs || []), newLog];
                                                setFormData(p => ({ 
                                                    ...p, 
                                                    id: generatedId,
                                                    inquiryNumber: generatedInquiryNumber,
                                                    hasNewReply: false,
                                                    status: 'Waiting on Customer',
                                                    actionStatus: 'Email Sent',
                                                    followUpDate: null,
                                                    logs: updatedLogs 
                                                }));
                                                setReplyText('');
                                                setReplyAttachments([]);
                                                setActiveTab('estimates');
                                                
                                                const inquiryToSave: Inquiry = {
                                                    ...formData,
                                                    id: generatedId,
                                                    createdAt: formData.createdAt || new Date().toISOString(),
                                                    takenByUserId: formData.takenByUserId || currentUser.id,
                                                    inquiryNumber: generatedInquiryNumber,
                                                    hasNewReply: false,
                                                    status: 'Waiting on Customer',
                                                    followUpDate: null,
                                                    logs: updatedLogs,
                                                    fromName: formData.fromName || formData.fromEmail || 'Unknown Customer',
                                                    message: formData.message || `Outbound reply sent to ${emailAddress}`
                                                } as Inquiry;
                                                onSave(inquiryToSave, false);
                                                toast.success('Email sent successfully!');
                                            } else {
                                                toast.error('Failed to send email.');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            toast.error('Failed to send email.');
                                        } finally {
                                            setIsSendingReply(false);
                                        }
                                    }}
                                    disabled={isSendingReply || !replyText}
                                    className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded shadow hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {isSendingReply ? <Loader2 size={14} className="animate-spin" /> : 'Send Reply'}
                                </button>
                            </div>
                        </div>
                    </div>
                    </div>
                        {/* CRM Activity Logs & Internal Notes Card (Matching Customer Message Style) */}
                        <div className="bg-white rounded-xl border border-indigo-100 shadow-xs overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-50/90 to-white px-4 py-2.5 border-b border-indigo-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <MessageSquare size={15} className="text-indigo-600" />
                                        CRM Activity & Internal Notes
                                    </h4>
                                </div>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200">
                                    {(formData.logs || []).length} {(formData.logs || []).length === 1 ? 'Entry' : 'Entries'}
                                </span>
                            </div>

                            <div className="p-4 sm:p-5 space-y-3">
                                {/* Scrollable Logs Feed */}
                                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                                    {(!formData.logs || formData.logs.length === 0) && !formData.actionNotes && (
                                        <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                                            No CRM notes or activity logged yet. Type a note below to record an update.
                                        </div>
                                    )}

                                    {[...(formData.logs || [])]
                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                        .map((log) => {
                                            const userName = log.userId === 'System' ? 'System Auto-Log' : users.find(u => u.id === log.userId)?.name || 'Team Member';
                                            const isSystem = log.userId === 'System' || log.actionType === 'AI Scan';
                                            const isEmail = log.actionType === 'Email Sent';

                                            return (
                                                <div 
                                                    key={log.id} 
                                                    className={`p-3 rounded-xl border transition text-xs shadow-2xs ${
                                                        isEmail ? 'bg-indigo-50/40 border-indigo-200' :
                                                        isSystem ? 'bg-purple-50/40 border-purple-200' :
                                                        'bg-white border-slate-200 hover:border-indigo-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-900 flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                                {userName}
                                                            </span>
                                                            {log.actionType && (
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                                                    isEmail ? 'bg-indigo-100 text-indigo-800' :
                                                                    isSystem ? 'bg-purple-100 text-purple-800' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {log.actionType}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-medium text-slate-400">
                                                            {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-800 whitespace-pre-wrap leading-relaxed font-sans selection:bg-indigo-100 pl-3.5 border-l-2 border-indigo-200">
                                                        {log.notes}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    {formData.actionNotes && (
                                        <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 text-xs shadow-2xs">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-purple-900 uppercase tracking-wider text-[10px]">Legacy / Action Notes</span>
                                            </div>
                                            <div className="text-purple-950 whitespace-pre-wrap leading-relaxed pl-3.5 border-l-2 border-purple-300">
                                                {formData.actionNotes}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Note Composer Bar */}
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Type an internal CRM note and press Enter to save..." 
                                            className="flex-1 p-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs"
                                            id="newLogInput"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = e.currentTarget.value.trim();
                                                    if (val) {
                                                        const newLog = {
                                                            id: crypto.randomUUID(),
                                                            timestamp: new Date().toISOString(),
                                                            userId: currentUser.id,
                                                            notes: val
                                                        };
                                                        const updatedLogs = [...(formData.logs || []), newLog];
                                                        
                                                        let nextFollowUp = formData.followUpDate;
                                                        if (formData.status === 'Waiting on Customer') {
                                                            const fDate = new Date();
                                                            fDate.setDate(fDate.getDate() + 3);
                                                            nextFollowUp = fDate.toISOString().split('T')[0];
                                                        } else if (formData.followUpDate && new Date(formData.followUpDate) <= new Date()) {
                                                            nextFollowUp = null;
                                                        }

                                                        setFormData(p => ({ ...p, logs: updatedLogs, followUpDate: nextFollowUp }));
                                                        
                                                        if (formData.fromName && formData.message) {
                                                            const inquiryToSave: Inquiry = {
                                                                id: formData.id || crypto.randomUUID(),
                                                                createdAt: formData.createdAt || new Date().toISOString(),
                                                                takenByUserId: formData.takenByUserId || currentUser.id,
                                                                ...formData,
                                                                followUpDate: nextFollowUp,
                                                                logs: updatedLogs
                                                            } as Inquiry;
                                                            onSave(inquiryToSave, false);
                                                        }

                                                        e.currentTarget.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <button 
                                            type="button"
                                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer shrink-0"
                                            onClick={() => {
                                                const input = document.getElementById('newLogInput') as HTMLInputElement;
                                                const val = input?.value.trim();
                                                if (val) {
                                                    const newLog = {
                                                        id: crypto.randomUUID(),
                                                        timestamp: new Date().toISOString(),
                                                        userId: currentUser.id,
                                                        notes: val
                                                    };
                                                    const updatedLogs = [...(formData.logs || []), newLog];
                                                    
                                                    let nextFollowUp = formData.followUpDate;
                                                    if (formData.status === 'Waiting on Customer') {
                                                        const fDate = new Date();
                                                        fDate.setDate(fDate.getDate() + 3);
                                                        nextFollowUp = fDate.toISOString().split('T')[0];
                                                    } else if (formData.followUpDate && new Date(formData.followUpDate) <= new Date()) {
                                                        nextFollowUp = null;
                                                    }

                                                    setFormData(p => ({ ...p, logs: updatedLogs, followUpDate: nextFollowUp }));

                                                    if (formData.fromName && formData.message) {
                                                        const inquiryToSave: Inquiry = {
                                                            id: formData.id || crypto.randomUUID(),
                                                            createdAt: formData.createdAt || new Date().toISOString(),
                                                            takenByUserId: formData.takenByUserId || currentUser.id,
                                                            ...formData,
                                                            followUpDate: nextFollowUp,
                                                            logs: updatedLogs
                                                        } as Inquiry;
                                                        onSave(inquiryToSave, false);
                                                    }

                                                    input.value = '';
                                                }
                                            }}
                                        >
                                            <PlusCircle size={14} />
                                            <span>Add Note</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'estimates' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            {linkedEstimate ? (
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <p className="font-bold text-indigo-800 flex items-center gap-2 text-sm"><FileText size={16}/> Linked Estimate</p>
                                    <p className="text-xs text-indigo-600 font-medium mt-0.5">#{linkedEstimate.estimateNumber} - {linkedEstimate.status}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {onViewEstimate && (
                                        <button 
                                            onClick={() => {
                                                onViewEstimate(linkedEstimate);
                                                onClose(); 
                                            }}
                                            className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 font-bold rounded-lg hover:bg-indigo-50 text-xs shadow-sm transition"
                                        >
                                            Review Estimate
                                        </button>
                                    )}
                                    {onEditEstimate && linkedEstimate.status === 'Draft' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onEditEstimate(linkedEstimate);
                                                onClose();
                                            }}
                                            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 shadow-sm transition"
                                        >
                                            <Edit size={14}/> Edit Estimate
                                        </button>
                                    )}
                                    {linkedEstimate.status === 'Draft' && (
                                        <button
                                            type="button"
                                            onClick={() => handleAIUpdateEstimate(linkedEstimate)}
                                            disabled={isUpdatingAI}
                                            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 shadow-sm transition"
                                        >
                                            {isUpdatingAI ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            {isUpdatingAI ? 'Updating...' : 'AI Update'}
                                        </button>
                                    )}
                                    {linkedEstimate.status === 'Approved' && !linkedEstimate.jobId && onScheduleEstimate && (
                                         <button 
                                            onClick={() => {
                                                onScheduleEstimate(linkedEstimate, formData.id);
                                                onClose();
                                            }}
                                            className="px-3 py-1.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-1 text-xs transition"
                                        >
                                            <CalendarCheck size={14}/> Schedule Job
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={16} className="text-indigo-600"/> Estimates</h4>
                            <div className="flex flex-col gap-2">
                                {onCreateNewEstimate && (
                                    <button
                                        type="button"
                                        onClick={() => onCreateNewEstimate(formData as Inquiry)}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-indigo-300 text-indigo-700 bg-white rounded-lg font-semibold hover:bg-indigo-100 transition shadow-sm text-xs"
                                    >
                                        <PlusCircle size={14} /> Create Standard Estimate
                                    </button>
                                )}
                                {onSmartCreateEstimate && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const fullPrompt = [
                                                `Customer Name: ${formData.fromName || 'Unknown'}`,
                                                formData.fromEmail ? `Email: ${formData.fromEmail}` : null,
                                                formData.fromPhone ? `Phone: ${formData.fromPhone}` : null,
                                                formData.vehicleRegistration ? `Vehicle Registration: ${formData.vehicleRegistration}` : null,
                                                (formData.vehicleMake || formData.vehicleModel) ? `Vehicle Make & Model: ${formData.vehicleYear || ''} ${formData.vehicleMake || ''} ${formData.vehicleModel || ''}`.trim() : null,
                                                `Request Details: ${formData.message || ''}`
                                            ].filter(Boolean).join('\n');
                                            onSmartCreateEstimate(formData as Inquiry, fullPrompt);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-transparent shadow-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition text-xs"
                                    >
                                        <Wand2 size={14} /> Smart Create Estimate (AI)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                            {/* Attachments Section */}
                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
                            <div className="flex justify-between items-center border-b pb-2 mb-3">
                                <label className="block text-sm font-bold text-gray-800">Attachments ({formData.media ? formData.media.length : 0})</label>
                                <label className="cursor-pointer text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition flex items-center gap-1 border border-indigo-200 shadow-sm">
                                    <PlusCircle size={14} /> Add Attachment
                                    <input 
                                        type="file" 
                                        multiple 
                                        className="hidden" 
                                        onChange={async (e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                const { saveImage } = await import('../utils/imageStore');
                                                const newMedia = [];
                                                for (const file of e.target.files) {
                                                    const isImage = file.type.startsWith('image/');
                                                    const mediaItem = {
                                                        id: crypto.randomUUID(),
                                                        type: isImage ? 'Photo' : 'Document',
                                                        name: file.name,
                                                        uploadedAt: new Date().toISOString()
                                                    };
                                                    await saveImage(mediaItem.id, file);
                                                    newMedia.push(mediaItem);
                                                }
                                                setFormData(p => ({ ...p, media: [...(p.media || []), ...newMedia] }));
                                            }
                                            e.target.value = '';
                                        }} 
                                    />
                                </label>
                            </div>
                            {formData.media && formData.media.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
                                {formData.media.map((item: any) => {
                                    const isPhoto = item.type === 'Photo';
                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isPhoto ? <Camera size={16} className="text-indigo-500 shrink-0" /> : <FileText size={16} className="text-gray-500 shrink-0" />}
                                                <span className="truncate font-medium text-gray-700 text-[11px]" title={item.name}>{item.name}</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={async () => {
                                                      // Open window immediately to bypass popup blockers
                                                      const win = window.open('about:blank', '_blank');
                                                      
                                                      const { getImage } = await import('../utils/imageStore');
                                                      const dataUrl = await getImage(item.id);
                                                      
                                                      if (dataUrl && win) {
                                                          const isPhoto = item.type === 'Photo';
                                                          win.document.write(`
                                                              <!DOCTYPE html>
                                                              <html>
                                                              <head>
                                                                  <title>Attachment: ${item.name || 'File'}</title>
                                                                  <style>
                                                                      body { margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #1f2937; min-height: 100vh; font-family: system-ui, sans-serif; }
                                                                      .download-btn { padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-bottom: 24px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                                                                      .download-btn:hover { background: #4338ca; }
                                                                      img { max-width: 90vw; max-height: 80vh; object-fit: contain; box-shadow: 0 10px 15px rgba(0,0,0,0.5); }
                                                                      p { color: white; font-size: 1.2rem; }
                                                                  </style>
                                                              </head>
                                                              <body>
                                                                  <a href="${dataUrl}" download="${item.name || 'attachment'}" class="download-btn">Download ${item.name || 'File'}</a>
                                                                  ${isPhoto ? `<img src="${dataUrl}" alt="Attachment preview" />` : `<p>This file type cannot be previewed in the browser.</p>`}
                                                              </body>
                                                              </html>
                                                          `);
                                                          win.document.close();
                                                      } else {
                                                          win?.close();
                                                          if (!dataUrl) toast.error('Could not retrieve file data.');
                                                      }
                                                  }} 
                                                className="text-[10px] bg-white px-2 py-1 rounded shadow-sm border font-bold hover:bg-gray-100 transition shrink-0"
                                            >
                                                View / Download
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            ) : (
                                <div className="text-gray-400 text-xs py-6 text-center border-2 border-dashed rounded-lg">No attachments found</div>
                            )}
                        </div>
                        </div>
                    </div>
                )}
            </div>
        </FormModal>
    );
};

export default InquiryFormModal;