const { onRequest } = require("firebase-functions/v2/https");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
// FORCE DEPLOY TIMESTAMP: 2026-03-23-19-45
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const logger = require("firebase-functions/logger");
const textToSpeech = require('@google-cloud/text-to-speech');

let ttsClient = null;

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

  let prompt = request.data?.prompt;
  if (!prompt) {
    throw new HttpsError("invalid-argument", 'The function must be called with a "prompt" argument.');
  }

  // If the prompt is an object (e.g. a list of items), stringify it so Gemini can read it
  if (typeof prompt !== 'string') {
    prompt = JSON.stringify(prompt, null, 2);
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
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

// Google Cloud Text-to-Speech function
exports.synthesizeSpeech = onCall({ region: "europe-west1" }, async (request) => {
    const text = request.data?.text;
    const voiceName = request.data?.voiceName || 'en-GB-Neural2-A';
    const languageCode = request.data?.languageCode || 'en-GB';

    if (!text) {
        throw new HttpsError("invalid-argument", 'The function must be called with a "text" argument.');
    }

    try {
        if (!ttsClient) {
            ttsClient = new textToSpeech.TextToSpeechClient();
        }

        const req = {
            input: { text: text },
            voice: { languageCode: languageCode, name: voiceName },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(req);
        
        if (!response.audioContent) {
             throw new HttpsError('internal', 'Failed to generate audio content');
        }

        return { 
            audioContent: Buffer.from(response.audioContent).toString('base64') 
        };
    } catch (error) {
        logger.error("Cloud TTS Error:", error.message);
        throw new HttpsError('internal', `Error generating speech: ${error.message}`);
    }
});

let speechClient = null;

// Google Cloud Speech-to-Text function
exports.transcribeSpeech = onCall({ region: "europe-west1" }, async (request) => {
    const audioContent = request.data?.audioContent;

    if (!audioContent) {
        throw new HttpsError("invalid-argument", 'The function must be called with an "audioContent" argument.');
    }

    try {
        if (!speechClient) {
            const speech = require('@google-cloud/speech');
            speechClient = new speech.SpeechClient();
        }

        const audio = {
            content: audioContent,
        };

        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000, // Typically 48000 for modern browsers
            languageCode: 'en-GB',
            alternativeLanguageCodes: ['en-US'],
            enableAutomaticPunctuation: true,
        };

        const [response] = await speechClient.recognize({ config, audio });
        
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        return { text: transcription };
    } catch (error) {
        logger.error("Cloud STT Error:", error.message);
        throw new HttpsError('internal', `Error transcribing speech: ${error.message}`);
    }
});