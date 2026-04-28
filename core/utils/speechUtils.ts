import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../../core/utils/cloudSpeech';

export const SPEECH_SETTINGS_KEY = 'brookspeed_preferred_voice';

export interface VoiceSelectionOptions {
    gender?: 'male' | 'female';
    lang?: string;
    preferredVoiceName?: string | null;
}

/**
 * Finds the best available speech synthesis voice based on quality and preference.
 * Prioritizes "Natural" and "Online" voices (Chrome/Edge premium voices).
 */
export const findBestVoice = (voices: any[], options: VoiceSelectionOptions = {}): any | null => {
    if (!voices || voices.length === 0) return null;

    const { gender = 'female', lang = 'en-GB', preferredVoiceName } = options;

    // 0. Priority: User selected preferred voice
    if (preferredVoiceName) {
        const preferred = voices.find(v => v.name === preferredVoiceName);
        if (preferred) return preferred;
    }

    // 1. Try to find a high-quality "Natural" or "Online" voice with preferred gender and language
    let selected = voices.find(v => 
        v.lang.startsWith(lang) && 
        v.name.toLowerCase().includes(gender) && 
        (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('google'))
    );

    // 2. Try any "Natural" voice with preferred gender
    if (!selected) {
        selected = voices.find(v => 
            v.name.toLowerCase().includes(gender) && 
            (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('google'))
        );
    }

    // 3. Try any voice with preferred gender and language
    if (!selected) {
        selected = voices.find(v => v.lang.startsWith(lang) && v.name.toLowerCase().includes(gender));
    }

    // 4. Try any voice with preferred gender
    if (!selected) {
        selected = voices.find(v => v.name.toLowerCase().includes(gender));
    }

    // 5. Fallback to any voice with preferred language
    if (!selected) {
        selected = voices.find(v => v.lang.startsWith(lang));
    }

    // 6. Final fallback
    return selected || voices[0];
};

/**
 * Standardizes text for speech synthesis by removing markdown and artifacts.
 */
export const prepareTextForSpeech = (text: string): string => {
    if (!text) return '';
    
    return text
        .replace(/```[\s\S]*?```/g, ' ') // Remove code blocks
        .replace(/\|.*?\|/g, ' ')       // Remove table rows
        .replace(/<[^>]*>?/gm, '')      // Strip HTML tags
        .replace(/\*\*/g, '')           // Strip bold markers
        .replace(/\*/g, '')             // Strip bullet markers
        .replace(/#/g, '')              // Strip headers
        .replace(/^\* /gm, '')          // Strip list bullets at start of lines
        .replace(/^- /gm, '')           // Strip alternative list bullets
        .replace(/\n+/g, ' ')           // Convert newlines to spaces for smoother flow
        .trim();
};
