const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();
// FORCE DEPLOY TIMESTAMP: 2026-05-05-09-57
const axios = require("axios");
const logger = require("firebase-functions/logger");

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
    const { GoogleGenerativeAI } = require("@google/generative-ai");
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
            const textToSpeech = require('@google-cloud/text-to-speech');
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

/**
 * AUTOMATED SYSTEM BACKUP (SERVER-SIDE)
 * Runs at 02:00 and 14:00 daily
 */
exports.performScheduledBackup = onSchedule({
    schedule: "0 2,14 * * *",
    timeZone: "Europe/London",
    region: "europe-west1",
    memory: "1GiB",
    timeoutSeconds: 300
}, async (event) => {
    logger.info("Starting Scheduled System Backup...");
    
    const collections = [
        'brooks_jobs', 'brooks_vehicles', 'brooks_customers', 'brooks_estimates', 
        'brooks_invoices', 'brooks_purchaseOrders', 'brooks_purchases', 'brooks_parts', 
        'brooks_servicePackages', 'brooks_suppliers', 'brooks_engineers', 'brooks_lifts', 
        'brooks_rentalVehicles', 'brooks_rentalBookings', 'brooks_saleVehicles', 
        'brooks_saleOverheadPackages', 'brooks_prospects', 'brooks_storageBookings', 
        'brooks_storageLocations', 'brooks_batteryChargers', 'brooks_nominalCodes', 
        'brooks_nominalCodeRules', 'brooks_absenceRequests', 'brooks_inquiries', 
        'brooks_reminders', 'brooks_businessEntities', 'brooks_taxRates', 'brooks_roles', 
        'brooks_inspectionDiagrams', 'brooks_inspectionTemplates', 'brooks_discountCodes', 
        'brooks_users', 'brooks_settings'
    ];

    try {
        const backupData = {
            backupSchemaVersion: '1.1',
            backupDate: new Date().toISOString(),
            source: 'Cloud Functions (Automated)',
            data: {}
        };

        // 1. Fetch all data from all collections
        for (const colName of collections) {
            const snapshot = await admin.firestore().collection(colName).get();
            backupData.data[colName] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            logger.info(`Backed up ${snapshot.docs.length} records from ${colName}`);
        }

        // 2. Format filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backups/backup_auto_server_${timestamp}.json`;
        
        // 3. Upload to Storage
        const bucket = admin.storage().bucket();
        const file = bucket.file(filename);
        
        await file.save(JSON.stringify(backupData), {
            contentType: 'application/json',
            metadata: {
                metadata: {
                    source: 'AutomatedServerBackup'
                }
            }
        });

        logger.info(`Successfully completed backup: ${filename}`);
        
        // 4. Cleanup old backups based on retention policy:
        // - Keep all backups for 7 days
        // - Keep Sunday backups for 3 months (90 days)
        // - Delete everything else
        logger.info("Starting backup retention cleanup...");
        const [files] = await bucket.getFiles({ prefix: 'backups/backup_auto_' });
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

        let deletedCount = 0;
        for (const f of files) {
            // Skip the file we just created
            if (f.name === filename) continue;

            // Extract date from filename: backup_auto_[server_]YYYY-MM-DD...
            // Format: backup_auto_server_2026-05-11T09-34-31-000Z.json
            const datePart = f.name.match(/\d{4}-\d{2}-\d{2}/);
            if (!datePart) continue;

            const fileDate = new Date(datePart[0]);
            const isSunday = fileDate.getDay() === 0;

            let shouldKeep = false;

            if (fileDate > sevenDaysAgo) {
                // Within 7 days - Keep all
                shouldKeep = true;
            } else if (isSunday && fileDate > threeMonthsAgo) {
                // Sunday backup within 3 months - Keep
                shouldKeep = true;
            }

            if (!shouldKeep) {
                await f.delete();
                deletedCount++;
                logger.info(`Deleted old backup: ${f.name}`);
            }
        }
        logger.info(`Cleanup complete. Deleted ${deletedCount} old backups.`);

    } catch (error) {
        logger.error("Scheduled Backup Failed:", error);
    }
});