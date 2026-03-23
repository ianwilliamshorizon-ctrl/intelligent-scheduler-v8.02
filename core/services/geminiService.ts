import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'europe-west1');
const generateContentCallable = httpsCallable(functions, 'generateContent');

/** 
 * ADD THIS BLOCK TO FIX THE "MISSING EXPORT" ERROR
 * Since you're using Firebase Functions, we just provide a "dummy" 
 * initializer so the rest of the app doesn't crash on boot.
 */
export const initializeGenerativeAI = (apiKey?: string) => {
    console.log("Gemini Service initialized via Firebase Functions");
    return { initialized: true }; 
};

export const generateContent = async (prompt: string): Promise<string> => {
    try {
        const result: any = await generateContentCallable({ prompt });
        return result.data;
    } catch (error) {
        console.error("Error calling generateContent function:", error);
        const anyError = error as any;
        if (anyError.code === 'functions/resource-exhausted') {
             return "The AI service is currently busy. Please try again in a moment.";
        }
        return "An error occurred while communicating with the AI service.";
    }
};

export const parseJobRequest = async (prompt: string): Promise<any> => {
    const rawResult = await generateContent(prompt);

    if (rawResult.startsWith("The AI service is currently busy") || rawResult.startsWith("An error occurred")) {
        throw new Error(rawResult);
    }

    try {
        const jsonStringMatch = rawResult.match(/```json\n([\s\S]*?)\n```/);
        if (jsonStringMatch && jsonStringMatch[1]) {
            return JSON.parse(jsonStringMatch[1]);
        }
        return JSON.parse(rawResult);
    } catch (error) {
        console.error("Error parsing JSON from AI response:", error);
        throw new Error("Failed to parse the AI's response. The format was unexpected.");
    }
};

export const generateServicePackageName = async (prompt: string): Promise<string> => {
    const name = await generateContent(prompt);
    return name.replace(/"/g, '').trim();
};