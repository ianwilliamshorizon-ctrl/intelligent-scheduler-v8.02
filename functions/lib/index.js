"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContent = void 0;
const functions = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const generative_ai_1 = require("@google/generative-ai");
(0, app_1.initializeApp)();
// Get the Gemini API key from the environment variables
const geminiAPIKey = process.env.VITE_GEMINI_API_KEY;
let genAI;
if (!geminiAPIKey) {
    console.error("VITE_GEMINI_API_KEY environment variable not set!");
}
else {
    genAI = new generative_ai_1.GoogleGenerativeAI(geminiAPIKey);
}
// On-call function to interact with the Gemini API
exports.generateContent = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated if necessary
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const prompt = data.prompt;
    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "prompt" argument.');
    }
    try {
        if (!genAI) {
            throw new Error("Gemini AI not initialized. Check API key.");
        }
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        return { text };
    }
    catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new functions.https.HttpsError('internal', 'Error generating content.');
    }
});
//# sourceMappingURL=index.js.map