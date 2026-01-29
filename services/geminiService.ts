import { GoogleGenAI, Type } from "@google/genai";
import { ServicePackage, EstimateLineItem, Part } from '../types';

// Helper to safely access environment variables without crashing if 'process' is undefined
const getEnvVar = (key: string): string | undefined => {
    try {
        // @ts-ignore
        return (typeof process !== 'undefined' && process.env) ? process.env[key] : undefined;
    } catch (e) {
        return undefined;
    }
};

const apiKey = getEnvVar('API_KEY');

if (!apiKey) {
    console.warn("API_KEY environment variable not set. Gemini features will not work.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const createAssistantChat = () => {
    if (!ai) {
        throw new Error("Gemini API is not configured.");
    }

    return ai.chats.create({
        // FIX: Updated model name to 'gemini-3-flash-preview' as per guidelines.
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: `You are an expert automotive technician assistant at Brookspeed, a high-performance garage specializing in Porsche, Audi, and other performance vehicles.
            
            Your role is to assist Service Advisors and Technicians with:
            1. Technical data (e.g., torque settings, fluid capacities, service intervals).
            2. Drafting customer communications.
            3. Diagnosing symptoms based on descriptions.
            
            IMPORTANT SAFETY NOTICE: When providing specific technical figures like torque settings or clearances, ALWAYS add a disclaimer: "Please verify with the official manufacturer workshop manual before application."
            
            Format your responses clearly using Markdown (bolding key figures, using lists). Keep responses concise and professional.`,
        },
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
        const response = await ai.models.generateContent({
            // FIX: Updated model name as per guidelines.
            model: 'gemini-3-pro-preview',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        // FIX: Use .text property instead of .text() method
        const jsonText = response.text.trim();
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
                description: "The primary search term extracted from the user's query. This should be the core identifier like a name, registration plate, phone number, email, or vehicle model. Normalize registration plates by removing spaces.",
            },
            searchType: {
                type: Type.STRING,
                description: "The type of entity the user is most likely searching for. If it's a person's name, phone number, or email, classify as 'customer'. If it's a registration plate, vehicle make or model, classify as 'vehicle'. If it's ambiguous, classify as 'unknown'.",
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
      1.  If the query contains a person's name (e.g., "John Smith"), a phone number (e.g., "07700900123"), or an email address, the searchType is 'customer'. The searchTerm should be the name, number, or email.
      2.  If the query contains what looks like a vehicle registration plate (e.g., "REG123", "WP19 WML"), a vehicle make (e.g., "Porsche"), or a model (e.g., "911 GT3"), the searchType is 'vehicle'. The searchTerm should be the registration, make, or model. For registrations, remove any spaces.
      3.  If the query is ambiguous (e.g., "Smith's car", "the transit"), classify the searchType as 'unknown' and extract the most likely identifier as the searchTerm.

      Format the output according to the provided JSON schema.
    `;

    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name as per guidelines.
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        // FIX: Use .text property instead of .text() method
        const jsonText = response.text.trim();
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
                description: "A concise, customer-facing name for the service package. It MUST include the vehicle make and model. Examples: 'Porsche 911 Major Service', 'Ford Transit Annual Check-up'.",
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
      Your task is to generate a suitable name and a short description for a new, reusable service package based on these items.

      Vehicle: ${vehicleMake} ${vehicleModel}

      Work Items:
      ${itemsDescription}

      Rules for generating the name:
      1. The name MUST be concise and marketable.
      2. The name MUST include the vehicle make and model to specify its applicability.
      3. The name should summarize the core service (e.g., "Minor Service", "Brake Replacement", "MOT & Service").

      Rules for generating the description:
      1. The description should be a single, clear sentence summarizing the key components of the service.

      Format the output according to the provided JSON schema.
    `;

    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name as per guidelines.
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        // FIX: Use .text property instead of .text() method
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating service package name with Gemini:", error);
        throw new Error("Failed to generate a service package name. Please try again.");
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

    const { servicePackageName, ...optionalProperties } = lineItemSchema.properties;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            mainItems: {
                type: Type.ARRAY,
                description: "A list of essential labor and parts for the job. If a service package is identified, it should be the only item in this list.",
                items: lineItemSchema
            },
            optionalExtras: {
                type: Type.ARRAY,
                description: "A list of suggested optional add-ons or upsells that are relevant but not essential. Do not include items already in mainItems.",
                items: {
                    ...lineItemSchema,
                    properties: optionalProperties,
                }
            },
            suggestedNotes: {
                type: Type.STRING,
                description: "A few bullet points of relevant notes for the technician or customer. E.g., '- Advise customer on tyre wear.' Format as a string with newlines."
            }
        },
        required: ['mainItems']
    };

    const partsList = availableParts.map(p => `- ${p.partNumber}: ${p.description}`).join('\n');
    const packagesList = availablePackages.map(p => `- ${p.name}: ${p.description || p.name}`).join('\n');

    const fullPrompt = `
      You are an expert garage service advisor. Your task is to analyze a customer's request and break it down into an estimate with three parts: 1. Essential line items, 2. Suggested optional extras, and 3. Important notes.

      Vehicle: ${vehicleInfo.make} ${vehicleInfo.model}
      Standard hourly labor rate: £${laborRate}

      Available Service Packages:
      ${packagesList}

      Available Parts (for reference):
      ${partsList}

      Customer Request: "${description}"

      Rules:
      1.  **Prioritize Service Packages**: If the request clearly matches one of the "Available Service Packages", you MUST return it as the ONLY item in the 'mainItems' array. The 'optionalExtras' and 'suggestedNotes' can still be populated.
          - The package item should have 'description' and 'servicePackageName' set to the exact package name, 'isLabor: false', and 'quantity: 1'.
      2.  **Breakdown for Custom Jobs**: If no service package matches, break the request down into individual labor and parts line items in the 'mainItems' array.
          - For labor, create an item with 'isLabor: true' and estimate the hours for 'quantity'.
          - For parts, create an item with 'isLabor: false'. If you can identify a specific part from the "Available Parts" list, include its 'partNumber'.
      3.  **Generate Optional Extras**: In the 'optionalExtras' array, suggest 1-3 relevant upsells or related maintenance items. For example, if the main job is about brakes, suggest brake fluid. If it's a major service, suggest wheel alignment. These should be items not already in 'mainItems'.
      4.  **Generate Notes**: In 'suggestedNotes', provide a short, bulleted list of important reminders for the technician or advice for the customer. For example:
          - "- Advise customer on remaining tyre life."
          - "- Road test vehicle before and after work."
          - "- Check for any fault codes in ECU."
      5.  **Be Realistic**: Provide reasonable estimates for labor hours and part quantities.
      6.  **Format**: The final output MUST be a JSON object that conforms to the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name as per guidelines.
            model: 'gemini-3-pro-preview',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        // FIX: Use .text property instead of .text() method
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);
        
        return {
            mainItems: parsedData.mainItems || [],
            optionalExtras: parsedData.optionalExtras || [],
            suggestedNotes: parsedData.suggestedNotes || ''
        };

    } catch (error) {
        console.error("Error generating estimate with Gemini:", error);
        throw new Error("AI failed to generate an estimate. Please enter items manually or rephrase your request.");
    }
};

export const parseInquiryMessage = async (message: string): Promise<{ fromName: string; fromContact: string; vehicleRegistration: string; summary: string; }> => {
    if (!ai) {
        return { fromName: '', fromContact: '', vehicleRegistration: '', summary: message };
    }

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            fromName: {
                type: Type.STRING,
                description: "The full name of the person making the inquiry. Return an empty string if not found.",
            },
            fromContact: {
                type: Type.STRING,
                description: "The primary contact detail mentioned, either a phone number or an email address. Return an empty string if not found.",
            },
            vehicleRegistration: {
                type: Type.STRING,
                description: "The registration plate of the vehicle mentioned in the message. Normalize by removing spaces and making it uppercase. Return an empty string if not found.",
            },
            summary: {
                type: Type.STRING,
                description: "A very brief, one-sentence summary of the customer's request (e.g., 'Wants to book a minor service', 'Inquiring about brake replacement cost').",
            }
        },
        required: ['summary'],
    };

    const fullPrompt = `
      You are an expert garage receptionist. Your task is to parse a message from a customer inquiry and extract key details.

      Message: "${message}"

      Rules for Extraction:
      1.  **fromName**: Extract the customer's full name. If only a first name is given, use that.
      2.  **fromContact**: Extract the most prominent contact detail. This will be either a phone number or an email address. If both are present, prefer the phone number.
      3.  **vehicleRegistration**: Find any vehicle registration plate mentioned. It's crucial to normalize it to be uppercase and without any spaces.
      4.  **summary**: Provide a concise, one-sentence summary of the customer's request.

      Format the output according to the provided JSON schema.
    `;

    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name as per guidelines.
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        // FIX: Use .text property instead of .text() method
        const jsonText = response.text.trim();
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
            name: {
                type: Type.STRING,
                description: "A concise name for the service package derived from the content (e.g., 'Porsche 911 Wheel Torque Check', 'Major Service Kit').",
            },
            description: {
                type: Type.STRING,
                description: "A description of the work or parts included. Include any specific values like torque settings here.",
            },
            costItems: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING, description: "Description of the labor or part." },
                        quantity: { type: Type.NUMBER, description: "Quantity required." },
                        isLabor: { type: Type.BOOLEAN, description: "True if it's a labor item, false if it's a part." },
                        unitCost: { type: Type.NUMBER, description: "Estimated unit cost price (optional, default to 0)." },
                        unitPrice: { type: Type.NUMBER, description: "Estimated unit sale price (optional, default to 0)." },
                        partNumber: { type: Type.STRING, description: "Part number if available." }
                    },
                    required: ['description', 'quantity', 'isLabor']
                }
            }
        },
        required: ['name', 'description', 'costItems'],
    };

    const fullPrompt = `
      Analyze the following technical content provided by an automotive assistant and extract a structured Service Package.
      
      Content: "${content}"

      Instructions:
      1. Create a 'name' that summarizes the content (e.g., "Wheel Torque Spec" or "911 Major Service").
      2. Create a 'description' that includes key details like torque settings or specific instructions found in the text.
      3. Extract a list of 'costItems'.
         - If the text lists parts, create items with isLabor: false.
         - If the text describes actions (e.g., "Check torque", "Replace oil"), create items with isLabor: true.
         - If no quantity is specified, assume 1.
         - If no price is specified, use 0.

      Format the output according to the provided JSON schema.
    `;

    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name as per guidelines.
            model: 'gemini-3-pro-preview',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        // FIX: Use .text property instead of .text() method
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error parsing service package with Gemini:", error);
        throw new Error("Failed to create service package from content.");
    }
};
