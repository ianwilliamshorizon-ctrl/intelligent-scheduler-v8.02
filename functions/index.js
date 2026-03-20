const { onRequest } = require("firebase-functions/v2/https");
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