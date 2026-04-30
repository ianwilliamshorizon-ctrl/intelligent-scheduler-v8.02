import React, { useState, useEffect } from 'react';
import { Prospect, SaleVehicle, Vehicle, Customer } from '../types';
import { X, Save, User, Link as LinkIcon, UserPlus, UserCheck, TrendingUp, Sparkles, Bot, Loader2, Repeat, Volume2, VolumeX } from 'lucide-react';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import CustomerFormModal from './CustomerFormModal';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { generateContent } from '../core/services/geminiService';
import { formatCurrency } from '../utils/formatUtils';
import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../core/utils/cloudSpeech';
import SpeechToTextButton from './shared/SpeechToTextButton';
import { prepareTextForSpeech } from '../core/utils/speechUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ProspectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (prospect: Prospect) => void;
    prospect: Prospect | null;
    entityId: string;
    saleVehicles: SaleVehicle[];
    vehicles: Vehicle[];
    customers: Customer[];
    onSaveCustomer: (customer: Customer) => void;
}

const ProspectFormModal: React.FC<ProspectFormModalProps> = ({ isOpen, onClose, onSave, prospect, entityId, saleVehicles, vehicles, customers, onSaveCustomer }) => {
    const [formData, setFormData] = useState<Partial<Prospect>>({});
    const [showCustomerLinker, setShowCustomerLinker] = useState(false);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [aiMessages, setAiMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [aiInput, setAiInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(prospect ? { ...prospect } : {
                entityId,
                name: '',
                phone: '',
                email: '',
                status: 'Active',
                desiredVehicle: '',
                notes: '',
                linkedSaleVehicleId: null,
                customerId: null,
            });
            setShowCustomerLinker(false);
            setIsCreatingCustomer(false);
            setAiMessages([]);
            setAiInput('');
            cloudSpeechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [isOpen, prospect, entityId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    };

    const handleLinkCustomer = (customerId: string) => {
        setFormData(p => ({ ...p, customerId, status: 'Converted' }));
        setShowCustomerLinker(false);
    };

    const handleUnlinkCustomer = () => {
        setFormData(p => ({ ...p, customerId: null, status: 'Active' }));
    };

    const handleSaveNewCustomer = (newCustomer: Customer) => {
        onSaveCustomer(newCustomer);
        handleLinkCustomer(newCustomer.id);
        setIsCreatingCustomer(false);
    };

    const handleSave = () => {
        if (!formData.name || !formData.phone) {
            alert('Prospect name and phone number are required.');
            return;
        }

        const prospectToSave: Prospect = {
            id: formData.id || crypto.randomUUID(),
            createdAt: formData.createdAt || new Date().toISOString(),
            ...formData
        } as Prospect;
        
        onSave(prospectToSave);
    };
    
    const handleGenerateAIAdvice = async (userPrompt?: string) => {
        if (isAnalyzing) return;
        
        setIsAnalyzing(true);
        const isFollowUp = !!userPrompt;
        const newMessages = [...aiMessages];
        
        if (isFollowUp) {
            newMessages.push({ role: 'user', text: userPrompt! });
            setAiMessages(newMessages);
            setAiInput('');
        }

        try {
            const linkedSale = formData.linkedSaleVehicleId ? saleVehicles.find(sv => sv.id === formData.linkedSaleVehicleId) : null;
            const linkedVehicle = linkedSale ? vehicles.find(v => v.id === linkedSale.vehicleId) : null;
            
            const systemContext = `You are a luxury car sales psychologist and conversion expert. 
            Prospect Details:
            - Name: ${formData.name}
            - Phone/Email: ${formData.phone} / ${formData.email || 'N/A'}
            - Interest: ${formData.desiredVehicle || 'General interest'}
            - Status: ${formData.status}
            - Prospecting Score: ${formData.prospectingScore || 0}%
            - Notes: ${formData.notes || 'No specific notes'}
            ${linkedVehicle ? `- Linked Stock: ${linkedVehicle.make} ${linkedVehicle.model} (${linkedVehicle.registration})` : ''}

            ${!isFollowUp ? "Provide a psychological sales report and conversion strategy for this prospect." : "Respond to the user's specific question about converting this prospect."}`;

            const fullPrompt = `${systemContext}\n\nConversation History:\n${newMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}\n\n${!isFollowUp ? 'INITIAL ANALYSIS REQUEST' : `USER QUESTION: ${userPrompt}`}`;

            const result = await generateContent(fullPrompt);
            setAiMessages([...newMessages, { role: 'model', text: result }]);
        } catch (error) {
            console.error("AI Advice Error:", error);
            setAiMessages([...newMessages, { role: 'model', text: "I encountered an error. Please try again." }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSpeakAdvice = (text: string) => {
        if (isSpeaking) {
            cloudSpeechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
        
        const plainText = prepareTextForSpeech(text);
        if (!plainText) return;
        
        const utterance = new CloudSpeechSynthesisUtterance(plainText);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        cloudSpeechSynthesis.speak(utterance);
    };

    const availableSaleVehicles = saleVehicles
        .filter(sv => sv.status === 'For Sale')
        .map(sv => {
            const vehicle = vehicles.find(v => v.id === sv.vehicleId);
            return {
                value: sv.id,
                label: `${vehicle?.registration} - ${vehicle?.make} ${vehicle?.model}`
            };
        });
    
    const linkedCustomer = customers.find(c => c.id === formData.customerId);

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            title={prospect ? 'Edit Prospect' : 'Add New Prospect'}
            maxWidth="max-w-2xl"
        >
            {isCreatingCustomer ? (
                <CustomerFormModal 
                    isOpen={true}
                    onClose={() => setIsCreatingCustomer(false)}
                    onSave={handleSaveNewCustomer}
                    customer={null}
                    existingCustomers={customers}
                />
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name*</label>
                            <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="status" value={formData.status || 'Active'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                <option>Active</option>
                                <option>Contacted</option>
                                <option>Converted</option>
                                <option>Archived</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone*</label>
                            <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Desired Vehicle</label>
                        <input name="desiredVehicle" value={formData.desiredVehicle || ''} onChange={handleChange} placeholder="e.g., Porsche 911 GT3 in silver" className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Link to Vehicle in Stock</label>
                        <SearchableSelect
                            options={availableSaleVehicles}
                            initialValue={formData.linkedSaleVehicleId || null}
                            onSelect={(value) => setFormData(p => ({ ...p, linkedSaleVehicleId: value }))}
                            placeholder="Link to a vehicle for sale..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <div className="relative">
                            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded pr-10" />
                            <div className="absolute right-2 top-2">
                                <SpeechToTextButton 
                                    onTranscript={(transcript) => setFormData(p => ({ ...p, notes: (p.notes || '') + (p.notes ? ' ' : '') + transcript }))}
                                    className="p-1 hover:bg-gray-100 rounded-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <TrendingUp size={16}/> Sales Prospecting Score (%)
                            </label>
                            <span className="text-lg font-black text-indigo-700">{formData.prospectingScore || 0}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            step="5"
                            value={formData.prospectingScore || 0} 
                            onChange={(e) => setFormData(p => ({ ...p, prospectingScore: parseInt(e.target.value) }))}
                            className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-indigo-400 mt-1 uppercase font-bold">
                            <span>Unlikely</span>
                            <span>Possible</span>
                            <span>Likely</span>
                            <span>Very Likely</span>
                            <span>Certain</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t">
                         <label className="block text-sm font-medium text-gray-700 mb-2">Customer Link</label>
                         {linkedCustomer ? (
                            <div className="p-3 bg-green-100 border border-green-200 rounded-lg flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <UserCheck size={20} className="text-green-700"/>
                                    <div>
                                        <p className="font-bold text-green-800">Converted & Linked</p>
                                        <p className="text-sm">{getCustomerDisplayName(linkedCustomer)}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={handleUnlinkCustomer} className="text-sm text-red-600 hover:underline">Unlink</button>
                            </div>
                         ) : showCustomerLinker ? (
                            <div className="p-3 bg-gray-100 border rounded-lg space-y-3 animate-fade-in">
                                <SearchableSelect
                                    options={customers.map(c => ({value: c.id, label: getCustomerDisplayName(c)}))}
                                    initialValue={null}
                                    onSelect={(val) => { if(val) handleLinkCustomer(val) }}
                                    placeholder="Search existing customers..."
                                />
                                 <div className="flex items-center gap-2">
                                    <div className="flex-grow border-t"></div>
                                    <span className="text-xs text-gray-500">OR</span>
                                    <div className="flex-grow border-t"></div>
                                </div>
                                <button type="button" onClick={() => setIsCreatingCustomer(true)} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border rounded-lg text-sm font-semibold hover:bg-gray-50">
                                    <UserPlus size={16}/> Create New Customer
                                </button>
                            </div>
                         ) : (
                            <button type="button" onClick={() => setShowCustomerLinker(true)} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition">
                                <LinkIcon size={16}/> Link to Customer & Mark as Converted
                            </button>
                         )}
                    </div>

                    <div className="pt-6 mt-6 border-t">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles size={18} className="text-indigo-600"/>
                            <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs">AI Prospect Assistant</h4>
                        </div>
                        
                        {!aiMessages.length ? (
                            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm text-center">
                                <Bot size={40} className="mx-auto text-indigo-300 mb-3"/>
                                <h5 className="font-bold text-indigo-900 mb-1">Align Vehicle to Customer</h5>
                                <p className="text-xs text-indigo-600 mb-4">Get AI-driven psychological sales advice tailored to this prospect's vehicle interest.</p>
                                <button 
                                    onClick={() => handleGenerateAIAdvice()}
                                    disabled={isAnalyzing || !formData.name}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md"
                                >
                                    {isAnalyzing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                                    {isAnalyzing ? 'Analyzing Prospect...' : 'Generate Sales Advice'}
                                </button>
                                {!formData.name && <p className="text-[10px] text-red-500 mt-2">Enter prospect name first</p>}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                                            <Bot size={16}/>
                                        </div>
                                        <div>
                                            <span className="block font-bold text-indigo-900 text-[10px] uppercase tracking-widest leading-none">Prospect Analysis</span>
                                            <span className="text-[9px] text-indigo-400 font-medium uppercase tracking-tighter">Live Strategic Chat</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setAiMessages([])} className="text-[10px] text-gray-400 uppercase font-bold hover:text-red-500 transition-colors bg-white px-2 py-1 rounded border border-gray-100 shadow-sm">Reset</button>
                                </div>

                                <div className="space-y-6 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                                    {aiMessages.map((msg, idx) => (
                                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`group relative max-w-[90%] p-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                                msg.role === 'user' 
                                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                                : 'bg-white border border-indigo-100 text-gray-800 rounded-bl-none'
                                            }`}>
                                                {msg.role === 'model' ? (
                                                    <div className="prose prose-sm max-w-none prose-indigo prose-p:leading-relaxed prose-li:my-0">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    msg.text
                                                )}
                                                
                                                {msg.role === 'model' && (
                                                    <div className="absolute -bottom-6 left-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleSpeakAdvice(msg.text)}
                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm ${
                                                                isSpeaking ? 'bg-red-500 text-white scale-105' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                            }`}
                                                        >
                                                            {isSpeaking ? <VolumeX size={12}/> : <Volume2 size={12}/>}
                                                            {isSpeaking ? 'Stop Audio' : 'Listen'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="h-4"></div>
                                        </div>
                                    ))}
                                    {isAnalyzing && (
                                        <div className="flex justify-start">
                                            <div className="bg-white border border-indigo-50 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                                                <div className="relative">
                                                    <Bot size={18} className="text-indigo-200"/>
                                                    <Loader2 size={18} className="animate-spin text-indigo-600 absolute inset-0"/>
                                                </div>
                                                <span className="text-xs text-indigo-400 font-medium animate-pulse">Analyzing...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-indigo-50 mt-4 bg-white p-2 rounded-xl shadow-inner">
                                    <div className="relative flex-grow">
                                        <textarea 
                                            value={aiInput}
                                            onChange={(e) => setAiInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleGenerateAIAdvice(aiInput);
                                                }
                                            }}
                                            placeholder="Ask about closing tactics or follow-up tips..."
                                            className="w-full p-2.5 text-sm border border-indigo-50 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none pr-12 min-h-[44px] max-h-32 bg-indigo-50/30"
                                            rows={1}
                                        />
                                        <div className="absolute right-2 top-2">
                                            <SpeechToTextButton 
                                                onTranscript={(text) => setAiInput(prev => prev + (prev ? ' ' : '') + text)}
                                                className="!p-1.5"
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleGenerateAIAdvice(aiInput)}
                                        disabled={isAnalyzing || !aiInput.trim()}
                                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md flex-shrink-0"
                                    >
                                        {isAnalyzing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </FormModal>
    );
};

export default ProspectFormModal;
