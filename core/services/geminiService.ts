import { GoogleGenerativeAI, SchemaType as Type, Schema } from "@google/generative-ai";
// Fixed relative path to reach your types from the core/services folder
import { ServicePackage, EstimateLineItem, Part } from '../../types';

/**
 * Environment Variable Access via Vite.
 */
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY environment variable not set. Gemini features will not work.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Creates a chat session for the technical assistant.
 */
export const createAssistantChat = () => {
    if (!genAI) throw new Error("Gemini API is not configured.");

    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are an expert automotive technician assistant at Brookspeed.
            Specializing in Porsche and Audi performance vehicles.
            Format responses clearly using Markdown and always include a safety disclaimer for technical data.`,
    }).startChat();
};

/**
 * Parses raw text into a structured Job Card.
 */
export const parseJobRequest = async (prompt: string, servicePackages: ServicePackage[], contextDate: string, vehicleInfo?: { make: string; model: string; }): Promise<any> => {
    if (!genAI) throw new Error("Gemini API is not configured.");

    const responseSchema: Schema = {
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
            format: "enum" 
          } as Schema
        }
      },
      required: ['vehicleRegistration', 'description', 'scheduledDate'],
    };
    
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-pro',
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    });

    const knownPackages = servicePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');
    const fullPrompt = `Context Date: ${contextDate}. Vehicle: ${vehicleInfo?.make} ${vehicleInfo?.model}. Known Packages: ${knownPackages} Request: "${prompt}"`;

    try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const parsedData = JSON.parse(response.text());
        return { ...parsedData, servicePackageNames: parsedData.servicePackageNames || [] };
    } catch (error) {
        console.error("Gemini Parse Error:", error);
        throw new Error("Failed to understand the job request.");
    }
};

/**
 * Classifies search intent for the global search bar.
 */
export const parseSearchQuery = async (query: string): Promise<{ searchTerm: string, searchType: 'customer' | 'vehicle' | 'unknown' }> => {
    if (!genAI) {
         const isReg = /[A-Z0-9]{1,7}/.test(query.toUpperCase());
         return { searchTerm: query, searchType: isReg ? 'vehicle' : 'customer' };
    }

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            searchTerm: { type: Type.STRING },
            searchType: {
                type: Type.STRING,
                enum: ['customer', 'vehicle', 'unknown'],
                format: "enum" 
            } as Schema
        },
        required: ['searchTerm', 'searchType'],
    };

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
    });

    try {
        const result = await model.generateContent(`Analyze search query: "${query}"`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        return { searchTerm: query, searchType: 'unknown' };
    }
};

/**
 * Generates customer-facing package names.
 */
export const generateServicePackageName = async (lineItems: EstimateLineItem[], make: string, modelName: string): Promise<any> => {
    if (!genAI) throw new Error("AI service unavailable.");
    
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
        },
        required: ['name', 'description'],
    };

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
    });

    const items = lineItems.map(item => `- ${item.description}`).join('\n');
    try {
        const result = await model.generateContent(`Generate name for ${make} ${modelName} work: ${items}`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (e) { throw new Error("Generation failed."); }
};

/**
 * Breaks down a natural language description into an estimate.
 */
export const generateEstimateFromDescription = async (desc: string, vInfo: any, parts: Part[], packages: ServicePackage[], rate: number): Promise<any> => {
    if (!genAI) throw new Error("AI service unavailable.");

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            mainItems: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        isLabor: { type: Type.BOOLEAN }
                    },
                    required: ['description', 'quantity', 'isLabor']
                } as Schema
            },
            optionalExtras: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT, 
                    properties: { 
                        description: { type: Type.STRING }, 
                        quantity: { type: Type.NUMBER }, 
                        isLabor: { type: Type.BOOLEAN } 
                    }, 
                    required: ['description', 'quantity', 'isLabor'] 
                } as Schema 
            },
            suggestedNotes: { type: Type.STRING }
        },
        required: ['mainItems']
    };

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-pro',
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
    });

    try {
        const result = await model.generateContent(`Generate estimate for ${vInfo.make} ${vInfo.model} at £${rate}/hr: ${desc}`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (e) { throw new Error("Estimate generation failed."); }
};

/**
 * Parses customer inquiries.
 */
export const parseInquiryMessage = async (msg: string) => {
    if (!genAI) return { fromName: '', fromContact: '', vehicleRegistration: '', summary: msg };
    
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            fromName: { type: Type.STRING },
            fromContact: { type: Type.STRING },
            vehicleRegistration: { type: Type.STRING },
            summary: { type: Type.STRING }
        },
        required: ['summary'],
    };

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
    });

    try {
        const result = await model.generateContent(`Parse inquiry: ${msg}`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (e) { return { fromName: '', fromContact: '', vehicleRegistration: '', summary: msg }; }
};

/**
 * Extracts structured service packages from content.
 */
export const parseServicePackageFromContent = async (content: string) => {
    if (!genAI) throw new Error("AI service unavailable.");
    
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            costItems: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        isLabor: { type: Type.BOOLEAN },
                        unitCost: { type: Type.NUMBER },
                        unitPrice: { type: Type.NUMBER }
                    },
                    required: ['description', 'quantity', 'isLabor']
                } as Schema
            }
        },
        required: ['name', 'description', 'costItems'],
    };

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-pro',
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema }
    });

    try {
        const result = await model.generateContent(`Extract structured package: ${content}`);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (e) { throw new Error("Service package parsing failed."); }
};