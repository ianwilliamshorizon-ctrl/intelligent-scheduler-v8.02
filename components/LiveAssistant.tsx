import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
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
    onReviewPackage: (estimate: Partial<Estimate>) => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose, jobId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const getEnvVar = (key: string): string | undefined => {
        try {
            // @ts-ignore
            return (typeof process !== 'undefined' && process.env) ? process.env[key] : undefined;
        } catch (e) {
            return undefined;
        }
    };

    const handleSendText = async () => {
        if (!textInput.trim()) return;
        const currentText = textInput;
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: currentText }]);
        setTextInput('');
        setIsLoading(true);

        const apiKey = getEnvVar('API_KEY');
        if (!apiKey) {
             setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "System Error: API Key missing." }]);
             setIsLoading(false);
             return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Build context from recent messages to maintain flow
            const recentHistory = messages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
            const jobContext = jobId ? `Current Job Context: ${jobId}` : '';
            
            const prompt = `You are an expert automotive technician assistant at Brookspeed.
            
            ${jobContext}

            Conversation Context:
            ${recentHistory}
            
            User: ${currentText}
            
            Please provide a helpful, professional, and concise response.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            const text = response.text;
            if (text) {
                 setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: text }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Sorry, I couldn't process that request." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md h-[600px] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-indigo-600 text-white rounded-t-xl">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Bot size={20}/> Technician Assistant</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200"><X size={20}/></button>
                </header>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 mt-10">
                            <Bot size={48} className="mx-auto text-indigo-300 mb-2"/>
                            <p>How can I help you today?</p>
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none text-gray-800'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="bg-white border p-3 rounded-lg rounded-bl-none">
                                <Loader2 size={16} className="animate-spin text-gray-400"/>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t bg-white rounded-b-xl">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={textInput} 
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                            placeholder="Ask a technical question..." 
                            className="flex-grow p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleSendText} 
                            disabled={!textInput.trim() || isLoading}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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