import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../core/utils/cloudSpeech';
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Bot, ClipboardCopy, Expand, Volume2, VolumeX } from 'lucide-react';
import { generateContent } from '../core/services/geminiService';
import { useApp } from '../core/state/AppContext';
import SpeechToTextButton from './shared/SpeechToTextButton';
import { findBestVoice, prepareTextForSpeech } from '../core/utils/speechUtils';
import { Estimate } from '../types';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

interface LiveAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string | null;
    onAddNote: (note: string) => void;
    onReviewPackage?: (estimate: Partial<Estimate>) => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose, jobId, onAddNote, onReviewPackage }) => {
    const { preferredVoiceName } = useApp();
    const [messages, setMessages] = useState<Message[]>([]);
    const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
    const [responseMode, setResponseMode] = useState<'summary' | 'full'>('summary');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [voices, setVoices] = useState<any[]>([]);

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = cloudSpeechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
            }
        };

        loadVoices();
        cloudSpeechSynthesis.onvoiceschanged = loadVoices;
        
        return () => {
            cloudSpeechSynthesis.onvoiceschanged = null;
            cloudSpeechSynthesis.cancel();
        };
    }, []);

    const speak = (text: string, messageId: string) => {
        if (isSpeaking === messageId) {
            cloudSpeechSynthesis.cancel();
            setIsSpeaking(null);
            return;
        }

        cloudSpeechSynthesis.cancel();
        
        const plainText = prepareTextForSpeech(text);
        if (!plainText) return;

        const selectedVoice = findBestVoice(voices, { 
            gender: 'female', 
            lang: 'en-GB',
            preferredVoiceName 
        });

        // Chunking for long text (browsers often have limits on single utterance length)

        // Chunking for long text (browsers often have limits on single utterance length)
        const chunks = plainText.match(/[^.!?]+[.!?]+|\s*[^.!?]+/g) || [plainText];
        
        let chunkIndex = 0;
        setIsSpeaking(messageId);

        const speakNextChunk = (isRetry = false) => {
            if (chunkIndex >= chunks.length) {
                setIsSpeaking(null);
                return;
            }

            const chunk = chunks[chunkIndex].trim();
            if (!chunk) {
                chunkIndex++;
                speakNextChunk();
                return;
            }

            const utterance = new CloudSpeechSynthesisUtterance(chunk);
            activeUtterance.current = utterance;
            
            // Premium voices in Edge can be fragile with pitch/rate settings
            const isPremium = selectedVoice?.name.toLowerCase().includes('natural') || 
                              selectedVoice?.name.toLowerCase().includes('online');

            utterance.lang = selectedVoice?.lang || 'en-GB';
            if (selectedVoice) utterance.voice = selectedVoice;
            
            if (!isPremium) {
                utterance.pitch = 0.95; 
                utterance.rate = 0.95;
            }
            utterance.volume = 1.0;

            utterance.onstart = () => console.log('LiveAssistant: Speech started');
            utterance.onend = () => {
                activeUtterance.current = null;
                chunkIndex++;
                speakNextChunk();
            };

            utterance.onerror = (e) => {
                console.error("LiveAssistant: Speech Synthesis Error:", e.error, e);
                activeUtterance.current = null;
                
                // If premium voice fails, attempt one-time fallback to standard local voice
                if (!isRetry && (e.error === 'synthesis-failed' || e.error === 'network')) {
                    console.warn('LiveAssistant: Premium voice failed. Falling back to local...');
                    const localFallback = voices.find(v => 
                        v.lang.startsWith(utterance.lang.split('-')[0]) && 
                        !v.name.toLowerCase().includes('natural') && 
                        !v.name.toLowerCase().includes('online')
                    );
                    if (localFallback) {
                        const retryUtterance = new CloudSpeechSynthesisUtterance(chunk);
                        activeUtterance.current = retryUtterance;
                        retryUtterance.voice = localFallback;
                        retryUtterance.onend = () => {
                            activeUtterance.current = null;
                            chunkIndex++;
                            speakNextChunk();
                        };
                        cloudSpeechSynthesis.speak(retryUtterance);
                        return;
                    }
                }
                
                setIsSpeaking(null);
            };

            if (cloudSpeechSynthesis.paused) cloudSpeechSynthesis.resume();
            cloudSpeechSynthesis.speak(utterance);
        };

        setIsSpeaking(messageId);
        setTimeout(() => speakNextChunk(), 150);
    };


    const formatMessage = (text: string) => {
        return text.split('\n').map((line, i) => {
            let processedLine = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^\* (.*)/, '• $1')
                .replace(/^# (.*)/, '<h3 class="font-bold text-base mt-2">$1</h3>');

            return (
                <div 
                    key={i} 
                    className={processedLine.trim() === '' ? 'h-3' : 'mb-1'}
                    dangerouslySetInnerHTML={{ __html: processedLine }} 
                />
            );
        });
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSendText = async () => {
        if (!textInput.trim() || isLoading) return;
        
        const currentText = textInput;
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: currentText }]);
        setTextInput('');
        setIsLoading(true);
        
        try {
            const toneInstruction = "You are the Brookspeed Master Technician. Your role is to advise other technicians on complex procedures, repair processes, and technical specifications with absolute authority and a smooth, charismatic confidence. Use a velvety, professional tone that is both brilliant and highly engaging. You are the expert's expert.";
            const modeInstruction = responseMode === 'summary' 
                ? "Keep the response extremely brief and concise—just the essential facts."
                : "Provide a complete and helpful response with relevant details and technical context.";

            const prompt = `You are a technician assistant at Brookspeed. 
            ${toneInstruction}
            ${modeInstruction}
            
            Job context: ${jobId || 'General'}. Provide clear specs and repair data. 
            User Question: ${currentText}`;

            const responseText = await generateContent(prompt);
    
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: responseText }]);

        } catch (error: any) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { 
                id: crypto.randomUUID(), 
                role: 'model', 
                text: "I'm sorry, I had a bit of trouble finding that info. Could you try asking again?"
            }]);
        } finally {
            setIsLoading(false);
        }
    };


    if (!isOpen) return null;

    const assistantContent = (
        <div className={`bg-white rounded-xl shadow-2xl flex flex-col transition-all ${isExpanded ? 'w-full max-w-4xl h-[90vh]' : 'w-full max-w-xl h-[700px]'}`}>
            <header className="flex justify-between items-center p-4 border-b bg-indigo-900 text-white rounded-t-xl">
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Bot size={22}/> Technician Assistant</h2>
                    <span className="text-[10px] text-indigo-300 font-mono tracking-tighter">SECURE CLOUD ENGINE</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-indigo-800/50 p-1 rounded-lg border border-indigo-700">
                        <button 
                            onClick={() => setResponseMode('summary')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${responseMode === 'summary' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-300 hover:text-white'}`}
                        >
                            Summary
                        </button>
                        <button 
                            onClick={() => setResponseMode('full')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${responseMode === 'full' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-300 hover:text-white'}`}
                        >
                            Full
                        </button>
                    </div>
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-white hover:text-gray-300">
                        <Expand size={20}/>
                    </button>
                    <button onClick={onClose} className="text-white hover:text-gray-300">
                        <X size={24}/>
                    </button>
                </div>
            </header>
            
            <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-gray-50">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-16">
                        <Bot size={56} className="mx-auto text-indigo-200 mb-3"/>
                        <p className="font-semibold text-gray-600 text-lg">How can I assist today?</p>
                        <p className="text-sm">Ask for torque specs, wiring, or procedures.</p>
                    </div>
                )}
                
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[92%] p-4 rounded-xl text-sm shadow-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-white border border-gray-200 rounded-bl-none text-gray-800'
                        }`}>
                            {formatMessage(msg.text)}
                        </div>
                        
                        {msg.role === 'model' && (
                            <div className="mt-2 flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        onAddNote(msg.text);
                                        onClose();
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors uppercase tracking-tight"
                                >
                                    <ClipboardCopy size={12} /> Save to Job Note
                                </button>
                                <button 
                                    onClick={() => speak(msg.text, msg.id)}
                                    className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded border transition-colors uppercase tracking-tight ${
                                        isSpeaking === msg.id 
                                            ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100' 
                                            : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-200'
                                    }`}
                                    title={isSpeaking === msg.id ? "Stop Speaking" : "Read Aloud"}
                                >
                                    {isSpeaking === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                    {isSpeaking === msg.id ? "Stop" : "Speak"}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start">
                         <div className="bg-white border p-4 rounded-xl rounded-bl-none shadow-sm">
                            <Loader2 size={18} className="animate-spin text-indigo-600"/>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-white rounded-b-xl">
                <div className="flex gap-3">
                    <input 
                        type="text" 
                        value={textInput} 
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        placeholder="Enter inquiry..." 
                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-inner" 
                        disabled={isLoading}
                    />
                    <SpeechToTextButton 
                        onTranscript={(transcript) => setTextInput(prev => prev + (prev ? ' ' : '') + transcript)}
                        className="h-[46px] w-[46px]"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSendText} 
                        disabled={!textInput.trim() || isLoading}
                        className="px-6 bg-indigo-900 text-white rounded-lg hover:bg-black transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4`}>
            {assistantContent}
        </div>
    );
};

export default LiveAssistant;
