import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Bot, ClipboardCopy } from 'lucide-react';
import { createAssistantChat } from '../core/services/geminiService';
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

const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose, jobId, onAddNote }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
  

    // Formats raw markdown into readable UI
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
        if (!textInput.trim()) return;
        const currentText = textInput;
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: currentText }]);
        setTextInput('');
        setIsLoading(true);
        
        try {
            // ✅ Call our new service instead of Firebase Functions
            const chat = await createAssistantChat();
            const prompt = `You are a technician assistant at Brookspeed. 
            Job context: ${jobId || 'General'}. Provide clear specs and repair data. 
            User Question: ${currentText}`;
    
            const result = await chat.sendMessage(prompt);
            const response = await result.response;
            const responseText = response.text();
    
            if (responseText) {
                 setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: responseText }]);
            }
        } catch (error: any) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Assistant error. Please check your API key and connection." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl h-[700px] flex flex-col transition-all">
                
                <header className="flex justify-between items-center p-4 border-b bg-indigo-900 text-white rounded-t-xl">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Bot size={22}/> Technician Assistant
                        </h2>
                        <span className="text-[10px] text-indigo-300 font-mono tracking-tighter">SECURE</span>
                    </div>
                    <button onClick={onClose} className="text-white hover:text-gray-300">
                        <X size={24}/>
                    </button>
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
                            
                            {/* ADD TO NOTES BUTTON - Only for Assistant responses */}
                            {msg.role === 'model' && (
                                <button 
                                    onClick={() => onAddNote(msg.text)}
                                    className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors uppercase tracking-tight"
                                >
                                    <ClipboardCopy size={12} /> Save to Job Note
                                </button>
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
        </div>
    );
};

export default LiveAssistant;