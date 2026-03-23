const { onRequest } = require("firebase-functions/v2/https");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
// FORCE DEPLOY TIMESTAMP: 2026-03-23-19-45
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const logger = require("firebase-functions/logger");

/**
 * Universal Proxy Function
 * Handles: Vehicle Details, MOT History, and Postcode Lookups
 */
exports.generatecontent = onRequest({ 
  region: "europe-west1", 
  cors: true, 
  timeoutSeconds: 60 
}, async (req, res) => {
  try {
    // 1. Get all query parameters from your frontend services
    // This includes vrm, postcode, apikey, and packagename
    const queryParams = req.query;

    if (!queryParams.packagename) {
      return res.status(400).json({ error: "Missing packagename" });
    }

    // 2. The Provider's Base URL
    const baseUrl = `https://uk.api.vehicledataglobal.com/r2/lookup`;

    logger.info(`Proxying ${queryParams.packagename} for: ${queryParams.vrm || queryParams.postcode}`);

    // 3. Forward the request to Vehicle Data Global
    const response = await axios.get(baseUrl, {
      params: queryParams,
      // Ensure we pass through headers if the provider requires them
      headers: { 'Accept': 'application/json' }
    });

    // 4. Return the REAL JSON payload back to your frontend services
    // This fixes the "Unexpected token H" because it's now sending {...}
    res.json(response.data);

  } catch (error) {
    logger.error("Proxy Error:", error.message);
    
    // Send a structured JSON error so your frontend catch blocks work
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { error: "Provider unreachable", message: error.message };
    
    res.status(status).json(errorData);
  }
});

// Pinned version 001 for guaranteed resolution in europe-west1
async function runGeminiAction(request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    logger.error("GEMINI_API_KEY environment variable is not set.");
    throw new HttpsError("internal", "AI service is not configured.");
  }

  const prompt = request.data?.prompt;
  if (!prompt) {
    throw new HttpsError("invalid-argument", 'The function must be called with a "prompt" argument.');
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    // Explicitly using the confirmed gemini-2.5-flash model from your list
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return { text };
  } catch (error) {
    logger.error("Gemini API Error Detail:", {
      message: error.message,
      status: error.status,
      stack: error.stack
    });
    throw new HttpsError("internal", `Error generating content from AI: ${error.message}`);
  }
}

// Clear call names to ensure no conflicts on Cloud Run
exports.geminiGenerateContent = onCall({ region: "europe-west1", secrets: ["GEMINI_API_KEY"] }, runGeminiAction);