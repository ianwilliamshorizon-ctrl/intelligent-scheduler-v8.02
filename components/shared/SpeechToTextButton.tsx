import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../core/services/firebaseServices';

interface SpeechToTextButtonProps {
    onTranscript: (transcript: string) => void;
    className?: string;
    disabled?: boolean;
}

const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({ onTranscript, className = '', disabled }) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<BlobPart[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                // Fallback if webm is not supported (e.g., Safari)
                options = { mimeType: '' } as any; 
            }
            
            try {
                 mediaRecorder.current = new MediaRecorder(stream, options);
            } catch (e) {
                 mediaRecorder.current = new MediaRecorder(stream);
            }

            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.current.push(event.data);
                }
            };

            mediaRecorder.current.onstop = async () => {
                setIsListening(false);
                setIsProcessing(true);
                
                const audioBlob = new Blob(audioChunks.current);
                audioChunks.current = [];
                
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());

                try {
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        const base64Audio = reader.result?.toString().split(',')[1];
                        if (base64Audio) {
                            const functions = getFunctions(app, 'europe-west1');
                            const transcribeCloudSpeechCallable = httpsCallable(functions, 'transcribeSpeech');
                            const result = await transcribeCloudSpeechCallable({ audioContent: base64Audio });
                            const data = result.data as any;
                            if (data.text) {
                                onTranscript(data.text);
                            }
                        }
                        setIsProcessing(false);
                    };
                } catch (error) {
                    console.error("Cloud STT Error:", error);
                    setIsProcessing(false);
                }
            };

            audioChunks.current = [];
            mediaRecorder.current.start();
            setIsListening(true);
        } catch (err) {
            console.error('Failed to get user media', err);
            alert('Microphone access is required for voice-to-text.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && isListening) {
            mediaRecorder.current.stop();
        }
    };

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isListening]);

    return (
        <button
            type="button"
            onClick={toggleListening}
            disabled={disabled || isProcessing}
            className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                isProcessing
                    ? '!bg-indigo-200 !text-indigo-700 cursor-wait'
                    : isListening 
                        ? '!bg-red-500 !text-white animate-pulse shadow-lg scale-110' 
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
            title={isListening ? 'Stop Recording' : isProcessing ? 'Processing Speech...' : 'Start Voice to Text'}
        >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
    );
};

export default SpeechToTextButton;
