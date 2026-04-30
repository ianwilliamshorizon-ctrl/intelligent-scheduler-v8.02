import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as textToSpeech from '@google-cloud/text-to-speech';

initializeApp();

// Lazy initialization helpers
let ttsClient: textToSpeech.TextToSpeechClient | undefined;
let genAI: GoogleGenerativeAI | undefined;

const getTtsClient = () => {
    if (!ttsClient) {
        ttsClient = new textToSpeech.TextToSpeechClient();
    }
    return ttsClient;
};

const getGenAI = () => {
    if (!genAI) {
        const geminiAPIKey = functions.config().gemini?.key;
        if (!geminiAPIKey) {
            console.error("Gemini API key not found in Firebase functions configuration!");
            return null;
        }
        genAI = new GoogleGenerativeAI(geminiAPIKey);
    }
    return genAI;
};

// On-call function to interact with the Gemini API
export const generateContent = functions.https.onCall(async (data, context) => {

    // Ensure the user is authenticated if necessary
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'The function must be called while authenticated.'
        );
    }

    const prompt = data.prompt;

    if (!prompt) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with a "prompt" argument.'
        );
    }

    try {
        const genAI = getGenAI();
        if (!genAI) {
          throw new Error("Gemini AI not initialized. Check API key configuration.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        return { text };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new functions.https.HttpsError('internal', 'Error generating content.');
    }
});

// On-call function for Google Cloud Text-to-Speech
export const synthesizeSpeech = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'The function must be called while authenticated.'
        );
    }

    const { text, voiceName, languageCode } = data;

    if (!text) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with a "text" argument.'
        );
    }

    try {
        const request = {
            input: { text: text },
            voice: { 
                languageCode: languageCode || 'en-GB', 
                name: voiceName || 'en-GB-Neural2-A' 
            },
            audioConfig: { audioEncoding: 'MP3' as const },
        };

        const [response] = await getTtsClient().synthesizeSpeech(request);
        
        if (!response.audioContent) {
             throw new Error('Failed to generate audio content');
        }

        // Return the base64 encoded audio
        return { 
            audioContent: Buffer.from(response.audioContent).toString('base64') 
        };
    } catch (error) {
        console.error("Error calling Google Cloud TTS API:", error);
        throw new functions.https.HttpsError('internal', 'Error generating speech.');
    }
});
