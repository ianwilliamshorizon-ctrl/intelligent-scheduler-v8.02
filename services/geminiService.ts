import { GoogleGenAI, Type } from "@google/genai";
import { ServicePackage, EstimateLineItem, Part } from '../types';

// Determine Environment
const ENV_MODE = import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? 'production' : 'development');

let apiKey: string | undefined;

if (ENV_MODE === 'production') {
    apiKey = import.meta.env.VITE_GEMINI_API_KEY_PROD;
} else {
    // Fallback for development or other environments
    apiKey = import.meta.env.VITE_GEMINI_API_KEY;
}

if (!apiKey) {
    console.warn(`VITE_GEMINI_API_KEY or relevant _PROD key not set for ${ENV_MODE} environment. Gemini features will not work.`);
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const createAssistantChat = () => {
    if (!ai) {
        throw new Error("Gemini API is not configured.");
    }

    return ai.chats.create({
        model: 'gemini-3-flash-preview',
        history: [
            { 
                role: 'user', 
                parts: [{ text: `You are an expert automotive technician assistant at Brookspeed, a high-performance garage specializing in Porsche, Audi, and other performance vehicles.
            
            Your role is to assist Service Advisors and Technicians with:
            1. Technical data (e.g., torque settings, fluid capacities, service intervals).
            2. Drafting customer communications.
            3. Diagnosing symptoms based on descriptions.
            
            IMPORTANT SAFETY NOTICE: When providing specific technical figures like torque settings or clearances, ALWAYS add a disclaimer: "Please verify with the official manufacturer workshop manual before application."
            
            Format your responses clearly using Markdown (bolding key figures, using lists). Keep responses concise and professional.` }] 
            },
            { 
                role: 'model', 
                parts: [{ text: "Understood. I am the Brookspeed technical assistant. I will provide precise technical data and always include safety disclaimers. How can I assist you today?" }] 
            }
        ]
    });
};

export const parseJobRequest = async (prompt: string, servicePackages: ServicePackage[], contextDate: string, vehicleInfo?: { make: string; model: string; }): Promise<any> => {
    if (!ai) {
        throw new Error("Gemini API is not configured. Please check your API key settings.");
    }

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        vehicleRegistration: {
          type: Type.STRING,
          description: 'The registration plate of the vehicle mentioned in the request. Extract it as accurately as possible, preserving spaces if present.',
        },
        description: {
          type: Type.STRING,
          description: 'A concise description of the job. If service packages are identified, combine their names (e.g., "MOT & Minor Service").',
        },
        estimatedHours: {
          type: Type.NUMBER,
          description: 'The estimated hours. Omit if service packages are found. Otherwise, this is required.',
        },
        scheduledDate: {
          type: Type.STRING,
          description: 'The scheduled start date in YYYY-MM-DD format.',
        },
        notes: {
          type: Type.STRING,
          description: 'Any additional notes or instructions from the user request.'
        },
        servicePackageNames: {
          type: Type.ARRAY,
          description: 'A list of service package names if any are mentioned. Must be an exact match from the provided list.',
          items: {
            type: Type.STRING,
            enum: servicePackages.map(p => p.name),
          }
        }
      },
      required: ['vehicleRegistration', 'description', 'scheduledDate'],
    };
    
    const knownPackages = servicePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');

    let vehicleContextPrompt = '';
    if (vehicleInfo) {
        vehicleContextPrompt = `
      IMPORTANT VEHICLE CONTEXT: The request is for a ${vehicleInfo.make} ${vehicleInfo.model}.
      Use this information to select the most appropriate service package. For example, if the user says "major service" and the list contains "Porsche 911 Major Service" and "Porsche Cayman Major Service", you MUST select the one that matches the vehicle model (e.g., "Porsche 911 Major Service" for a 911).
      `;
    }

    const fullPrompt = `
      Parse the following user request to create a garage job card.
      The context date for this request is ${contextDate}. Use this to resolve relative dates like "tomorrow" or "next Monday". The final date MUST be in YYYY-MM-DD format. If the user does not specify a date, assume the job is for the context date.
      ${vehicleContextPrompt}

      Here is a list of KNOWN SERVICE PACKAGES. If the user's request matches one or more of these, you MUST return their exact names in the 'servicePackageNames' array.
      Known Service Packages:
      ${knownPackages}
      
      User Request: "${prompt}"

      Extraction Rules:
      1. Always extract the vehicle registration as mentioned by the user. It is crucial.
      2. If one or more service packages are identified (using the vehicle context if provided):
         - Return their names in the 'servicePackageNames' array.
         - Use a combined name (e.g., "MOT Test & Minor Service") as the main 'description'.
         - Any other details from the user request should be put in the 'notes' field.
         - You can omit 'estimatedHours'.
      3. If no service package is mentioned:
         - Create a concise 'description' from the user's request.
         - You MUST provide a reasonable estimate for 'estimatedHours'.

      Format the output according to the provided JSON schema.
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = result.text?.trim() ?? "{}";
        const parsedData = JSON.parse(jsonText);
        if (!parsedData.servicePackageNames) {
          parsedData.servicePackageNames = [];
        }
        return parsedData;

    } catch (error: any) {
        console.error("Error parsing job request with Gemini:", error);
        let errorMessage = "Failed to understand the job request.";
        if (error.message && error.message.includes("xhr error")) {
            errorMessage = "Network error connecting to AI service. Please check your internet connection or API key configuration.";
        }
        throw new Error(errorMessage);
    }
};

export const parseSearchQuery = async (query: string): Promise<{ searchTerm: string, searchType: 'customer' | 'vehicle' | 'unknown' }> => {
    if (!ai) {
         const isReg = /[A-Z0-9]{1,7}/.test(query.toUpperCase());
         return { searchTerm: query, searchType: isReg ? 'vehicle' : 'customer' };
    }

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            searchTerm: {
                type: Type.STRING,
                description: "The primary search term extracted from the user's query. Normalize registration plates by removing spaces.",
            },
            searchType: {
                type: Type.STRING,
                description: "The type of entity the user is most likely searching for.",
                enum: ['customer', 'vehicle', 'unknown'],
            }
        },
        required: ['searchTerm', 'searchType'],
    };

    const fullPrompt = `
      Analyze the following search query from a garage management system's universal search bar.
      Your task is to extract the core search term and classify the user's intent.

      Query: "${query}"

      Classification Rules:
      1.  If the query contains a person's name, a phone number, or an email address, searchType is 'customer'.
      2.  If the query contains what looks like a registration plate, vehicle make, or model, searchType is 'vehicle'. For registrations, remove any spaces.
      3.  If the query is ambiguous, classify as 'unknown'.

      Format the output according to the provided JSON schema.
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = result.text?.trim() ?? '{"searchTerm": "", "searchType": "unknown"}';
        const parsedData = JSON.parse(jsonText);
        return parsedData;

    } catch (error) {
        console.error("Error parsing search query with Gemini:", error);
        return { searchTerm: query, searchType: 'unknown' };
    }
};

export const generateServicePackageName = async (
    lineItems: EstimateLineItem[],
    vehicleMake: string,
    vehicleModel: string
): Promise<{ name: string; description: string }> => {
    if (!ai) {
        throw new Error("AI service is unavailable.");
    }

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            name: {
                type: Type.STRING,
                description: "A concise, customer-facing name. Examples: 'Porsche 911 Major Service', 'Ford Transit Annual Check-up'.",
            },
            description: {
                type: Type.STRING,
                description: 'A brief, one-sentence summary of the work included in this package.',
            },
        },
        required: ['name', 'description'],
    };

    const itemsDescription = (lineItems || [])
        .map(item => `- ${item.description} (Qty: ${item.quantity})`)
        .join('\n');

    const fullPrompt = `
      Analyze the following vehicle information and list of work items from a garage estimate.
      Your task is to generate a suitable name and a short description for a new, reusable service package.

      Vehicle: ${vehicleMake} ${vehicleModel}

      Work Items:
      ${itemsDescription}

      Rules:
      1. The name MUST include the vehicle make and model.
      2. The name should summarize the core service.
      3. The description should be a single, clear sentence.

      Format the output according to the provided JSON schema.
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = result.text?.trim() ?? '{"name": "Manual Package", "description": ""}';
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating service package name with Gemini:", error);
        throw new Error("Failed to generate a service package name.");
    }
};

export const generateEstimateFromDescription = async (
    description: string,
    vehicleInfo: { make: string; model: string; },
    availableParts: Part[],
    availablePackages: ServicePackage[],
    laborRate: number,
): Promise<{ mainItems: Partial<EstimateLineItem>[], optionalExtras: Partial<EstimateLineItem>[], suggestedNotes: string }> => {
    if (!ai) {
        throw new Error("AI service is unavailable.");
    }

    const lineItemSchema = {
      type: Type.OBJECT,
      properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          isLabor: { type: Type.BOOLEAN },
          partNumber: { type: Type.STRING },
          servicePackageName: { type: Type.STRING }
      },
      required: ['description', 'quantity', 'isLabor'],
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            mainItems: {
                type: Type.ARRAY,
                description: "A list of essential labor and parts for the job.",
                items: lineItemSchema
            },
            optionalExtras: {
                type: Type.ARRAY,
                items: lineItemSchema
            },
            suggestedNotes: {
                type: Type.STRING,
                description: "Bullet points for the technician or customer."
            }
        },
        required: ['mainItems']
    };

    const partsList = availableParts.map(p => `- ${p.partNumber}: ${p.description}`).join('\n');
    const packagesList = availablePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');

    const fullPrompt = `
      You are an expert garage service advisor. Break the customer's request into an estimate.

      Vehicle: ${vehicleInfo.make} ${vehicleInfo.model}
      Standard hourly labor rate: £${laborRate}

      Available Service Packages:
      ${packagesList}

      Available Parts:
      ${partsList}

      Customer Request: "${description}"

      Rules:
      1. Prioritize Service Packages if applicable.
      2. If no package, break down into labor and parts.
      3. Suggest 1-3 optional extras (e.g., brake fluid with a brake job).
      4. Provide bulleted notes.

      Format the output according to the provided JSON schema.
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = result.text?.trim() ?? '{"mainItems": []}';
        const parsedData = JSON.parse(jsonText);
        
        return {
            mainItems: parsedData.mainItems || [],
            optionalExtras: parsedData.optionalExtras || [],
            suggestedNotes: parsedData.suggestedNotes || ''
        };

    } catch (error) {
        console.error("Error generating estimate with Gemini:", error);
        throw new Error("AI failed to generate an estimate.");
    }
};

export const parseInquiryMessage = async (message: string): Promise<{ fromName: string; fromContact: string; vehicleRegistration: string; summary: string; }> => {
    if (!ai) {
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            fromName: { type: Type.STRING },
            fromContact: { type: Type.STRING },
            vehicleRegistration: { type: Type.STRING },
            summary: { type: Type.STRING }
        },
        required: ['summary'],
    };

    const fullPrompt = `
      Extract key details from this inquiry: "${message}". 
      Find name, contact (phone/email), and normalized vehicle registration (no spaces, uppercase).
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = result.text?.trim() ?? '{"summary": ""}';
        const parsedData = JSON.parse(jsonText);
        return parsedData;

    } catch (error) {
        console.error("Error parsing inquiry with Gemini:", error);
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }
};

export const parseServicePackageFromContent = async (content: string): Promise<Partial<ServicePackage>> => {
    if (!ai) {
        throw new Error("AI service is unavailable.");
    }

    const responseSchema = {
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
                        unitPrice: { type: Type.NUMBER },
                        partNumber: { type: Type.STRING }
                    },
                    required: ['description', 'quantity', 'isLabor']
                }
            }
        },
        required: ['name', 'description', 'costItems'],
    };

    const fullPrompt = `Extract a structured Service Package from this technical data: "${content}"`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = result.text?.trim() ?? "{}";
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error parsing service package with Gemini:", error);
        throw new Error("Failed to create service package from content.");
    }
};