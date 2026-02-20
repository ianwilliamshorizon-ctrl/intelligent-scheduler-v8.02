import { GoogleGenerativeAI } from "@google/generative-ai";
import { ServicePackage, EstimateLineItem, Part } from '../../types';

/**
 * 1. API KEY RESOLUTION
 */
const isProd = import.meta.env.PROD;
const rawKey = isProd 
    ? (import.meta.env.VITE_GEMINI_API_KEY_PROD || import.meta.env.VITE_GEMINI_API_KEY)
    : (import.meta.env.VITE_GEMINI_API_KEY_DEV || import.meta.env.VITE_GEMINI_API_KEY);

const apiKey = rawKey?.trim();

/**
 * 2. INITIALIZATION
 */
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Debugging: Expose to window so you can test in the console
if (typeof window !== 'undefined') {
    (window as any).genAI = genAI;
}

console.log(`%c 🤖 [GEMINI SERVICE] Active Mode: Gemini 3 Series | Feb 2026`, "color: #4db33d; font-weight: bold;");

/**
 * 3. HELPER: CONTENT GENERATION
 */
async function generateWithRetry(modelName: string, prompt: string, retries = 2) {
    if (!genAI) throw new Error("Gemini AI not initialized. Check your API key.");
    
    // Using the explicit "models/" prefix ensures the v1beta endpoint routes correctly
    const model = genAI.getGenerativeModel({ model: modelName });
    
    for (let i = 0; i <= retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            if (i === retries) throw error;
            console.warn(`AI Attempt ${i + 1} failed for ${modelName}, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

/**
 * 4. CHAT INITIALIZATION
 */
export const createAssistantChat = async () => {
    if (!genAI) throw new Error("Gemini AI not initialized.");
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    return model.startChat({
        history: [],
        generationConfig: { maxOutputTokens: 2000 }
    });
};

/**
 * 5. JOB REQUEST PARSING
 */
export const parseJobRequest = async (
    prompt: string, 
    servicePackages: ServicePackage[], 
    contextDate: string, 
    vehicleInfo?: { make: string; model: string; }
): Promise<any> => {
    const knownPackages = servicePackages.map(p => `- ${p.name}`).join('\n');
    const fullPrompt = `Date: ${contextDate}\nVehicle: ${vehicleInfo?.make || 'Unknown'}\nPackages: ${knownPackages}\nRequest: "${prompt}"\nReturn JSON only.`;

    try {
        const text = await generateWithRetry("gemini-3.1-pro-preview", fullPrompt);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("AI Error (Job Request):", error);
        throw error;
    }
};

/**
 * 6. GENERATE SERVICE PACKAGE NAME
 */
export const generateServicePackageName = async (
    lineItems: EstimateLineItem[],
    vehicleMake: string,
    vehicleModel: string
): Promise<{ name: string; description: string }> => {
    const itemsDescription = (lineItems || []).map(item => `- ${item.description}`).join('\n');
    const fullPrompt = `Generate a concise service name and description for a ${vehicleMake} ${vehicleModel} based on these items:\n${itemsDescription}\nReturn JSON: { "name": string, "description": string }`;

    try {
        const text = await generateWithRetry("gemini-3-flash-preview", fullPrompt);
        const jsonText = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{"name": "Service", "description": ""}';
        return JSON.parse(jsonText);
    } catch (error) {
        return { name: "General Service", description: "Automotive service and repair." };
    }
};

/**
 * 7. ESTIMATE GENERATION
 */
export const generateEstimateFromDescription = async (
    description: string,
    vehicleInfo: { make: string; model: string; },
    availableParts: Part[],
    laborRate: number,
): Promise<any> => {
    const fullPrompt = `Create estimate for ${vehicleInfo.make} ${vehicleInfo.model}. Job: "${description}". Labor: £${laborRate}. Return JSON.`;
    try {
        const text = await generateWithRetry("gemini-3.1-pro-preview", fullPrompt);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{"mainItems": []}';
        return JSON.parse(cleaned);
    } catch (error) {
        throw error;
    }
};

/**
 * 8. SEARCH QUERY ANALYSIS
 */
export const parseSearchQuery = async (query: string): Promise<{ searchTerm: string, searchType: 'customer' | 'vehicle' | 'unknown' }> => {
    if (!genAI) {
        const isReg = /^[A-Z0-9]{1,7}$/i.test(query.trim());
        return { searchTerm: query, searchType: isReg ? 'vehicle' : 'customer' };
    }
    try {
        const text = await generateWithRetry("gemini-3-flash-preview", `Identify if "${query}" is a 'customer' or 'vehicle'. Return JSON {searchTerm, searchType}.`);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
        return JSON.parse(cleaned);
    } catch (error) {
        return { searchTerm: query, searchType: 'unknown' };
    }
};

/**
 * 9. INQUIRY MESSAGE PARSING
 */
export const parseInquiryMessage = async (message: string) => {
    if (!genAI) return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    try {
        const text = await generateWithRetry("gemini-3-flash-preview", `Extract Name, Contact, Reg from: "${message}". Return JSON.`);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
        return JSON.parse(cleaned);
    } catch (error) {
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }
};

/**
 * 10. EXTRACT SERVICE PACKAGE FROM CONTENT
 */
export const parseServicePackageFromContent = async (content: string): Promise<Partial<ServicePackage>> => {
    try {
        const text = await generateWithRetry("gemini-3.1-pro-preview", `Extract service package details from: "${content}". Return JSON.`);
        const cleaned = text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
        return JSON.parse(cleaned);
    } catch (error) {
        throw error;
    }
};