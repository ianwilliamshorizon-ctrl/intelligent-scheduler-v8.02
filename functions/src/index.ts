import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { GoogleGenerativeAI } from "@google/generative-ai";

initializeApp();

// Get the Gemini API key from the Firebase functions configuration
const geminiAPIKey = functions.config().gemini.key;
let genAI: GoogleGenerativeAI | undefined;

if (!geminiAPIKey) {
  console.error("Gemini API key not found in Firebase functions configuration!");
} else {
  genAI = new GoogleGenerativeAI(geminiAPIKey);
}

// On-call function to interact with the Gemini API
export const generateContent = functions.https.onCall(async (data, context) => {

    // Ensure the user is authenticated if necessary
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'The function must be called while authenticated.'
        );
    }

    const prompt = data.prompt;

    if (!prompt) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with a "prompt" argument.'
        );
    }

    try {
        if (!genAI) {
          throw new Error("Gemini AI not initialized. Check API key configuration.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        return { text };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new functions.https.HttpsError('internal', 'Error generating content.');
    }
});
