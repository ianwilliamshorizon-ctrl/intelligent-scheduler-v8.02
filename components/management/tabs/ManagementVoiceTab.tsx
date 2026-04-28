import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../../../core/utils/cloudSpeech';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, CheckCircle, Info, Bot, Settings, Trash2, RefreshCw } from 'lucide-react';
import { useApp } from '../../../core/state/AppContext';
import { prepareTextForSpeech } from '../../../core/utils/speechUtils';

export const ManagementVoiceTab: React.FC = () => {
    const { preferredVoiceName, setPreferredVoiceName } = useApp();
    const [voices, setVoices] = useState<any[]>([]);
    const [showAllLanguages, setShowAllLanguages] = useState(false);
    const [testText, setTestText] = useState("Hello! I am the Brookspeed Assistant. How does my voice sound to you?");
    const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
    const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = cloudSpeechSynthesis.getVoices();
            if (showAllLanguages) {
                setVoices(availableVoices);
            } else {
                const enVoices = availableVoices.filter(v => v.lang.startsWith('en'));
                setVoices(enVoices.length > 0 ? enVoices : availableVoices);
            }
        };

        loadVoices();
        cloudSpeechSynthesis.onvoiceschanged = loadVoices;
        return () => { cloudSpeechSynthesis.onvoiceschanged = null; };
    }, [showAllLanguages]);

    const handleTestVoice = (voice: any, isRetry = false) => {
        cloudSpeechSynthesis.cancel();
        setIsSpeaking(voice.name);
        console.log(`${isRetry ? 'Retrying' : 'Testing'} voice:`, voice.name, voice.lang);

        setTimeout(() => {
            const plainText = prepareTextForSpeech(testText);
            if (!plainText) return;

            const utterance = new CloudSpeechSynthesisUtterance(plainText);
            
            utterance.lang = voice.lang;
            utterance.voice = voice;
            utterance.volume = 1.0;

            // Some premium Edge voices are very sensitive to pitch/rate changes
            const isPremium = voice.name.toLowerCase().includes('natural') || voice.name.toLowerCase().includes('online');
            if (!isPremium) {
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
            }

            utterance.onstart = () => console.log('Speech started...');
            utterance.onend = () => {
                setIsSpeaking(null);
                activeUtterance.current = null;
            };
            utterance.onerror = (event) => {
                console.error('Speech Error:', event.error, event);
                setIsSpeaking(null);
                activeUtterance.current = null;

                // Fallback logic for 'synthesis-failed' on Premium voices
                if (!isRetry && (event.error === 'synthesis-failed' || event.error === 'network')) {
                    console.warn('Premium voice failed. Attempting fallback to local voice...');
                    const localFallback = voices.find(v => 
                        v.lang.startsWith(voice.lang.split('-')[0]) && 
                        !v.name.toLowerCase().includes('natural') && 
                        !v.name.toLowerCase().includes('online')
                    );
                    if (localFallback) {
                        setTimeout(() => handleTestVoice(localFallback, true), 100);
                    }
                }
            };

            activeUtterance.current = utterance;
            if (cloudSpeechSynthesis.paused) cloudSpeechSynthesis.resume();
            cloudSpeechSynthesis.speak(utterance);
        }, 150);
    };

    const handleSelectVoice = (voiceName: string) => {
        setPreferredVoiceName(voiceName);
    };

    const handleReset = () => {
        setPreferredVoiceName(null);
    };

    const sortedVoices = [...voices].sort((a, b) => {
        const premiumKeywords = ['natural', 'online', 'google', 'enhanced', 'neural', 'premium', 'vivid'];
        const aIsNatural = premiumKeywords.some(k => a.name.toLowerCase().includes(k));
        const bIsNatural = premiumKeywords.some(k => b.name.toLowerCase().includes(k));
        if (aIsNatural && !bIsNatural) return -1;
        if (!aIsNatural && bIsNatural) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <Bot size={28} className="text-indigo-300" />
                        <h3 className="text-xl font-bold">AI Voice Configuration</h3>
                    </div>
                    <p className="text-indigo-100 text-sm max-w-2xl">
                        Select the voice used by the Technician Assistant and for reading back job notes. 
                        "Natural" and "Online" voices provide the smoothest, most professional experience.
                    </p>
                </div>
                <div className="absolute top-[-20px] right-[-20px] opacity-10">
                    <Volume2 size={160} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h4 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Available Voices ({voices.length})</h4>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setShowAllLanguages(!showAllLanguages)}
                                className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-tighter transition-all ${showAllLanguages ? 'text-indigo-600' : 'text-gray-400'}`}
                            >
                                {showAllLanguages ? 'Showing All Languages' : 'Show All Languages'}
                            </button>
                            <button 
                                onClick={() => {
                                    const availableVoices = cloudSpeechSynthesis.getVoices();
                                    const enVoices = availableVoices.filter(v => v.lang.startsWith('en'));
                                    setVoices(enVoices.length > 0 ? enVoices : availableVoices);
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-tighter transition-all"
                            >
                                <RefreshCw size={12} /> Refresh Voices
                            </button>
                            <button 
                                onClick={handleReset}
                                className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 uppercase tracking-tighter transition-all"
                            >
                                <Trash2 size={12} /> Reset to Smart Default
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {sortedVoices.map((voice) => {
                            const isSelected = preferredVoiceName === voice.name;
                            const isNatural = voice.name.toLowerCase().includes('natural') || 
                                              voice.name.toLowerCase().includes('online') || 
                                              voice.name.toLowerCase().includes('google') ||
                                              voice.name.toLowerCase().includes('enhanced') ||
                                              voice.name.toLowerCase().includes('neural') ||
                                              voice.name.toLowerCase().includes('premium') ||
                                              voice.name.toLowerCase().includes('vivid');
                            
                            return (
                                <div 
                                    key={voice.name}
                                    className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${
                                        isSelected 
                                            ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' 
                                            : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            {isSelected ? <CheckCircle size={20} /> : <Volume2 size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                    {voice.name}
                                                </span>
                                                {isNatural && (
                                                    <span className="bg-green-100 text-green-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-green-200">Premium</span>
                                                )}
                                                {voice.localService && (
                                                    <span className="bg-blue-100 text-blue-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-blue-200">Local</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{voice.lang} • {voice.name.includes('Female') ? 'Female' : voice.name.includes('Male') ? 'Male' : 'Standard'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleTestVoice(voice)}
                                            className={`p-2 rounded-lg border transition-all ${
                                                isSpeaking === voice.name 
                                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                                    : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'
                                            }`}
                                            title="Test Voice"
                                        >
                                            {isSpeaking === voice.name ? <Play size={16} className="animate-pulse fill-current" /> : <Play size={16} />}
                                        </button>
                                        {!isSelected && (
                                            <button 
                                                onClick={() => handleSelectVoice(voice.name)}
                                                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                                            >
                                                Select
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Settings size={18} className="text-gray-500" />
                            <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Voice Preview Settings</h4>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Test Sentence</label>
                                <textarea 
                                    value={testText}
                                    onChange={(e) => setTestText(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white min-h-[100px] resize-none"
                                />
                            </div>

                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                <div className="flex items-start gap-3">
                                    <Info size={16} className="text-indigo-500 mt-0.5" />
                                    <div className="space-y-2">
                                        <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                                            Premium voices (marked in green) offer significantly more realistic speech. 
                                        </p>
                                        <p className="text-[11px] text-indigo-700 leading-relaxed font-bold">
                                            Tip: Microsoft Edge provides the largest selection of "Natural" online voices.
                                        </p>
                                        <p className="text-[10px] text-indigo-500 leading-relaxed italic">
                                            Note: Celebrity voices are not provided by browsers natively. To use custom or celebrity voices, you must install third-party TTS software on your computer.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {preferredVoiceName && (
                        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-fade-in">
                            <h4 className="font-bold text-indigo-900 text-sm mb-3">Active Preference</h4>
                            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="bg-indigo-600 text-white p-2 rounded-lg">
                                    <Bot size={16} />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-xs font-bold text-indigo-900 truncate max-w-[150px]">{preferredVoiceName}</p>
                                    <p className="text-[10px] text-indigo-500 font-bold uppercase">System Priority #1</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
