import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../../core/utils/cloudSpeech';
import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { generateContent } from '../../core/services/geminiService';
import { findBestVoice, prepareTextForSpeech } from '../../core/utils/speechUtils';

interface AIAssistantProps {
    financialData?: {
        totals: any;
        chartData: any[];
    };
}

const AIAssistant: React.FC<AIAssistantProps> = ({ financialData }) => {
    const { preferredVoiceName } = useApp();
    const activeUtterance = useRef<SpeechSynthesisUtterance | CloudSpeechSynthesisUtterance | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState('');
    const [responseMode, setResponseMode] = useState<'summary' | 'full'>('summary');
    const [voices, setVoices] = useState<any[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = cloudSpeechSynthesis.getVoices();
            if (availableVoices.length > 0) setVoices(availableVoices);
        };
        loadVoices();
        cloudSpeechSynthesis.onvoiceschanged = loadVoices;
        return () => { cloudSpeechSynthesis.onvoiceschanged = null; };
    }, []);

    const handleSpeak = (text: string) => {
        if (isSpeaking) {
            cloudSpeechSynthesis.cancel();
            setIsSpeaking(false);
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

        setTimeout(() => {
            const utterance = new CloudSpeechSynthesisUtterance(plainText);
            activeUtterance.current = utterance;
            if (selectedVoice) utterance.voice = selectedVoice;
            utterance.lang = 'en-GB';
            utterance.pitch = 0.95; 
            utterance.rate = 0.95;  
            
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => { setIsSpeaking(false); activeUtterance.current = null; };
            utterance.onerror = () => { setIsSpeaking(false); activeUtterance.current = null; };

            cloudSpeechSynthesis.speak(utterance);
        }, 100);
    };

    const { businessEntities } = useData();

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

    const handlePrompt = async (currentPrompt: string) => {
        if (!currentPrompt) return;
        setIsLoading(true);
        setResult('');

        // OPTIMIZATION: Use the dashboard's pre-calculated strategic data
        const summaryData = {
            currentOverview: financialData?.totals || {},
            strategicTrends: (financialData?.chartData || []).slice(-3), // Last 3 months context
            businessScale: {
                entities: businessEntities.map(e => ({ name: e.name, capacity: e.dailyCapacityHours }))
            }
        };

        const toneInstruction = "Use a smooth, charismatic, and velvety tone. You are exceptionally polished and professional, with a warm, engaging, and slightly charming personality. Think of yourself as a high-end strategic advisor who is both brilliant and very approachable.";
        const modeInstruction = responseMode === 'summary' 
            ? "Keep the response extremely brief and concise—just a quick summary of the most important point."
            : "Provide a detailed, data-driven insight with context and helpful observations.";

        const fullPrompt = `You are the Brookspeed Strategic Dashboard Assistant. 
        ${toneInstruction}
        
        Analyze the following financial summary and trends for the director.
        ${modeInstruction}
        
        Strategic Context:
        ${JSON.stringify(summaryData, null, 2)}
        
        Director's Question: "${currentPrompt}"
        
        Provide your insight now. Use bold text for key figures.`;

        try {
            const text = await generateContent(fullPrompt);
            setResult(text);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            setResult("I'm sorry, I hit a snag while looking at the data. Could you try asking that again in a slightly different way?");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePredisposedAction = (action: string) => {
        setPrompt(action);
        handlePrompt(action);
    };

    const onPromptButtonClick = () => {
        handlePrompt(prompt);
    }

    return (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md border border-indigo-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">AI Insights Assistant</h3>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setResponseMode('summary')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${responseMode === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Summary
                    </button>
                    <button 
                        onClick={() => setResponseMode('full')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${responseMode === 'full' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Full Detail
                    </button>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => handlePredisposedAction('Show me the total revenue for last month')} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100">Total Revenue Last Month</button>
                <button onClick={() => handlePredisposedAction('Which business entity has the most jobs?')} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100">Busiest Entity</button>
                <button onClick={() => handlePredisposedAction('What is the average job value?')} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100">Average Job Value</button>
            </div>

            <div className="flex gap-2">
                <input 
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onPromptButtonClick()}
                    placeholder="How can I help you understand your data today?"
                    className="flex-grow px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-all"
                />
                <button onClick={onPromptButtonClick} disabled={isLoading} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors shadow-sm">
                    {isLoading ? 'Thinking...' : 'Ask'}
                </button>
            </div>

            {result && (
                <div className="mt-4 p-5 bg-indigo-50/30 rounded-xl border border-indigo-100/50 relative group">
                    <button 
                        onClick={() => handleSpeak(result)}
                        className="absolute top-4 right-4 p-2 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-indigo-50 text-indigo-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={isSpeaking ? "Stop" : "Read Aloud"}
                    >
                        {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <div className="text-gray-700 leading-relaxed pr-10">{formatMessage(result)}</div>
                </div>
            )}
        </div>
    );

};

export default AIAssistant;
