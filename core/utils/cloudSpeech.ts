import { app } from '../services/firebaseServices';
import { getFunctions, httpsCallable } from 'firebase/functions';

class MockSpeechSynthesisVoice {
    name: string;
    lang: string;
    localService: boolean = false;
    default: boolean = false;
    voiceURI: string = '';

    constructor(name: string, lang: string) {
        this.name = name;
        this.lang = lang;
        this.voiceURI = name;
    }
}

export const CLOUD_VOICES = [
    // Journey Voices
    new MockSpeechSynthesisVoice('Google Cloud Premium Journey F (Female, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Journey D (Male, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Journey F (Female, UK)', 'en-GB'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Journey D (Male, UK)', 'en-GB'),
    
    // Neural2 UK
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 A (Female, UK)', 'en-GB'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 B (Male, UK)', 'en-GB'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 C (Female, UK)', 'en-GB'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 D (Male, UK)', 'en-GB'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 F (Female, UK)', 'en-GB'),

    // Neural2 US
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 A (Male, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 C (Female, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 D (Male, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 E (Female, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 F (Female, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 G (Female, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 H (Female, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 I (Male, US)', 'en-US'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 J (Male, US)', 'en-US'),

    // Neural2 Australia
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 A (Female, AU)', 'en-AU'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 B (Male, AU)', 'en-AU'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 C (Female, AU)', 'en-AU'),
    new MockSpeechSynthesisVoice('Google Cloud Premium Neural2 D (Male, AU)', 'en-AU'),
];

export class CloudSpeechSynthesisUtterance {
    text: string;
    lang: string = 'en-US';
    voice: any = null;
    volume: number = 1.0;
    rate: number = 1.0;
    pitch: number = 1.0;

    onstart: ((e: any) => void) | null = null;
    onend: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;

    constructor(text: string) {
        this.text = text;
    }
}

class CloudSpeechSynthesis {
    paused = false;
    pending = false;
    speaking = false;
    onvoiceschanged: (() => void) | null = null;
    
    private currentAudio: HTMLAudioElement | null = null;
    private currentUtterance: CloudSpeechSynthesisUtterance | null = null;

    getVoices() {
        return CLOUD_VOICES as any;
    }

    cancel() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        this.speaking = false;
        this.pending = false;
    }

    resume() {}
    pause() {}

    async speak(utterance: CloudSpeechSynthesisUtterance) {
        this.speaking = true;
        this.currentUtterance = utterance;
        
        try {
            if (utterance.onstart) utterance.onstart(new Event('start'));

            const functions = getFunctions(app, 'europe-west1');
            const synthesizeCloudSpeechCallable = httpsCallable(functions, 'synthesizeSpeech');
            
            const voiceMap: Record<string, {name: string, lang: string}> = {
                'Google Cloud Premium Journey F (Female, US)': { name: 'en-US-Journey-F', lang: 'en-US'},
                'Google Cloud Premium Journey D (Male, US)': { name: 'en-US-Journey-D', lang: 'en-US'},
                'Google Cloud Premium Journey F (Female, UK)': { name: 'en-GB-Journey-F', lang: 'en-GB'},
                'Google Cloud Premium Journey D (Male, UK)': { name: 'en-GB-Journey-D', lang: 'en-GB'},

                'Google Cloud Premium Neural2 A (Female, UK)': { name: 'en-GB-Neural2-A', lang: 'en-GB'},
                'Google Cloud Premium Neural2 B (Male, UK)': { name: 'en-GB-Neural2-B', lang: 'en-GB'},
                'Google Cloud Premium Neural2 C (Female, UK)': { name: 'en-GB-Neural2-C', lang: 'en-GB'},
                'Google Cloud Premium Neural2 D (Male, UK)': { name: 'en-GB-Neural2-D', lang: 'en-GB'},
                'Google Cloud Premium Neural2 F (Female, UK)': { name: 'en-GB-Neural2-F', lang: 'en-GB'},

                'Google Cloud Premium Neural2 A (Male, US)': { name: 'en-US-Neural2-A', lang: 'en-US'},
                'Google Cloud Premium Neural2 C (Female, US)': { name: 'en-US-Neural2-C', lang: 'en-US'},
                'Google Cloud Premium Neural2 D (Male, US)': { name: 'en-US-Neural2-D', lang: 'en-US'},
                'Google Cloud Premium Neural2 E (Female, US)': { name: 'en-US-Neural2-E', lang: 'en-US'},
                'Google Cloud Premium Neural2 F (Female, US)': { name: 'en-US-Neural2-F', lang: 'en-US'},
                'Google Cloud Premium Neural2 G (Female, US)': { name: 'en-US-Neural2-G', lang: 'en-US'},
                'Google Cloud Premium Neural2 H (Female, US)': { name: 'en-US-Neural2-H', lang: 'en-US'},
                'Google Cloud Premium Neural2 I (Male, US)': { name: 'en-US-Neural2-I', lang: 'en-US'},
                'Google Cloud Premium Neural2 J (Male, US)': { name: 'en-US-Neural2-J', lang: 'en-US'},

                'Google Cloud Premium Neural2 A (Female, AU)': { name: 'en-AU-Neural2-A', lang: 'en-AU'},
                'Google Cloud Premium Neural2 B (Male, AU)': { name: 'en-AU-Neural2-B', lang: 'en-AU'},
                'Google Cloud Premium Neural2 C (Female, AU)': { name: 'en-AU-Neural2-C', lang: 'en-AU'},
                'Google Cloud Premium Neural2 D (Male, AU)': { name: 'en-AU-Neural2-D', lang: 'en-AU'},
            };
            
            const selectedVoice = utterance.voice?.name ? voiceMap[utterance.voice.name] : { name: 'en-US-Journey-F', lang: 'en-US' };
            const effectiveVoice = selectedVoice || { name: 'en-US-Journey-F', lang: 'en-US' };

            const result = await synthesizeCloudSpeechCallable({ 
                text: utterance.text, 
                voiceName: effectiveVoice.name, 
                languageCode: effectiveVoice.lang 
            });
            
            const data = result.data as any;
            this.currentAudio = new Audio("data:audio/mp3;base64," + data.audioContent);
            
            this.currentAudio.onended = () => {
                this.speaking = false;
                if (utterance.onend) utterance.onend(new Event('end'));
            };
            
            this.currentAudio.onerror = (e) => {
                this.speaking = false;
                if (utterance.onerror) utterance.onerror(new Event('error'));
            }

            await this.currentAudio.play();

        } catch (e: any) {
            console.error("Cloud TTS Error:", e);
            this.speaking = false;
            // Fire onerror with a mock event
            if (utterance.onerror) utterance.onerror({ error: 'synthesis-failed' } as any);
        }
    }
}

export const cloudSpeechSynthesis = new CloudSpeechSynthesis();
