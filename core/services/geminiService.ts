import { getFunctions, httpsCallable } from 'firebase/functions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ServicePackage, EstimateLineItem, Part } from '../../types';

const functions = getFunctions(undefined, 'europe-west1');
const generate = httpsCallable(functions, 'generate');

let genAI: GoogleGenerativeAI | null = null;

export const initializeGenerativeAI = (apiKey: string) => {
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
    } else {
        console.error("API key is missing. Generative AI features will be disabled.");
    }
};

async function generateWithRetry(modelName: string, prompt: string, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result: any = await generate({ prompt, modelName });
      return result.data.text;
    } catch (error: any) {
      if (i === retries) throw error;
      console.warn(`AI Attempt ${i + 1} failed for ${modelName}, retrying...`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

export const getAIAssistantResponse = async (prompt: string, dataContext: string): Promise<string> => {
    const fullPrompt = `Based on the following data, answer the question: "${prompt}"\n\nData:\n${dataContext}`;

    try {
        const text = await generateWithRetry("gemini-1.5-flash-latest", fullPrompt);
        return text || "Sorry, I could not generate a response.";
    } catch (error) {
        console.error("AI Error (Assistant):", error);
        throw error;
    }
};

export const parseJobRequest = async (
    prompt: string, 
    servicePackages: ServicePackage[], 
    contextDate: string, 
    vehicleInfo?: { make: string; model: string; }
): Promise<any> => {
    const knownPackages = servicePackages.map(p => `- ${p.name}`).join('\n');
    const fullPrompt = `Date: ${contextDate}\nVehicle: ${vehicleInfo?.make || 'Unknown'}\nPackages: ${knownPackages}\nRequest: "${prompt}"\nReturn JSON only.`;

    try {
        const text = await generateWithRetry("gemini-1.5-pro-latest", fullPrompt);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("AI Error (Job Request):", error);
        throw error;
    }
};

export const generateServicePackageName = async (
    lineItems: EstimateLineItem[],
    vehicleMake: string,
    vehicleModel: string,
    engineSize?: number
): Promise<{ name: string; description: string }> => {
    const itemsDescription = (lineItems || []).map(item => `- ${item.description}`).join('\n');
    const vehicleIdentifier = `${vehicleMake} ${vehicleModel}` + (engineSize ? ` (${engineSize}cc)` : '');
    const fullPrompt = `Generate a concise service name and description for a ${vehicleIdentifier} based on these items:\n${itemsDescription}\nReturn JSON: { "name": string, "description": string }`;

    try {
        const text = await generateWithRetry("gemini-1.5-flash-latest", fullPrompt);
        const jsonText = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{"name": "Service", "description": ""}';
        return JSON.parse(jsonText);
    } catch (error) {
        return { name: "General Service", description: "Automotive service and repair." };
    }
};

export const generateEstimateFromDescription = async (
    description: string,
    vehicleInfo: { make: string; model: string; },
    availableParts: Part[],
    laborRate: number,
): Promise<any> => {
    const fullPrompt = `Create estimate for ${vehicleInfo.make} ${vehicleInfo.model}. Job: "${description}". Labor: £${laborRate}. Return JSON.`;
    try {
        const text = await generateWithRetry("gemini-1.5-pro-latest", fullPrompt);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{"mainItems": []}';
        return JSON.parse(cleaned);
    } catch (error) {
        throw error;
    }
};

export const parseSearchQuery = async (query: string): Promise<{ searchTerm: string, searchType: 'customer' | 'vehicle' | 'unknown' }> => {
    const isReg = /^[A-Z0-9]{1,7}$/i.test(query.trim());
    return { searchTerm: query, searchType: isReg ? 'vehicle' : 'customer' };
};

export const parseInquiryMessage = async (message: string) => {
    try {
        const text = await generateWithRetry("gemini-1.5-flash-latest", `Extract Name, Contact, Reg from: "${message}". Return JSON.`);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
        return JSON.parse(cleaned);
    } catch (error) {
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }
};

export const parseServicePackageFromContent = async (content: string): Promise<Partial<ServicePackage>> => {
    try {
        const text = await generateWithRetry("gemini-1.5-pro-latest", `Extract service package details from: "${content}". Return JSON.`);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
        return JSON.parse(cleaned);
    } catch (error) {
        throw error;
    }
};