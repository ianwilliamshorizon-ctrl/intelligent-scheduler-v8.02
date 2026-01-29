import { GoogleGenerativeAI, SchemaType as Type } from "@google/generative-ai";
import { ServicePackage, EstimateLineItem, Part } from '../../types';

// Accessing environment variables in Vite/Firebase Studio
const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY environment variable not set. Gemini features will not work.");
}

const ai = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const createAssistantChat = () => {
    if (!ai) {
        throw new Error("Gemini API is not configured.");
    }

    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash', // Optimized for fast, conversational technical data
        systemInstruction: `You are an expert automotive technician assistant at Brookspeed, a high-performance garage specializing in Porsche, Audi, and other performance vehicles.
            
            Your role is to assist Service Advisors and Technicians with:
            1. Technical data (e.g., torque settings, fluid capacities, service intervals).
            2. Drafting customer communications.
            3. Diagnosing symptoms based on descriptions.
            
            IMPORTANT SAFETY NOTICE: When providing specific technical figures like torque settings or clearances, ALWAYS add a disclaimer: "Please verify with the official manufacturer workshop manual before application."
            
            Format your responses clearly using Markdown (bolding key figures, using lists). Keep responses concise and professional.`,
    });

    return model.startChat();
};

export const parseJobRequest = async (prompt: string, servicePackages: ServicePackage[], contextDate: string, vehicleInfo?: { make: string; model: string; }): Promise<any> => {
    if (!ai) {
        throw new Error("Gemini API is not configured. Please check your API key settings.");
    }

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        vehicleRegistration: { type: Type.STRING },
        description: { type: Type.STRING },
        estimatedHours: { type: Type.NUMBER },
        scheduledDate: { type: Type.STRING },
        notes: { type: Type.STRING },
        servicePackageNames: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            enum: servicePackages.map(p => p.name),
          }
        }
      },
      required: ['vehicleRegistration', 'description', 'scheduledDate'],
    };
    
    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-pro', // Using Pro for complex structural parsing
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    });

    const knownPackages = servicePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');
    let vehicleContextPrompt = vehicleInfo ? `VEHICLE CONTEXT: ${vehicleInfo.make} ${vehicleInfo.model}.` : '';

    const fullPrompt = `Parse the following request for a job card. Context Date: ${contextDate}. ${vehicleContextPrompt} Known Packages: ${knownPackages} Request: "${prompt}"`;

    try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        // CORRECTED: .text() is a method call in the current SDK
        const jsonText = response.text().trim();
        const parsedData = JSON.parse(jsonText);
        return { ...parsedData, servicePackageNames: parsedData.servicePackageNames || [] };
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

    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json" }
    });

    try {
        const result = await model.generateContent(`Analyze search query and return JSON: "${query}"`);
        const response = await result.response;
        return JSON.parse(response.text());
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
    if (!ai) throw new Error("AI service is unavailable.");
    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json" }
    });

    const itemsDescription = (lineItems || []).map(item => `- ${item.description}`).join('\n');
    const fullPrompt = `Generate a marketable name and description for ${vehicleMake} ${vehicleModel} based on: ${itemsDescription}`;

    try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        throw new Error("Failed to generate a service package name.");
    }
};

export const generateEstimateFromDescription = async (
    description: string,
    vehicleInfo: { make: string; model: string; },
    availableParts: Part[],
    availablePackages: ServicePackage[],
    laborRate: number,
): Promise<any> => {
    if (!ai) throw new Error("AI service is unavailable.");
    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-pro',
        generationConfig: { responseMimeType: "application/json" }
    });

    try {
        const result = await model.generateContent(`Generate estimate for ${vehicleInfo.make} ${vehicleInfo.model}: ${description}. Rate: £${laborRate}`);
        const response = await result.response;
        const parsedData = JSON.parse(response.text());
        return {
            mainItems: parsedData.mainItems || [],
            optionalExtras: parsedData.optionalExtras || [],
            suggestedNotes: parsedData.suggestedNotes || ''
        };
    } catch (error) {
        throw new Error("AI failed to generate an estimate.");
    }
};

export const parseInquiryMessage = async (message: string) => {
    if (!ai) return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json" }
    });

    try {
        const result = await model.generateContent(`Parse inquiry: ${message}`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }
};

export const parseServicePackageFromContent = async (content: string) => {
    if (!ai) throw new Error("AI service is unavailable.");
    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-pro',
        generationConfig: { responseMimeType: "application/json" }
    });

    try {
        const result = await model.generateContent(`Extract structured package: ${content}`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        throw new Error("Failed to create service package from content.");
    }
};