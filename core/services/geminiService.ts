import { app } from '../services/firebaseServices';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { repairJsonString } from '../utils/jsonUtils';

const functions = getFunctions(app, 'europe-west1');
// Notice the new name here!
const generateContentCallable = httpsCallable(functions, 'geminiGenerateContent');

export const initializeGenerativeAI = (apiKey?: string) => {
    console.log("Gemini Service initialized via Firebase Functions");
    return { initialized: true };
};

export const generateContent = async (prompt: string): Promise<string> => {
    try {
        const result: any = await generateContentCallable({ prompt });
        return result.data.text || result.data || "";
    } catch (error) {
        console.error("DIAGNOSTIC-FIX-V1: Error calling geminiGenerateContent function:", error);
        throw error;
    }
};

/**
 * PARSE JOB REQUEST
 * Uses the AI to extract structured JSON from a text prompt
 */
export const parseJobRequest = async (prompt: string): Promise<any> => {
    const rawResult = await generateContent(prompt);

    if (!rawResult || typeof rawResult !== 'string') {
        throw new Error("Empty or invalid response received from the AI service.");
    }

    let cleanJson = '';
    try {
        // Use regex to extract JSON if the AI wrapped it in markdown code blocks
        const jsonStringMatch = rawResult.match(/```json\n([\s\S]*?)\n```/) || rawResult.match(/```([\s\S]*?)```/);
        cleanJson = (jsonStringMatch ? jsonStringMatch[1] : rawResult).trim();

        // Apply our robust JSON repair helper
        const repairedJson = repairJsonString(cleanJson);

        return JSON.parse(repairedJson);
    } catch (error) {
        console.error("Error parsing JSON from AI response:", error);
        console.log("Raw response was:", rawResult);
        console.log("Cleaned JSON block was:", cleanJson);
        throw new Error("Failed to parse the AI's response into a valid format.");
    }
};

/**
 * GENERATE SERVICE PACKAGE DETAILS
 * Using AI to generate a clean name and description for a package
 */
export const generateServicePackageName = async (lineItems: any[], make: string, model: string, cc?: string | number): Promise<{ name: string; description: string }> => {
    const itemsText = (lineItems || []).map(item => `${item.description} (qty: ${item.quantity})`).join(', ');
    const vehicleInfo = `${make} ${model}${cc ? ` ${cc}` : ''}`;
    const prompt = `Based on these items: ${itemsText}, and this vehicle: ${vehicleInfo}, generate a concise name and a short description for a service package. Return ONLY JSON in this format: {"name": "...", "description": "..."}`;
    
    try {
        const result = await parseJobRequest(prompt);
        return {
            name: result.name || `${make} ${model} Service`,
            description: result.description || "Set of services and parts."
        };
    } catch (error) {
        console.error("Error generating service package info:", error);
        return {
            name: `${make} ${model} Service`,
            description: "Custom service package based on estimate items."
        };
    }
};

/**
 * PARSE INQUIRY MESSAGE
 * Uses the AI to extract structured info from an inquiry message
 */
export const parseInquiryMessage = async (message: string): Promise<any> => {
    const prompt = `Analyze this customer inquiry message and extract structured information.
    
    Extract the following fields if present:
    1. "summary": A brief 1-2 sentence summary of the customer's issue or request.
    2. "fromName": The customer's full name, if mentioned.
    3. "fromEmail": The FULL, complete email address, exactly as written. Do NOT truncate.
    4. "fromPhone": The FULL, complete phone number, exactly as written. Do NOT truncate.
    5. "fromContact": Any generic contact info that doesn't fit email/phone perfectly.
    6. "vehicleRegistration": Any vehicle registration plate/number mentioned (including UK formats like AB12 CDE, regardless of spacing) found anywhere in the text including the subject/title.

    Format your response as a valid JSON object only. Do not include any conversational text outside the JSON.
    Example: {"summary": "...", "fromName": "...", "fromEmail": "...", "fromPhone": "...", "fromContact": "...", "vehicleRegistration": "..."}
    
    Message: ${JSON.stringify(message)}`;
    return parseJobRequest(prompt);
};

/**
 * PARSE SEARCH QUERY
 * Uses AI to parse search queries into a search term and type
 */
export const parseSearchQuery = async (query: string): Promise<{ searchTerm: string; searchType: 'customer' | 'vehicle' | 'unknown' }> => {
    const prompt = `Analyze this search query: ${JSON.stringify(query)}. Identify the primary search term and determine if it represents a "customer" (name, email, phone number) or a "vehicle" (registration plate, VIN, make, model). Return ONLY JSON in this format: {"searchTerm": "...", "searchType": "customer" | "vehicle" | "unknown"}`;
    
    try {
        const result = await parseJobRequest(prompt);
        return {
            searchTerm: result.searchTerm || query,
            searchType: result.searchType || 'unknown'
        };
    } catch (error) {
        console.error("Error parsing search query with AI:", error);
        return {
            searchTerm: query,
            searchType: 'unknown'
        };
    }
};

import { InquiryLog } from '../../types';

/**
 * GENERATE EMAIL REPLY
 * Uses AI to draft an email response to an inquiry
 */
export const generateEmailReply = async (
    inquiryMessage: string, 
    businessName: string,
    actionNotes?: string,
    logs?: InquiryLog[]
): Promise<string> => {
    let notesPrompt = '';
    if (actionNotes) {
        notesPrompt += `\n- Legacy notes / action notes: "${actionNotes}"`;
    }
    if (logs && logs.length > 0) {
        notesPrompt += `\n- CRM logs / internal discussion notes:\n` + 
            logs.map(log => `  * [${log.actionType || 'Note'}] ${log.notes}`).join('\n');
    }

    const prompt = `You are a helpful, professional customer service agent for ${businessName}. A customer sent the following inquiry:
"${inquiryMessage}"
${notesPrompt ? `
Here are internal CRM/action notes detailing the background, actions taken, or information regarding this inquiry:
${notesPrompt}

Please ensure your drafted email response addresses the customer's inquiry appropriately, incorporating or considering the context from these internal notes/logs if relevant (e.g. if a note specifies a quote amount, scheduled date, parts status, or a resolution). Do not mention that you got this from "internal notes" or "CRM logs"; present the information naturally to the customer as part of your update/reply.` : ''}

Draft a polite and concise email reply addressing their inquiry. Do not include subject lines or "[Your Name]" placeholders, just the raw email body text. Make it friendly and professional.`;
    return await generateContent(prompt);
};