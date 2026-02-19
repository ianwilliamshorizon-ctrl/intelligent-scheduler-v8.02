import { GoogleGenAI } from "@google/genai";
import { ServicePackage, EstimateLineItem, Part } from '../../types';

// Determine Environment
const ENV_MODE = import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? 'production' : 'development');

let apiKey: string | undefined;

if (ENV_MODE === 'production') {
    apiKey = import.meta.env.VITE_GEMINI_API_KEY_PROD;
} else {
    apiKey = import.meta.env.VITE_GEMINI_API_KEY;
}

if (!apiKey) {
    console.warn(`VITE_GEMINI_API_KEY or relevant _PROD key not set for ${ENV_MODE} environment. Gemini features will not work.`);
}

// Initializing the client
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * FIXED: In the 2026 SDK, chats are created via the 'chats' namespace.
 * It is an asynchronous call.
 */
export const createAssistantChat = async () => {
    if (!ai) {
        throw new Error("Gemini API is not configured.");
    }

    // Correct method for the 2026 SDK is ai.chats.create
    return await ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: `You are an expert automotive technician assistant at Brookspeed, a high-performance garage specializing in Porsche, Audi, and other performance vehicles.
            
            Your role is to assist Service Advisors and Technicians with:
            1. Technical data (e.g., torque settings, fluid capacities, service intervals).
            2. Drafting customer communications.
            3. Diagnosing symptoms based on descriptions.
            
            IMPORTANT SAFETY NOTICE: When providing specific technical figures like torque settings or clearances, ALWAYS add a disclaimer: "Please verify with the official manufacturer workshop manual before application."
            
            Format your responses clearly using Markdown (bolding key figures, using lists). Keep responses concise and professional.`
        }
    });
};

export const parseJobRequest = async (prompt: string, servicePackages: ServicePackage[], contextDate: string, vehicleInfo?: { make: string; model: string; }): Promise<any> => {
    if (!ai) throw new Error("Gemini API is not configured.");
    
    const knownPackages = servicePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');

    let vehicleContextPrompt = '';
    if (vehicleInfo) {
        vehicleContextPrompt = `
      IMPORTANT VEHICLE CONTEXT: The request is for a ${vehicleInfo.make} ${vehicleInfo.model}.
      Use this information to select the most appropriate service package.
      `;
    }

    const fullPrompt = `
      Parse the following user request to create a garage job card.
      The context date for this request is ${contextDate}. Final date MUST be in YYYY-MM-DD format.
      ${vehicleContextPrompt}

      Known Service Packages:
      ${knownPackages}
      
      User Request: "${prompt}"

      Return valid JSON: { "vehicleRegistration": string, "description": string, "scheduledDate": string, "servicePackageNames": string[], "estimatedHours": number }
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: fullPrompt
        });
        
        const jsonText = result.text?.trim() ?? "{}";
        const parsedData = JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());
        if (!parsedData.servicePackageNames) parsedData.servicePackageNames = [];
        return parsedData;

    } catch (error: any) {
        console.error("Error parsing job request:", error);
        throw new Error("Failed to understand the job request.");
    }
};

export const parseSearchQuery = async (query: string): Promise<{ searchTerm: string, searchType: 'customer' | 'vehicle' | 'unknown' }> => {
    if (!ai) {
         const isReg = /[A-Z0-9]{1,7}/.test(query.toUpperCase());
         return { searchTerm: query, searchType: isReg ? 'vehicle' : 'customer' };
    }

    const fullPrompt = `
      Analyze search query: "${query}"
      Return valid JSON with 'searchTerm' and 'searchType' ('customer', 'vehicle', or 'unknown').
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt
        });
        
        const jsonText = result.text?.trim() ?? '{"searchTerm": "", "searchType": "unknown"}';
        return JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());

    } catch (error) {
        console.error("Error parsing search query:", error);
        return { searchTerm: query, searchType: 'unknown' };
    }
};

export const generateServicePackageName = async (
    lineItems: EstimateLineItem[],
    vehicleMake: string,
    vehicleModel: string
): Promise<{ name: string; description: string }> => {
    if (!ai) throw new Error("Gemini API is not configured.");

    const itemsDescription = (lineItems || [])
        .map(item => `- ${item.description} (Qty: ${item.quantity})`)
        .join('\n');

    const fullPrompt = `
      Generate a concise 'name' and 'description' for:
      Vehicle: ${vehicleMake} ${vehicleModel}
      Items: ${itemsDescription}
      Return valid JSON with 'name' and 'description'.
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt
        });
        
        const jsonText = result.text?.trim() ?? '{"name": "New Service", "description": ""}';
        return JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());

    } catch (error) {
        console.error("Error generating package name:", error);
        throw new Error("Failed to generate service package name.");
    }
};

export const generateEstimateFromDescription = async (
    description: string,
    vehicleInfo: { make: string; model: string; },
    availableParts: Part[],
    availablePackages: ServicePackage[],
    laborRate: number,
): Promise<{ mainItems: Partial<EstimateLineItem>[], optionalExtras: Partial<EstimateLineItem>[], suggestedNotes: string }> => {
    if (!ai) throw new Error("Gemini API is not configured.");
   
    const partsList = availableParts.map(p => `- ${p.partNumber}: ${p.description}`).join('\n');
    const packagesList = availablePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');

    const fullPrompt = `
      Create estimate breakdown.
      Vehicle: ${vehicleInfo.make} ${vehicleInfo.model}
      Rate: £${laborRate}
      Packages: ${packagesList}
      Parts: ${partsList}
      Request: "${description}"

      Return JSON: { "mainItems": [], "optionalExtras": [], "suggestedNotes": "" }
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: fullPrompt
        });
        
        const jsonText = result.text?.trim() ?? '{"mainItems": []}';
        const parsedData = JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());
        
        return {
            mainItems: parsedData.mainItems || [],
            optionalExtras: parsedData.optionalExtras || [],
            suggestedNotes: parsedData.suggestedNotes || ''
        };

    } catch (error) {
        console.error("Error generating estimate:", error);
        throw new Error("AI failed to generate estimate.");
    }
};

export const parseInquiryMessage = async (message: string): Promise<{ fromName: string; fromContact: string; vehicleRegistration: string; summary: string; }> => {
    if (!ai) return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };

    const fullPrompt = `
      Extract details from: "${message}"
      Return JSON: { "fromName", "fromContact", "vehicleRegistration", "summary" }
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt
        });
        
        const jsonText = result.text?.trim() ?? '{"summary": ""}';
        return JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());

    } catch (error) {
        console.error("Error parsing inquiry:", error);
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }
};

export const parseServicePackageFromContent = async (content: string): Promise<Partial<ServicePackage>> => {
    if (!ai) throw new Error("Gemini API is not configured.");

    const fullPrompt = `
      Analyze content and extract Service Package:
      "${content}"
      Return JSON: { "name", "description", "costItems": [] }
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: fullPrompt
        });
        
        const jsonText = result.text?.trim() ?? "{}";
        return JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());

    } catch (error) {
        console.error("Error parsing package content:", error);
        throw new Error("Failed to create service package from content.");
    }
};