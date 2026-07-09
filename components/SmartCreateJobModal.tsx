import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Wand2, Check, Car, Plus, Trash2, Calendar, AlertTriangle, Calculator, FileText, User, Phone, Mail, Edit, DollarSign, Wallet, TrendingUp, Bot, Sparkles, Info, Volume2, VolumeX } from 'lucide-react';
import { parseJobRequest } from '../core/services/geminiService';
import { toast } from 'react-toastify';
import SpeechToTextButton from './shared/SpeechToTextButton';
import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../core/utils/cloudSpeech';
import { prepareTextForSpeech, findBestVoice } from '../core/utils/speechUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Vehicle, ServicePackage, Customer, EstimateLineItem, Job, Estimate } from '../types';
import { formatDate, getTodayISOString, getFutureDateISOString, splitJobIntoSegments } from '../core/utils/dateUtils';
import AddNewVehicleForm from './AddNewVehicleForm';
import CustomerFormModal from './CustomerFormModal';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../utils/formatUtils';
import SearchableSelect from './SearchableSelect';
import { generateEstimateNumber, generateJobId } from '../core/utils/numberGenerators';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { calculatePackagePrices } from '../core/utils/packageUtils';

interface SmartCreateJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    creationMode: 'job' | 'estimate';
    onJobCreate: (jobData: Job) => void;
    onVehicleAndJobCreate: (customer: Customer, vehicle: Vehicle, jobData: Job) => void;
    onEstimateCreate: (estimateData: Estimate) => void;
    onVehicleAndEstimateCreate: (customer: Customer, vehicle: Vehicle, estimateData: Estimate) => void;
    onCustomerAndEstimateCreate?: (customer: Customer, estimateData: Estimate) => void;
    vehicles: Vehicle[];
    customers: Customer[];
    servicePackages: ServicePackage[];
    defaultDate?: string | null;
    initialPrompt?: string | null;
    inquiryId?: string | null;
}

const SmartCreateJobModal: React.FC<SmartCreateJobModalProps> = ({ 
    isOpen, 
    onClose, 
    creationMode,
    onJobCreate, 
    onVehicleAndJobCreate, 
    onEstimateCreate,
    onVehicleAndEstimateCreate,
    onCustomerAndEstimateCreate,
    vehicles, 
    customers, 
    servicePackages, 
    defaultDate, 
    initialPrompt,
    inquiryId,
}) => {
    const { taxRates, jobs, businessEntities, estimates, parts, suppliers, inquiries } = useData();
    const { selectedEntityId, currentUser } = useApp();

    const linkedInquiry = useMemo(() => inquiries?.find(i => i.id === inquiryId), [inquiries, inquiryId]);

    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [parsedData, setParsedData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isSpeakingExplanation, setIsSpeakingExplanation] = useState(false);
    
    // Core Entity States
    const [vehicleExists, setVehicleExists] = useState<boolean | null>(null);
    const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
    const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
    const [customerCreated, setCustomerCreated] = useState<Customer | null>(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(defaultDate || getTodayISOString());
    
    // Builder States
    const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showAddNewVehicle, setShowAddNewVehicle] = useState(false);

    const isEstimateMode = creationMode === 'estimate';
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    
    const selectedEntity = useMemo(() => businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0], [businessEntities, selectedEntityId]);

    useEffect(() => {
        if (isOpen) {
            const promptToUse = initialPrompt || '';
            setPrompt(promptToUse);
            setParsedData(null);
            setIsLoading(false);
            setError('');
            setIsSpeaking(false);
            setIsSpeakingExplanation(false);
            setVehicleExists(null);
            setFoundVehicle(null);
            setFoundCustomer(null);
            setCustomerCreated(null);
            setIsCustomerModalOpen(false);
            setLineItems([]);
            setNotes('');
            setShowAddNewVehicle(false);
            setSelectedDate(defaultDate || getTodayISOString());

            if (promptToUse) {
               setTimeout(() => handleParseRequest(promptToUse), 100);
           }
        }
        return () => {
            cloudSpeechSynthesis.cancel();
        };
    }, [isOpen, initialPrompt]);

    // Capacity Calculation
    const capacityStats = useMemo(() => {
        if (!selectedDate || !selectedEntity) return { allocated: 0, max: 0, available: 0, isOver: false, currentJobHours: 0 };
        
        // 1. Calculate existing load for this entity on this date
        const entityJobs = jobs.filter(j => j.entityId === selectedEntity.id);
        const allocatedHours = entityJobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === selectedDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);

        // 2. Calculate labor hours for the NEW job being built
        const currentJobHours = lineItems
            .filter(item => item.isLabor && !item.isOptional)
            .reduce((sum, item) => sum + item.quantity, 0);

        const max = selectedEntity.dailyCapacityHours || 40;
        const totalProjected = allocatedHours + currentJobHours;
        
        return {
            allocated: allocatedHours,
            max,
            available: Math.max(0, max - allocatedHours),
            currentJobHours,
            totalProjected,
            isOver: totalProjected > max
        };
    }, [jobs, selectedEntity, selectedDate, lineItems]);

    // Financial Totals matching EstimateFormModal calculation exactly
    const totals = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        const taxRatesMap = new Map(taxRates.map(t => [t.id, t]));

        if (!lineItems) {
            return { totalNet: 0, grandTotal: 0, vatBreakdown: [], totalCost: 0, totalProfit: 0, profitMargin: 0 };
        }
        
        let totalCost = 0;
        const t99RateId = taxRates.find(t => t.code === 'T99')?.id;

        (lineItems || []).forEach(item => {
            if (item.isOptional) return;

            const qty = Number(item.quantity) || 0;
            const cost = Number(item.unitCost) || 0;
            totalCost += qty * cost;

            if (item.isPackageComponent) return;

            const price = Number(item.unitPrice) || 0;
            const itemNet = qty * price;

            if (item.taxCodeId === t99RateId) {
                if (!breakdown[t99RateId]) {
                    breakdown[t99RateId] = { net: 0, vat: 0, rate: 'Mixed', name: 'Mixed VAT' };
                }
                breakdown[t99RateId].net += itemNet;
                breakdown[t99RateId].vat += (item.preCalculatedVat || 0) * qty;
            } else {
                const effectiveTaxId = item.taxCodeId || standardTaxRateId;
                
                if (!effectiveTaxId) {
                    const noTaxKey = 'no_tax';
                    if (!breakdown[noTaxKey]) breakdown[noTaxKey] = { net: 0, vat: 0, rate: 0, name: 'No Tax' };
                    breakdown[noTaxKey].net += itemNet;
                    return;
                }

                const taxRate = taxRatesMap.get(effectiveTaxId);
                if (!taxRate) {
                    const noTaxKey = 'no_tax_rate';
                    if (!breakdown[noTaxKey]) breakdown[noTaxKey] = { net: 0, vat: 0, rate: 0, name: 'Invalid Tax' };
                    breakdown[noTaxKey].net += itemNet;
                    return;
                }

                if (!breakdown[effectiveTaxId]) {
                    breakdown[effectiveTaxId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }

                breakdown[effectiveTaxId].net += itemNet;
                if (taxRate.rate > 0) {
                    breakdown[effectiveTaxId].vat += itemNet * (taxRate.rate / 100);
                }
            }
        });

        const finalVatBreakdown = Object.values(breakdown);
        const totalNet = finalVatBreakdown.reduce((sum, b) => sum + b.net, 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const grandTotal = totalNet + totalVat;
        
        const profit = totalNet - totalCost;
        const margin = totalNet > 0 ? (profit / totalNet) * 100 : 0;

        return {
            totalNet,
            grandTotal,
            vatBreakdown: finalVatBreakdown.filter(b => b.net > 0 || b.vat > 0),
            totalCost,
            totalProfit: profit,
            profitMargin: margin,
            // Backwards compatibility / aliases for footer / button usage
            net: totalNet,
            cost: totalCost,
            profit: profit,
            margin: margin,
            gross: grandTotal,
            vat: totalVat
        };
    }, [lineItems, taxRates, standardTaxRateId]);

    // Segment line items into packages, custom labor, and custom parts
    const builderBreakdown = useMemo(() => {
        const packages: { header: EstimateLineItem; children: EstimateLineItem[] }[] = [];
        const customLabor: EstimateLineItem[] = [];
        const customParts: EstimateLineItem[] = [];
        
        const packageHeaders = lineItems.filter(item => item.servicePackageId && !item.isPackageComponent);
        packageHeaders.forEach(header => {
            packages.push({
                header,
                children: lineItems.filter(item => item.isPackageComponent && item.servicePackageId === header.servicePackageId)
            });
        });
        
        lineItems.forEach(item => {
            if (!item.servicePackageId) {
                if (item.isLabor) {
                    customLabor.push(item);
                } else {
                    customParts.push(item);
                }
            }
        });
        
        return { packages, customLabor, customParts };
    }, [lineItems]);

    const customerOptions = useMemo(() => {
        return customers.map(c => ({
            id: c.id,
            value: c.id,
            label: `${c.forename} ${c.surname} ${c.companyName ? `(${c.companyName})` : ''} - ${c.postcode || ''}`
        }));
    }, [customers]);
    
    // Sort and Filter Packages based on Vehicle Hierarchy
    const sortedPackages = useMemo(() => {
        if (!foundVehicle) {
            return servicePackages
                .filter(p => p.entityId === selectedEntity.id)
                .map(p => ({ 
                    id: p.id, 
                    label: p.name,
                    value: p.id,
                    badge: { text: 'Generic', className: 'bg-gray-100 text-gray-600' }
                }));
        }

        const vMake = (foundVehicle.make || '').toLowerCase().trim();
        const vModel = (foundVehicle.model || '').toLowerCase().trim();

        const scored = servicePackages
            .filter(p => p.entityId === selectedEntity.id)
            .map(pkg => {
                const pMake = (pkg.applicableMake || '').toLowerCase().trim();
                const pModel = (pkg.applicableModel || '').toLowerCase().trim();
                const pVariant = (pkg.applicableVariant || '').toLowerCase().trim();
                
                let score = -1;
                let matchType = 'Mismatch';
                let color = 'bg-gray-100 text-gray-400';

                if (!pMake) {
                    score = 0;
                    matchType = 'Generic';
                    color = 'bg-gray-100 text-gray-600';
                } else if (vMake === pMake || vMake.includes(pMake) || pMake.includes(vMake)) {
                    if (!pModel) {
                        score = 1;
                        matchType = 'Make Match';
                        color = 'bg-amber-100 text-amber-800';
                    } else if (vModel.includes(pModel)) {
                        if (!pVariant) {
                            score = 2;
                            matchType = 'Model Match';
                            color = 'bg-amber-100 text-amber-800';
                        } else if (vModel.includes(pVariant)) {
                            score = 3;
                            matchType = 'Exact Match';
                            color = 'bg-green-100 text-green-800';
                        } else {
                            score = 1.5;
                            matchType = 'Model Match';
                            color = 'bg-amber-100 text-amber-800';
                        }
                    } else {
                        score = 0.5;
                        matchType = 'Make Only';
                        color = 'bg-gray-100 text-gray-600';
                    }
                }
                return { pkg, score, matchType, color };
            });

        return scored
            .filter(item => item.score >= 0)
            .sort((a, b) => b.score - a.score || a.pkg.name.localeCompare(b.pkg.name))
            .map(item => ({
                id: item.pkg.id,
                label: item.pkg.name,
                value: item.pkg.id,
                badge: { text: item.matchType, className: item.color }
            }));

    }, [servicePackages, foundVehicle, selectedEntity]);

    const handleParseRequest = async (promptOverride?: string) => {
        const currentPrompt = promptOverride || prompt;
        if (!currentPrompt.trim()) {
            setError('Please enter a description.');
            return;
        }
        setIsLoading(true);
        setError('');
        setParsedData(null);
        setLineItems([]);

        try {
            const contextDate = defaultDate || formatDate(new Date());
            const knownPackages = servicePackages.map(p => `- ${p.name}`).join('\n');

            const constructSystemPrompt = (userText: string, vehicleContext?: string) => {
                return `You are an elite estimator and scheduling assistant for a vehicle service center. 
Analyze the user's booking or estimate request and extract structured details. 

If the user asks a general question or requests an estimate (e.g. "what is the cost of...", "can you give me an estimate to..."), use your knowledge base of UK automotive rates to estimate the time, materials, options, and costs.

Context Date: ${contextDate}
Available Service Packages in our system:
${knownPackages || '- MOT\n- Minor Service\n- Major Service\n- General Repair'}
${vehicleContext ? `Vehicle Context: ${vehicleContext}` : ''}

Extract:
1. "vehicleRegistration": Extract any vehicle registration plate/number.
2. "customerName": Extract the customer's name if mentioned, otherwise null.
3. "servicePackageNames": Identify any requested service packages matching the list above, as an array of strings.
4. "description": A short summary of the work requested.
5. "estimatedHours": Estimated labor hours for this work as a number, or null if not clear.
6. "scheduledDate": The requested booking date in YYYY-MM-DD format (if relative, resolve relative to Context Date: ${contextDate}), otherwise null.
7. "notes": Any specific logistical considerations or turnaround times. This MUST be written in a friendly, customer-facing tone (do not include internal notes), as the customer will read this directly.
8. "explanation": A detailed, friendly, and customer-oriented markdown-formatted text explaining the estimate. Write this directly to the customer (e.g., "Hi there, here is the breakdown for..."). Explain the reasoning clearly, answer any questions, and break down labor, materials, and options without using internal jargon. DO NOT include any prices, costs, or monetary values in this explanation, as the actual pricing will be provided in the final summary. IMPORTANT: Do NOT use raw double quotes (") inside this explanation string. Use single quotes (') instead of double quotes (") for highlighted terms, and ensure all newlines are written as escaped '\\n' characters rather than raw carriage returns/newlines.
9. "extractedLineItems": If the user's request details specific materials, parts, labor hours, or options (such as pricing, fabric cost, or custom addons), generate a detailed array of individual line items. For each item:
- "description": Descriptive name of the material, part, labor task, or option.
- "quantity": Number of units (for parts) or number of hours (for labor).
- "unitPrice": The sell price per unit/hour. If a range is given, use the upper value. If it is labor, you MUST use the default labor rate of £${selectedEntity?.laborRate || 90} unless specified. If unknown for a part, use 0.
- "unitCost": The cost price if mentioned, otherwise null.
- "isLabor": true if the item is labor/time, false if part/material.
- "isOptional": true if the item is an optional add-on or upgrade.

Format your response as a valid JSON object only, using this structure:
{
  "vehicleRegistration": "string" /* or null */,
  "customerName": "string" /* or null */,
  "servicePackageNames": ["string", "string"] /* or null */,
  "description": "string",
  "estimatedHours": 1.5 /* or null */,
  "scheduledDate": "YYYY-MM-DDTHH:mm:ss.sssZ" /* or null */,
  "notes": "string" /* or null */,
  "explanation": "string (explain your reasoning)",
  "extractedLineItems": [
    {
      "description": "string",
      "quantity": 1,
      "unitPrice": 90,
      "unitCost": null,
      "isLabor": true,
      "isOptional": false
    }
  ] /* or null */
}

Do not include any conversational text or explanation outside the JSON. Return ONLY the valid JSON object.

User Request: ${JSON.stringify(userText)}`;
            };

            const initialPromptText = constructSystemPrompt(currentPrompt);
            let finalResult = await parseJobRequest(initialPromptText);

            // 1. Match Vehicle
            const registration = finalResult.vehicleRegistration?.toUpperCase().replace(/\s/g, '');
            let found = vehicles.find(v => v.registration.toUpperCase().replace(/\s/g, '') === registration);
            
            // If found, fetch latest technical data (VIN, MOT) to satisfy "front sheet" update requirement
            if (found) {
                try {
                    const latestDetails = await lookupVehicleByVRM(found.registration);
                    found = {
                        ...found,
                        vin: latestDetails.vin || found.vin,
                        nextMotDate: latestDetails.nextMotDate || found.nextMotDate,
                    };
                } catch (apiErr) {
                    console.warn('Vehicle technical data lookup failed during smart create:', apiErr);
                }
            }
            
            // Re-parse with vehicle context if needed - reducing arguments to match current API signature
            if (found && (!finalResult.servicePackageNames || finalResult.servicePackageNames.length === 0)) {
                // We simplify the call to match the single-argument signature in geminiService.ts
                const secondaryPrompt = constructSystemPrompt(currentPrompt, `${found.make} ${found.model}`);
                finalResult = await parseJobRequest(secondaryPrompt);
            }

            if (finalResult.scheduledDate) setSelectedDate(finalResult.scheduledDate);
            
            setParsedData(finalResult);
            const combinedNotes = [finalResult.explanation, finalResult.notes].filter(Boolean).join('\n\n');
            setNotes(combinedNotes);
            
            if (found) {
                setVehicleExists(true);
                setFoundVehicle(found);
                const cust = customers.find(c => c.id === found.customerId);
                setFoundCustomer(cust || null);
            } else {
                setVehicleExists(false);
                setFoundVehicle(null);
                
                // 2. Match Customer if Vehicle not found
                if (finalResult.customerName) {
                    const lowerName = finalResult.customerName.toLowerCase();
                    const matchedCust = customers.find(c => getCustomerDisplayName(c).toLowerCase().includes(lowerName));
                    setFoundCustomer(matchedCust || null);
                } else {
                    setFoundCustomer(null);
                }
            }

            // Helper to generate package line items
            const createPackageItems = (pkg: ServicePackage): EstimateLineItem[] => {
                const { net, vat } = calculatePackagePrices(pkg, taxRates);
                const t99RateId = taxRates.find(t => t.code === 'T99')?.id;

                const headerItem: EstimateLineItem = {
                    id: crypto.randomUUID(),
                    description: pkg.name || '',
                    quantity: 1,
                    unitPrice: net,
                    unitCost: 0,
                    isLabor: false,
                    taxCodeId: pkg.taxCodeId || standardTaxRateId,
                    servicePackageId: pkg.id,
                    servicePackageName: pkg.name,
                    preCalculatedVat: pkg.taxCodeId === t99RateId ? vat : undefined
                };
                const childItems: EstimateLineItem[] = (pkg.costItems || []).map(ci => {
                    const part = (ci.partId ? parts.find(p => p.id === ci.partId) : null) || 
                                 (ci.partNumber ? parts.find(p => p.partNumber === ci.partNumber) : null);
                    
                    const unitCost = ci.isLabor
                        ? (selectedEntity?.laborCostRate || 0)
                        : (part ? part.costPrice : (ci.unitCost || (ci.unitPrice ? ci.unitPrice * 0.8 : 0)));

                    return {
                        ...ci,
                        id: crypto.randomUUID(),
                        unitPrice: ci.unitPrice || 0,
                        unitCost: unitCost,
                        partId: part ? part.id : ci.partId,
                        servicePackageId: pkg.id,
                        servicePackageName: pkg.name,
                        isPackageComponent: true,
                        supplierId: part?.defaultSupplierId || ci.supplierId,
                        fromStock: ci.fromStock ?? (ci.isLabor ? true : (part?.isStockItem && part.stockQuantity > 0))
                    };
                });
                return [headerItem, ...childItems];
            };

            // 1. Identify matched/partially matched service packages
            const matchedPackages: ServicePackage[] = [];
            const activeVehicle = found || foundVehicle;
            
            // Resolve packages explicitly identified by AI
            if (finalResult.servicePackageNames && finalResult.servicePackageNames.length > 0) {
                finalResult.servicePackageNames.forEach((pkgName: string) => {
                    const pkg = servicePackages.find(p => p.name?.toLowerCase() === pkgName.toLowerCase());
                    if (pkg && !matchedPackages.some(m => m.id === pkg.id)) {
                        matchedPackages.push(pkg);
                    }
                });
            }

            // Perform direct string/partial matching on user prompt as a fallback/verification
            const cleanPrompt = currentPrompt.toLowerCase();
            servicePackages.forEach(pkg => {
                if (!pkg.name) return;
                const cleanPkgName = pkg.name.toLowerCase();
                let isMatch = false;

                if (cleanPkgName.includes('mot')) {
                    if (/\bmot\b/i.test(cleanPrompt)) {
                        isMatch = true;
                    }
                } else {
                    const keywords = ['minor service', 'major service', 'brake fluid', 'winter check', 'air con'];
                    const matchedKeyword = keywords.find(kw => cleanPkgName.includes(kw) && cleanPrompt.includes(kw));
                    if (matchedKeyword) {
                        isMatch = true;
                    } else if (cleanPrompt.includes(cleanPkgName)) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    if (activeVehicle) {
                        const vMake = (activeVehicle.make || '').toLowerCase().trim();
                        const vModel = (activeVehicle.model || '').toLowerCase().trim();
                        const pkgMake = (pkg.applicableMake || '').toLowerCase().trim();
                        const pkgModel = (pkg.applicableModel || '').toLowerCase().trim();

                        if (pkgMake && !vMake.includes(pkgMake) && !pkgMake.includes(vMake)) {
                            return; // Skip make mismatch
                        }
                        if (pkgModel && !vModel.includes(pkgModel) && !pkgModel.includes(vModel)) {
                            return; // Skip model mismatch
                        }
                    }

                    if (!matchedPackages.some(m => m.id === pkg.id)) {
                        matchedPackages.push(pkg);
                    }
                }
            });

            // 2. Populate line items based on matching results
            if (matchedPackages.length > 0) {
                let items: EstimateLineItem[] = [];
                matchedPackages.forEach(pkg => {
                    items = [...items, ...createPackageItems(pkg)];
                });

                // Append non-redundant custom items
                if (finalResult.extractedLineItems && finalResult.extractedLineItems.length > 0) {
                    const customItems = finalResult.extractedLineItems
                        .filter((item: any) => {
                            const itemDesc = (item.description || '').toLowerCase();
                            if (itemDesc === 'labor' || itemDesc === 'labour') {
                                return !matchedPackages.some(pkg => 
                                    (pkg.costItems || []).some(ci => ci.isLabor)
                                );
                            }
                            if (matchedPackages.some(pkg => {
                                const pName = (pkg.name || '').toLowerCase();
                                return pName.includes(itemDesc) || itemDesc.includes(pName);
                            })) {
                                return false;
                            }
                            const isComponentMatch = matchedPackages.some(pkg => 
                                (pkg.costItems || []).some(ci => {
                                    const ciDesc = (ci.description || '').toLowerCase();
                                    return ciDesc.includes(itemDesc) || itemDesc.includes(ciDesc);
                                })
                            );
                            return !isComponentMatch;
                        })
                        .map((item: any) => {
                            const isLabor = !!item.isLabor;
                            const unitPrice = item.unitPrice || 0;
                            const unitCost = isLabor
                                ? (selectedEntity?.laborCostRate || 0)
                                : (item.unitCost || (unitPrice ? unitPrice * 0.8 : 0));
                            return {
                                id: crypto.randomUUID(),
                                description: item.description,
                                quantity: item.quantity || 1,
                                unitPrice: unitPrice,
                                unitCost: unitCost,
                                isLabor: isLabor,
                                isOptional: !!item.isOptional,
                                taxCodeId: standardTaxRateId,
                                fromStock: !isLabor ? false : true
                            };
                        });

                    items = [...items, ...customItems];
                }
                setLineItems(items);
            } else if (finalResult.extractedLineItems && finalResult.extractedLineItems.length > 0) {
                const items = finalResult.extractedLineItems.map((item: any) => {
                    const isLabor = !!item.isLabor;
                    const unitPrice = item.unitPrice || 0;
                    const unitCost = isLabor
                        ? (selectedEntity?.laborCostRate || 0)
                        : (item.unitCost || (unitPrice ? unitPrice * 0.8 : 0));
                    return {
                        id: crypto.randomUUID(),
                        description: item.description,
                        quantity: item.quantity || 1,
                        unitPrice: unitPrice,
                        unitCost: unitCost,
                        isLabor: isLabor,
                        isOptional: !!item.isOptional,
                        taxCodeId: standardTaxRateId,
                        fromStock: !isLabor ? false : true
                    };
                });
                setLineItems(items);
            } else if (finalResult.estimatedHours) {
                // Add generic labor if no package but hours found
                setLineItems(prev => [...prev, {
                    id: crypto.randomUUID(),
                    description: finalResult.description || 'Labor',
                    quantity: finalResult.estimatedHours,
                    unitPrice: selectedEntity.laborRate || 0,
                    unitCost: selectedEntity.laborCostRate || 0,
                    isLabor: true,
                    taxCodeId: standardTaxRateId
                }]);
            } else {
                // Default if nothing specific found
                setLineItems(prev => [...prev, {
                    id: crypto.randomUUID(),
                    description: finalResult.description || 'Diagnosis / Inspection',
                    quantity: 1,
                    unitPrice: selectedEntity.laborRate || 0,
                    unitCost: selectedEntity.laborCostRate || 0,
                    isLabor: true,
                    taxCodeId: standardTaxRateId
                }]);
            }

        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            toast.error("Failed to parse the AI's response. Please try retyping your request as the response was not adequate.");
        } finally {
            setIsLoading(false);
        }
    };    const handleSaveNewCustomer = (newCustomer: Customer) => {
        setCustomerCreated(newCustomer);
        setFoundCustomer(newCustomer);
        setIsCustomerModalOpen(false);
    };

    const handleFinalCreate = () => {
        try {
            let activeCustomer = foundCustomer || customerCreated;
            let activeVehicle = foundVehicle;
            let isNewCustomer = false;
            let isNewVehicle = false;
            
            // Auto-create customer if missing
            if (!activeCustomer && (parsedData?.customerName || linkedInquiry?.fromName)) {
                const nameToCheck = (parsedData?.customerName || linkedInquiry?.fromName || 'New Customer').trim();
                const matchedCust = customers.find(c => 
                    getCustomerDisplayName(c).toLowerCase() === nameToCheck.toLowerCase() ||
                    (c.companyName || '').toLowerCase() === nameToCheck.toLowerCase()
                );
                
                if (matchedCust) {
                    activeCustomer = matchedCust;
                } else {
                    const names = nameToCheck.split(' ');
                    activeCustomer = {
                        id: `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        forename: names[0],
                        surname: names.slice(1).join(' '),
                        email: linkedInquiry?.fromEmail || '',
                        phone: linkedInquiry?.fromPhone || '',
                        addressLine1: '',
                        city: '',
                        postcode: ''
                    };
                    isNewCustomer = true;
                }
            }

            // Auto-create vehicle if missing (only if registration is provided)
            if (!activeVehicle && parsedData?.vehicleRegistration) {
                const reg = parsedData.vehicleRegistration.toUpperCase().replace(/\s/g, '');
                activeVehicle = {
                    id: `veh_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    registration: reg,
                    make: 'Unknown',
                    model: 'Unknown',
                    year: new Date().getFullYear(),
                    colour: '',
                    customerId: activeCustomer?.id || ''
                };
                isNewVehicle = true;
            }

            if (!activeVehicle && !isEstimateMode) {
                setShowAddNewVehicle(true);
                return;
            } else if (!activeCustomer) {
                setError("Please provide a customer name in your request to continue.");
                return;
            }

            if (!selectedEntity) {
                setError("Business entity configuration missing. Please contact admin.");
                return;
            }

            const entityShortCode = selectedEntity.shortCode || 'UNK';
            const newEstimateId = `est_${Date.now()}`;
            
            // Check for standalone MOT
            const isStandaloneMOT = lineItems.length > 0 && 
                                   lineItems.every(li => /\bmot\b/i.test(li.servicePackageName || ''));

            const newEstimate: Estimate = {
                id: newEstimateId,
                estimateNumber: generateEstimateNumber(estimates, entityShortCode),
                entityId: selectedEntity.id,
                customerId: activeCustomer!.id,
                vehicleId: activeVehicle?.id || '',
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: isEstimateMode ? 'Draft' : 'Converted to Job',
                lineItems: lineItems.map(li => ({ ...li, isCourtesyCar: isStandaloneMOT })),
                notes: notes,
                createdByUserId: currentUser.id,
                jobId: isEstimateMode ? undefined : 'pending_creation' // Will be updated below
            };

            if (isEstimateMode) {
                if (isNewVehicle && activeVehicle) {
                    // Saves customer (new or existing), new vehicle, and estimate
                    onVehicleAndEstimateCreate(activeCustomer!, activeVehicle, newEstimate);
                } else if (isNewCustomer && onCustomerAndEstimateCreate) {
                    // Saves new customer and estimate (vehicle is either existing or null)
                    onCustomerAndEstimateCreate(activeCustomer!, newEstimate);
                } else {
                    onEstimateCreate(newEstimate);
                }
                handleClose();
                return;
            }

            // 2. Create Job (If Job Mode)
            const totalHours = lineItems.filter(li => li.isLabor).reduce((sum, li) => sum + li.quantity, 0);
            // Ensure at least 0.5 hours for any job so it gets a segment
            const validEstimatedHours = Math.max(0.5, totalHours);
            
            const newJobId = generateJobId(jobs, entityShortCode);
            
            const newJob: Job = {
                id: newJobId,
                entityId: selectedEntity.id,
                vehicleId: activeVehicle!.id,
                customerId: activeCustomer!.id,
                description: parsedData?.description || 'New Job',
                estimatedHours: validEstimatedHours,
                scheduledDate: selectedDate,
                status: 'Unallocated', // Initial status
                createdAt: getTodayISOString(),
                createdByUserId: currentUser.id,
                segments: [], // Generated below
                estimateId: newEstimate.id,
                notes: notes,
                vehicleStatus: 'Awaiting Arrival',
                partsStatus: lineItems.some(li => 
                    !li.fromStock &&
                    !li.isLabor && // Filter labor
                    !li.isOptional && // Filter optional/advisory
                    (!li.servicePackageId || li.isPackageComponent === true) &&
                    (li.unitCost || 0) > 0
                ) ? 'Awaiting Order' : 'Not Required',
                purchaseOrderIds: undefined,
                isStandalone: isStandaloneMOT
            };

            // CRITICAL: Generate segments based on the new job data so it appears on the timeline/unallocated list
            const segments = splitJobIntoSegments(newJob);
            newJob.segments = segments;
            
            // Link estimate to job
            newEstimate.jobId = newJobId;

            // Save everything
            if (isNewVehicle || isNewCustomer) {
                onVehicleAndJobCreate(activeCustomer!, activeVehicle!, newJob);
                onEstimateCreate(newEstimate); // We still need to save the estimate explicitly
            } else {
                onEstimateCreate(newEstimate);
                onJobCreate(newJob);
            }
            
            handleClose();
        } catch (e: any) {
            console.error("Failed to create job:", e);
            setError(`Failed to create: ${e.message}`);
        }
    };

    const handleSaveNewVehicleAndCreate = (newCustomer: Customer, newVehicle: Vehicle) => {
        try {
            setFoundVehicle(newVehicle);
            setFoundCustomer(newCustomer);
            setVehicleExists(true);
            
            const entityShortCode = selectedEntity?.shortCode || 'UNK';
            const newEstimateId = `est_${Date.now()}`;
            
            const isStandaloneMOT = lineItems.length > 0 && 
                                  lineItems.every(li => /\bmot\b/i.test(li.servicePackageName || ''));

            const newEstimate: Estimate = {
                id: newEstimateId,
                estimateNumber: generateEstimateNumber(estimates, entityShortCode),
                entityId: selectedEntity.id,
                customerId: newCustomer.id,
                vehicleId: newVehicle.id,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: isEstimateMode ? 'Draft' : 'Converted to Job',
                lineItems: lineItems.map(li => ({ ...li, isCourtesyCar: isStandaloneMOT })),
                notes: notes,
                createdByUserId: currentUser.id
            };

            if (isEstimateMode) {
                 onVehicleAndEstimateCreate(newCustomer, newVehicle, newEstimate);
            } else {
                 const totalHours = lineItems.filter(li => li.isLabor).reduce((sum, li) => sum + li.quantity, 0);
                 const validEstimatedHours = Math.max(0.5, totalHours);
                 
                 const newJobId = generateJobId(jobs, entityShortCode);
                 const newJob: Job = {
                    id: newJobId,
                    entityId: selectedEntity.id,
                    vehicleId: newVehicle.id,
                    customerId: newCustomer.id,
                    description: parsedData?.description || 'New Job',
                    estimatedHours: validEstimatedHours,
                    scheduledDate: selectedDate,
                    status: 'Unallocated',
                    createdAt: getTodayISOString(),
                    createdByUserId: currentUser.id,
                    segments: [],
                    estimateId: newEstimate.id,
                    notes: notes,
                    vehicleStatus: 'Awaiting Arrival',
                    partsStatus: lineItems.some(li => 
                        !li.fromStock &&
                        !li.isLabor && 
                        !li.isOptional && // Filter optional/advisory
                        li.type !== 'labor' &&
                        !li.description?.toLowerCase().includes('labour') &&
                        (!li.servicePackageId || li.isPackageComponent === true)
                    ) ? 'Awaiting Order' : 'Not Required',
                    isStandalone: isStandaloneMOT
                };
                
                newJob.segments = splitJobIntoSegments(newJob);
                
                newEstimate.jobId = newJobId;
                onVehicleAndJobCreate(newCustomer, newVehicle, newJob);
                onEstimateCreate(newEstimate); 
            }
            handleClose();
        } catch (e: any) {
            console.error("Failed to create new vehicle and job:", e);
            setError(`Failed to save: ${e.message}`);
        }
    };

    const handleClose = () => {
        onClose();
    };

    // --- Builder Actions ---
    
    const handleSelectPackage = (packageId: string) => {
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
        
        const { net, vat } = calculatePackagePrices(pkg, taxRates);
        const t99RateId = taxRates.find(t => t.code === 'T99')?.id;

        // FIX: Header cost set to 0. Children items will carry the cost.
        const headerItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: net,
            unitCost: 0, // Cost is distributed among children to avoid double counting
            isLabor: false,
            taxCodeId: pkg.taxCodeId || standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            preCalculatedVat: pkg.taxCodeId === t99RateId ? vat : undefined
        };
        const childItems: EstimateLineItem[] = (pkg.costItems || []).map(ci => {
            const part = (ci.partId ? parts.find(p => p.id === ci.partId) : null) || (ci.partNumber ? parts.find(p => p.partNumber === ci.partNumber) : null);
            
            const unitCost = ci.isLabor
                ? (selectedEntity?.laborCostRate || 0)
                : (part ? part.costPrice : (ci.unitCost || (ci.unitPrice ? ci.unitPrice * 0.8 : 0)));

            return {
                ...ci, 
                id: crypto.randomUUID(), 
                unitPrice: ci.unitPrice || 0, 
                unitCost: unitCost,
                partId: part ? part.id : ci.partId,
                servicePackageId: pkg.id, 
                servicePackageName: pkg.name, 
                isPackageComponent: true,
                supplierId: part?.defaultSupplierId || ci.supplierId,
                fromStock: ci.fromStock ?? (ci.isLabor ? true : (part?.isStockItem && part.stockQuantity > 0))
            };
        });
        setLineItems(prev => [...prev, headerItem, ...childItems]);
    };

    const handleAddLabor = () => {
        setLineItems(prev => [...prev, {
            id: crypto.randomUUID(),
            description: 'Labor',
            quantity: 1,
            unitPrice: selectedEntity.laborRate || 0,
            unitCost: selectedEntity.laborCostRate || 0,
            isLabor: true,
            fromStock: true,
            taxCodeId: standardTaxRateId
        }]);
    };

    const handleAddPart = () => {
        setLineItems(prev => [...prev, {
            id: crypto.randomUUID(),
            description: 'Part',
            quantity: 1,
            unitPrice: 0,
            unitCost: 0,
            isLabor: false,
            fromStock: false,
            taxCodeId: standardTaxRateId
        }]);
    };

    const handleRemoveLineItem = (id: string) => {
        const itemToRemove = lineItems.find(i => i.id === id);
        if (itemToRemove && itemToRemove.servicePackageId && !itemToRemove.isPackageComponent) {
            setLineItems(prev => prev.filter(li => li.servicePackageId !== itemToRemove.servicePackageId));
        } else {
            setLineItems(prev => prev.filter(li => li.id !== id));
        }
    };
    
    const handleLineItemChange = (id: string, field: keyof EstimateLineItem, value: any) => {
        setLineItems(prev => {
            let processedValue = value;
            if (['quantity', 'unitPrice', 'unitCost'].includes(field as string)) {
                 processedValue = value === '' ? '' : (parseFloat(value) || 0);
            }

            const targetItem = prev.find(i => i.id === id);
            if (!targetItem) return prev;

            let updatedLineItems = prev.map(item => {
                if (item.id === id) {
                    const updated = { ...item, [field]: processedValue };
                    if (field === 'unitPrice' && !item.isLabor) {
                        const parsedCost = parseFloat(item.unitCost as any);
                        if (!item.unitCost || parsedCost === 0) {
                            updated.unitCost = (parseFloat(processedValue) || 0) * 0.8;
                        }
                    }
                    return updated;
                }
                return item;
            });

            if (targetItem.isPackageComponent && targetItem.servicePackageId && ['quantity', 'unitPrice'].includes(field as string)) {
                const pkgId = targetItem.servicePackageId;
                const packageNetTotal = updatedLineItems
                    .filter(item => item.servicePackageId === pkgId && item.isPackageComponent)
                    .reduce((sum, item) => {
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.unitPrice) || 0;
                        return sum + (qty * price);
                    }, 0);

                if (packageNetTotal > 0) {
                    updatedLineItems = updatedLineItems.map(item =>
                        item.servicePackageId === pkgId && !item.isPackageComponent
                            ? { ...item, unitPrice: packageNetTotal }
                            : item
                    );
                }
            }

            if (targetItem && field === 'isOptional' && targetItem.servicePackageId && !targetItem.isPackageComponent) {
                updatedLineItems = updatedLineItems.map(item =>
                    item.servicePackageId === targetItem.servicePackageId && item.isPackageComponent
                        ? { ...item, isOptional: value as boolean }
                        : item
                );
            }

            return updatedLineItems;
        });
    };

    const handleCustomerSelect = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        setFoundCustomer(customer || null);
    };

    const handleToggleSpeakNotes = () => {
        if (isSpeaking) {
            cloudSpeechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            if (!notes.trim()) return;
            if (isSpeakingExplanation) {
                cloudSpeechSynthesis.cancel();
                setIsSpeakingExplanation(false);
            }
            const plainText = prepareTextForSpeech(notes);
            const utterance = new CloudSpeechSynthesisUtterance(plainText);
            
            const voices = cloudSpeechSynthesis.getVoices();
            const preferredVoice = findBestVoice(voices);
            utterance.voice = preferredVoice;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            cloudSpeechSynthesis.speak(utterance);
        }
    };

    const handleToggleSpeakExplanation = () => {
        if (isSpeakingExplanation) {
            cloudSpeechSynthesis.cancel();
            setIsSpeakingExplanation(false);
        } else {
            if (!parsedData?.explanation) return;
            if (isSpeaking) {
                cloudSpeechSynthesis.cancel();
                setIsSpeaking(false);
            }
            const plainText = prepareTextForSpeech(parsedData.explanation);
            const utterance = new CloudSpeechSynthesisUtterance(plainText);
            
            const voices = cloudSpeechSynthesis.getVoices();
            const preferredVoice = findBestVoice(voices);
            utterance.voice = preferredVoice;

            utterance.onstart = () => setIsSpeakingExplanation(true);
            utterance.onend = () => setIsSpeakingExplanation(false);
            utterance.onerror = () => setIsSpeakingExplanation(false);

            cloudSpeechSynthesis.speak(utterance);
        }
    };

    // --- Renderers ---

    const renderInitialPrompt = () => (
        <div>
            <p className="text-sm text-gray-600 mb-4">Describe the {isEstimateMode ? 'work required' : 'job'} in plain English. {defaultDate ? `Date is pre-selected as ${defaultDate}.` : `Try: "Book an MOT and a Minor Service for the Ford Transit REG123 for tomorrow."`}</p>
            <div className="relative">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Minor service for Porsche 911 (REG456), should take about 6 hours..."
                    rows={3}
                    className="w-full mt-1 p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <div className="absolute right-3 bottom-3">
                    <SpeechToTextButton 
                        onTranscript={(txt) => setPrompt(prev => prev + (prev ? ' ' : '') + txt)}
                    />
                </div>
            </div>
            <button
                onClick={() => handleParseRequest()}
                className="mt-4 w-full flex justify-center items-center py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-200"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 size={20} className="mr-2 animate-spin"/> : <Wand2 size={20} className="mr-2" />}
                {isLoading ? 'Analyzing...' : `Parse ${isEstimateMode ? 'Estimate' : 'Job'} Request`}
            </button>
        </div>
    );

    const renderItemRow = (item: EstimateLineItem) => {
        const isPackageComponent = item.isPackageComponent;
        const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

        if (isPackageHeader) {
            return (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border bg-indigo-50 border-indigo-200 transition-all hover:shadow-md mb-2">
                    <div className="col-span-5 flex items-center gap-2">
                        <div className="bg-indigo-600 text-white text-[10px] uppercase font-black px-1.5 py-0.5 rounded shadow-sm">Pkg</div>
                        <input 
                            type="text" 
                            value={item.description || ''} 
                            onChange={e => handleLineItemChange(item.id, 'description', e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 font-bold text-indigo-900 placeholder:text-indigo-300 text-sm"
                            placeholder="Package Description"
                        />
                    </div>
                    <div className="col-span-1">
                        <input 
                            type="number" 
                            step="0.1" 
                            value={item.quantity} 
                            onChange={e => handleLineItemChange(item.id, 'quantity', e.target.value)} 
                            className="w-full p-1 border border-indigo-100 rounded text-right text-sm bg-white" 
                        />
                    </div>
                    <div className="col-span-2 text-center text-[10px] text-indigo-400 font-bold uppercase tracking-widest bg-white/50 py-1 rounded">Package Total</div>
                    <div className="col-span-2">
                        <input 
                            type="number" 
                            step="0.01" 
                            value={item.unitPrice} 
                            onChange={e => handleLineItemChange(item.id, 'unitPrice', e.target.value)} 
                            className="w-full p-1 border border-indigo-100 rounded text-right text-sm bg-white font-bold text-indigo-800" 
                            placeholder="Sell" 
                        />
                    </div>
                    <div className="col-span-1 text-center text-xs text-indigo-500 font-medium">
                         {item.taxCodeId === 'tax_99' ? 'Mix' : 'T1'}
                    </div>
                    <div className="col-span-1 flex justify-center items-center gap-1">
                        <button onClick={() => handleRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 bg-white p-1 rounded-full shadow-sm hover:shadow transition-all"><Trash2 size={14} /></button>
                    </div>
                </div>
            );
        }

        return (
            <div key={item.id} className={`grid grid-cols-12 gap-2 items-start p-2 rounded-lg border text-sm transition-all shadow-sm ${isPackageComponent ? 'bg-gray-100' : 'bg-white border-gray-200'}`}>
                <div className="col-span-5 flex items-start gap-2">
                    {!isPackageComponent && (
                        <input 
                            type="checkbox" 
                            checked={item.isOptional || false} 
                            onChange={e => handleLineItemChange(item.id, 'isOptional', e.target.checked)}
                            className="h-4 w-4 mt-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                            title="Mark as Optional"
                        />
                    )}
                    <div className="w-full space-y-1">
                        <input 
                            type="text" 
                            placeholder="Part No." 
                            value={item.partNumber || ''} 
                            onChange={e => handleLineItemChange(item.id, 'partNumber', e.target.value)} 
                            className="w-full p-1 border rounded disabled:bg-gray-200 text-xs bg-white" 
                            disabled={item.isLabor} 
                        />
                        <textarea 
                            placeholder="Description" 
                            value={item.description || ''} 
                            onChange={e => handleLineItemChange(item.id, 'description', e.target.value)}
                            rows={1}
                            style={{ whiteSpace: 'pre-wrap', minHeight: '38px' }}
                            className="w-full p-1 border rounded text-xs bg-white resize-y-none overflow-hidden"
                        />
                    </div>
                </div>
                <div className="col-span-1">
                    <input 
                        type="number" 
                        step="0.1" 
                        value={item.quantity} 
                        onChange={e => handleLineItemChange(item.id, 'quantity', e.target.value)} 
                        className="w-full p-1 border rounded text-right text-sm bg-white" 
                    />
                </div>
                <div className="col-span-2">
                    <input 
                        type="number" 
                        step="0.01" 
                        value={item.unitCost || ''} 
                        onChange={e => handleLineItemChange(item.id, 'unitCost', e.target.value)} 
                        className="w-full p-1 border rounded text-right text-sm bg-white" 
                        placeholder="Cost" 
                    />
                </div>
                <div className="col-span-2">
                    <input 
                        type="number" 
                        step="0.01" 
                        value={item.unitPrice} 
                        onChange={e => handleLineItemChange(item.id, 'unitPrice', e.target.value)} 
                        className="w-full p-1 border rounded text-right text-sm bg-white font-bold text-indigo-700" 
                        placeholder="Sell" 
                    />
                </div>
                <div className="col-span-1">
                    <select
                        value={item.supplierId || ''}
                        onChange={e => handleLineItemChange(item.id, 'supplierId', e.target.value)}
                        className="w-full p-1 border rounded text-xs bg-white h-[30px]"
                        disabled={item.isLabor}
                    >
                        <option value="">-</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.shortCode || s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="col-span-1 flex justify-center items-center gap-1">
                    {!isPackageComponent && (
                        <button onClick={() => handleRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                    )}
                </div>
            </div>
        );
    };
    
    const renderBuilder = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
            {/* Left Column: Context Blocks */}
            <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2">
                 
                 {/* AI Estimate Breakdown Block */}
                 {parsedData?.explanation && (
                     <div className="bg-gradient-to-br from-indigo-50/50 to-white rounded-lg border border-indigo-100 shadow-sm p-4 space-y-2">
                         <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                             <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Bot size={16}/> AI Analysis & Breakdown</h3>
                             <button
                                 onClick={handleToggleSpeakExplanation}
                                 className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                                     isSpeakingExplanation 
                                         ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                         : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                 }`}
                                 title={isSpeakingExplanation ? "Stop Speaking" : "Read Aloud"}
                             >
                                 {isSpeakingExplanation ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                 {isSpeakingExplanation ? "Stop" : "Listen"}
                             </button>
                         </div>
                         <div className="text-xs text-gray-700 leading-relaxed max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                             <div className="prose prose-sm max-w-none prose-indigo prose-p:leading-relaxed prose-li:my-0 text-xs">
                                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsedData.explanation}</ReactMarkdown>
                             </div>
                         </div>
                     </div>
                 )}
                                 {/* Customer Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 space-y-2">
                     <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2"><User size={16}/> Customer</h3>
                     {foundCustomer ? (
                         <div className="text-sm space-y-1">
                             <div className="flex justify-between items-start">
                                 <p className="font-semibold text-indigo-700">{getCustomerDisplayName(foundCustomer)}</p>
                                 <button 
                                     onClick={() => {
                                         setFoundCustomer(null);
                                         setCustomerCreated(null);
                                         setFoundVehicle(null);
                                         setVehicleExists(false);
                                     }} 
                                     className="text-xs text-gray-400 hover:text-gray-600"
                                     title="Clear Customer"
                                 >
                                     <X size={14}/>
                                 </button>
                             </div>
                             <p className="flex items-center gap-2 text-gray-600"><Phone size={12}/> {foundCustomer.mobile || foundCustomer.phone || 'N/A'}</p>
                             <p className="flex items-center gap-2 text-gray-600"><Mail size={12}/> {foundCustomer.email || 'N/A'}</p>
                         </div>
                     ) : (
                         <div className="space-y-2">
                             <div className="p-2 bg-amber-50 text-amber-800 rounded text-sm mb-2">
                                 {parsedData?.customerName ? `AI Suggested: "${parsedData.customerName}"` : 'Customer not identified.'}
                             </div>
                             <SearchableSelect 
                                 options={customerOptions}
                                 initialValue={null}
                                 onSelect={(val) => val && handleCustomerSelect(val)}
                                 placeholder="Search existing customer..."
                             />
                             <div className="text-center text-xs text-gray-500">- OR -</div>
                             <button onClick={() => {
                                 if (isEstimateMode) {
                                     setIsCustomerModalOpen(true);
                                 } else {
                                     setShowAddNewVehicle(true);
                                 }
                             }} className="w-full py-1.5 text-xs bg-indigo-50 text-indigo-700 font-semibold rounded hover:bg-indigo-100">Create New Customer</button>
                         </div>
                     )}
                 </div>

                 {/* Vehicle Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 space-y-2">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2"><Car size={16}/> Vehicle</h3>
                    {foundVehicle ? (
                        <div className="text-sm space-y-1">
                            <div className="flex justify-between items-start">
                                <div className="p-2 bg-green-50 text-green-800 rounded text-sm mb-2 flex items-center gap-2">
                                    <Check size={14}/> <strong>{foundVehicle.registration}</strong>
                                </div>
                                <button 
                                    onClick={() => {
                                        setFoundVehicle(null);
                                        setVehicleExists(false);
                                    }} 
                                    className="text-xs text-gray-400 hover:text-gray-600 mt-2" 
                                    title="Change Vehicle"
                                >
                                    <X size={14}/>
                                </button>
                            </div>
                             <p className="text-gray-600 font-medium">{foundVehicle.make} {foundVehicle.model}</p>
                             <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100">
                                 <div>
                                     <label className="text-[10px] uppercase font-bold text-gray-400">VIN Number</label>
                                     <p className="text-xs font-mono bg-gray-50 p-1 rounded border overflow-hidden truncate" title={foundVehicle.vin}>{foundVehicle.vin || 'Not Set'}</p>
                                 </div>
                                 <div>
                                     <label className="text-[10px] uppercase font-bold text-gray-400">Next MOT Date</label>
                                     <p className={`text-xs p-1 rounded border ${foundVehicle.nextMotDate ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'}`}>
                                         {foundVehicle.nextMotDate || 'Missing'}
                                     </p>
                                 </div>
                             </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {foundCustomer && vehicles.filter(v => v.customerId === foundCustomer.id).length > 0 && (
                                <div className="space-y-1.5 pb-2 border-b border-gray-100">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 block">Customer's Existing Cars</label>
                                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                                        {vehicles.filter(v => v.customerId === foundCustomer.id).map(v => (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => {
                                                    setFoundVehicle(v);
                                                    setVehicleExists(true);
                                                }}
                                                className="w-full text-left p-2 rounded border bg-blue-50/50 hover:bg-blue-50 text-xs font-semibold text-blue-700 border-blue-100 flex justify-between items-center transition-colors"
                                            >
                                                <span>{v.registration}</span>
                                                <span className="text-[10px] text-blue-500 font-normal">{v.make} {v.model}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs border border-blue-100 flex flex-col gap-2">
                                 <p className="font-semibold flex items-center gap-1 text-indigo-900">
                                      <Info size={14} className="text-indigo-600" />
                                      Vehicle Details (Optional)
                                 </p>
                                 <p className="text-gray-600 leading-relaxed">
                                      A vehicle is not required. You can proceed with just customer details for non-vehicle related jobs/purchases.
                                 </p>
                                 {!showAddNewVehicle && (
                                     <button 
                                         onClick={() => setShowAddNewVehicle(true)} 
                                         className="w-full py-1.5 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 text-[11px] shadow-sm transition"
                                     >
                                         Add Vehicle Details
                                     </button>
                                 )}
                            </div>
                        </div>
                    )}
                 </div>

                 {/* Notes Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 flex-grow flex flex-col min-h-[150px]">
                     <div className="flex justify-between items-center border-b pb-2 mb-2">
                         <h3 className="font-bold text-gray-700 flex items-center gap-2"><FileText size={16}/> Notes</h3>
                         <div className="flex gap-2">
                             <SpeechToTextButton onTranscript={setNotes} />
                             {notes.trim() && (
                                 <button
                                     onClick={handleToggleSpeakNotes}
                                     className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                                         isSpeaking 
                                             ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                             : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                     }`}
                                     title={isSpeaking ? "Stop Speaking" : "Read Notes"}
                                 >
                                     {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                     {isSpeaking ? "Stop" : "Listen"}
                                 </button>
                             )}
                         </div>
                     </div>
                     <textarea 
                         value={notes} 
                         onChange={(e) => setNotes(e.target.value)} 
                         className="w-full flex-grow p-2 border rounded resize-none text-sm focus:ring-2 focus:ring-indigo-500"
                         placeholder="Job instructions..."
                     />
                 </div>

                 {/* Date & Capacity (Only in Job Mode) */}
                 {!isEstimateMode && (
                     <div className={`p-4 rounded-lg border bg-white shadow-sm ${capacityStats.isOver ? 'border-red-300' : ''}`}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                            <Calendar size={16}/> Scheduled Date
                        </label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-2 border rounded mb-3 bg-gray-50"/>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                                <span>Workshop Capacity</span>
                                <span className={capacityStats.isOver ? 'text-red-600' : 'text-gray-600'}>
                                    {capacityStats.totalProjected.toFixed(1)} / {capacityStats.max} hrs
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden flex">
                                <div className="bg-gray-500 h-2.5" style={{ width: `${Math.min(100, (capacityStats.allocated / capacityStats.max) * 100)}%` }} title="Existing Jobs"></div>
                                <div className={`h-2.5 ${capacityStats.isOver ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (capacityStats.currentJobHours / capacityStats.max) * 100)}%` }} title="This Job"></div>
                            </div>
                            {capacityStats.isOver && <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={12}/> Over Capacity!</p>}
                        </div>
                     </div>
                 )}
            </div>

            {/* Right Column: Line Items */}
            <div className="lg:col-span-2 flex flex-col h-full overflow-hidden border rounded-lg bg-gray-50">
                 {showAddNewVehicle ? (
                    <div className="p-4 overflow-y-auto">
                        <AddNewVehicleForm
                            initialRegistration={parsedData.vehicleRegistration}
                            initialCustomerId={foundCustomer?.id || null}
                            onSave={handleSaveNewVehicleAndCreate}
                            onCancel={() => setShowAddNewVehicle(false)}
                            customers={customers}
                            vehicles={vehicles}
                            saveButtonText={`Save & Create ${isEstimateMode ? 'Estimate' : 'Job'}`}
                        />
                    </div>
                 ) : (
                    <>
                        <div className="p-4 bg-white border-b flex-shrink-0">
                             <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><DollarSign size={18}/> Work Items & Costs</h3>
                             <div className="flex gap-2 mb-2">
                                <div className="flex-grow">
                                <SearchableSelect 
                                    options={sortedPackages}
                                    initialValue={null}
                                    onSelect={(val) => val && handleSelectPackage(val)}
                                    placeholder="+ Add Service Package..."
                                />
                                </div>
                             </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 space-y-4">
                            {lineItems.length === 0 ? (
                                <p className="text-center text-gray-400 italic py-10">No items added. Add packages or items to build the job.</p>
                            ) : (
                                <>
                                    {/* Grid Header */}
                                    <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                        <div className="col-span-5">Part / Description</div>
                                        <div className="col-span-1 text-right">Qty/Hrs</div>
                                        <div className="col-span-2 text-right">Cost</div>
                                        <div className="col-span-2 text-right">Sell</div>
                                        <div className="col-span-1 text-center">Supplier</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    {builderBreakdown.packages.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider border-b pb-1">Service Packages</h4>
                                            <div className="space-y-2">
                                                {builderBreakdown.packages.flatMap(({ header, children }) => [
                                                    renderItemRow(header),
                                                    ...children.map(child => renderItemRow(child))
                                                ])}
                                            </div>
                                        </div>
                                    )}

                                    {builderBreakdown.customLabor.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider border-b pb-1">Labour</h4>
                                            <div className="space-y-2">
                                                {builderBreakdown.customLabor.map(item => renderItemRow(item))}
                                            </div>
                                        </div>
                                    )}

                                    {builderBreakdown.customParts.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider border-b pb-1">Parts & Materials</h4>
                                            <div className="space-y-2">
                                                {builderBreakdown.customParts.map(item => renderItemRow(item))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Totals Summary Block directly below line items */}
                                    <div className="mt-6 border-t pt-4">
                                        <h4 className="font-bold text-gray-800 mb-2 text-sm">Totals Summary</h4>
                                        <div className="bg-white rounded-lg border shadow-sm p-4 space-y-1 text-sm">
                                             <div className="flex justify-between text-gray-600"><span>Total Cost Price:</span><span>{formatCurrency(totals.totalCost)}</span></div>
                                             <div className="flex justify-between text-gray-600"><span>Total Sale Price (Net):</span><span>{formatCurrency(totals.totalNet)}</span></div>
                                             <div className={`flex justify-between font-bold ${totals.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}><span>Total Profit:</span><span>{formatCurrency(totals.totalProfit)}</span></div>
                                             <div className="flex justify-between text-gray-600 border-b pb-2 mb-2"><span>Profit Margin:</span><span>{totals.profitMargin.toFixed(1)}%</span></div>
                                             {totals.vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-500 text-xs"><span>{b.rate === 'Mixed' ? b.name : `VAT @ ${b.rate}%`}</span><span>{formatCurrency(b.vat)}</span></div>))}
                                             <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Financial Summary Footer */}
                        <div className="p-4 bg-white border-t flex-shrink-0 space-y-3">
                             <div className="flex gap-2">
                                <button onClick={handleAddLabor} className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-semibold flex items-center gap-1"><Plus size={14}/> Labor</button>
                                <button onClick={handleAddPart} className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-semibold flex items-center gap-1"><Plus size={14}/> Part</button>
                            </div>
                            <div className="flex justify-between items-center font-bold text-lg text-gray-800">
                                <span>Grand Total:</span>
                                <span className="text-indigo-700">{formatCurrency(totals.grandTotal)}</span>
                            </div>
                            
                            <button 
                                onClick={handleFinalCreate} 
                                disabled={lineItems.length === 0 || (capacityStats.isOver && !isEstimateMode)}
                                className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all
                                    ${lineItems.length === 0 ? 'bg-gray-300 cursor-not-allowed' : capacityStats.isOver && !isEstimateMode ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}
                                `}
                            >
                                {capacityStats.isOver && !isEstimateMode ? <AlertTriangle size={20}/> : <Check size={20}/>}
                                {capacityStats.isOver && !isEstimateMode ? 'Over Capacity - Select different date' : `Confirm & Create ${isEstimateMode ? 'Estimate' : 'Job'}`}
                            </button>
                        </div>
                    </>
                 )}
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isEstimateMode ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            <Wand2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Smart {isEstimateMode ? 'Estimate' : 'Job'} Creator</h2>
                            <p className="text-sm text-gray-500">Describe the work, and AI will build it for you.</p>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-hidden p-6">
                    {!parsedData ? (
                         <div className="h-full flex flex-col justify-center items-center max-w-2xl mx-auto">
                            {renderInitialPrompt()}
                        </div>
                    ) : (
                        renderBuilder()
                    )}
                </div>
            </div>
            
            {isCustomerModalOpen && (
                <CustomerFormModal
                    isOpen={true}
                    onClose={() => setIsCustomerModalOpen(false)}
                    onSave={(newCustomer) => { handleSaveNewCustomer(newCustomer); setIsCustomerModalOpen(false); }}
                    customer={{
                        forename: parsedData?.customerName?.split(' ')[0] || linkedInquiry?.fromName?.split(' ')[0] || '',
                        surname: parsedData?.customerName?.split(' ').slice(1).join(' ') || linkedInquiry?.fromName?.split(' ').slice(1).join(' ') || '',
                        email: linkedInquiry?.fromEmail || '',
                        phone: linkedInquiry?.fromPhone || '',
                    }}
                    existingCustomers={customers}
                />
            )}
        </div>
    );
};

export default SmartCreateJobModal;
