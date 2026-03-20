import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'europe-west1');
const generateContentCallable = httpsCallable(functions, 'generateContent');

export const generateContent = async (prompt: string): Promise<string> => {
    try {
        const result: any = await generateContentCallable({ prompt });
        return result.data;
    } catch (error) {
        console.error("Error calling generateContent function:", error);
        if (error.code === 'functions/resource-exhausted') {
             return "The AI service is currently busy. Please try again in a moment.";
        }
        return "An error occurred while communicating with the AI service.";
    }
};
