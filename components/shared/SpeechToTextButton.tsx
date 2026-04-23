import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface SpeechToTextButtonProps {
    onTranscript: (transcript: string) => void;
    className?: string;
    disabled?: boolean;
}

const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({ onTranscript, className = '', disabled }) => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            setIsSupported(true);
            const recognitionInstance = new SpeechRecognition();
            recognitionInstance.continuous = false;
            recognitionInstance.interimResults = false;
            recognitionInstance.lang = 'en-GB';

            recognitionInstance.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    onTranscript(transcript);
                }
                setIsListening(false);
            };

            recognitionInstance.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognitionInstance.onend = () => {
                setIsListening(false);
            };

            setRecognition(recognitionInstance);
        }
    }, [onTranscript]);

    const toggleListening = useCallback(() => {
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                setIsListening(true);
            } catch (err) {
                console.error('Failed to start recognition:', err);
                setIsListening(false);
            }
        }
    }, [recognition, isListening]);

    if (!isSupported) {
        return (
            <button
                type="button"
                onClick={() => alert('Voice-to-Text is not supported by your current browser (e.g. Firefox). Please use Chrome, Edge, or Safari for this feature.')}
                className={`p-2 rounded-full bg-gray-100 text-gray-400 cursor-help ${className}`}
                title="Voice-to-Text not supported in this browser"
            >
                <Mic size={18} />
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className={`p-2 rounded-full transition-all duration-200 ${
                isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg scale-110' 
                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
            title={isListening ? 'Stop Recording' : 'Start Voice to Text'}
        >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
    );
};

export default SpeechToTextButton;
