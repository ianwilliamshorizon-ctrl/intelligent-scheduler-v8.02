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

/**
 * Outbound Email sending via Office 365 SMTP
 */
exports.sendEmail = onCall({ 
  region: "europe-west1", 
  secrets: ["SMTP_USER", "SMTP_PASS", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID", "MICROSOFT_EMAIL_SENDER"] 
}, async (request) => {
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
  const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const microsoftTenantId = process.env.MICROSOFT_TENANT_ID;
  const microsoftEmailSender = process.env.MICROSOFT_EMAIL_SENDER;

  const { to, fromName, fromEmail, subject, body, attachment } = request.data || {};

  if (!to || !subject || !body) {
    throw new HttpsError("invalid-argument", "Missing required email fields (to, subject, body).");
  }

  // If MS Graph API secrets are configured, use Microsoft Graph
  if (microsoftClientId && microsoftClientSecret && microsoftTenantId && microsoftEmailSender) {
    try {
      logger.info(`MS Graph API secrets found. Attempting to send email via MS Graph...`);
      
      // 1. Get access token from Entra ID
      const tokenUrl = `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`;
      const tokenParams = new URLSearchParams();
      tokenParams.append("client_id", microsoftClientId);
      tokenParams.append("scope", "https://graph.microsoft.com/.default");
      tokenParams.append("client_secret", microsoftClientSecret);
      tokenParams.append("grant_type", "client_credentials");

      const tokenResponse = await axios.post(tokenUrl, tokenParams.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error("No access token returned from Microsoft Entra ID.");
      }

      // 2. Prepare MS Graph sendMail JSON payload
      const resolvedFromEmail = fromEmail || microsoftEmailSender;
      const resolvedFromName = fromName || "Brookspeed";

      const toRecipients = to.split(/[,;]/).map(email => ({
        emailAddress: { address: email.trim() }
      })).filter(r => r.emailAddress.address);

      const mailBody = {
        message: {
          subject: subject,
          body: {
            contentType: "HTML",
            content: body.replace(/\n/g, "<br>")
          },
          toRecipients: toRecipients,
          replyTo: [
            {
              emailAddress: { address: resolvedFromEmail }
            }
          ],
          bccRecipients: [
            {
              emailAddress: { address: microsoftEmailSender }
            }
          ]
        },
        saveToSentItems: "true"
      };

      if (attachment && attachment.content && attachment.filename) {
        mailBody.message.attachments = [
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: attachment.filename,
            contentType: attachment.type || "application/pdf",
            contentBytes: attachment.content // base64 string
          }
        ];
      }

      const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${microsoftEmailSender}/sendMail`;
      logger.info(`Sending email to ${to} using MS Graph API via ${microsoftEmailSender}`);

      await axios.post(sendMailUrl, mailBody, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });

      return { success: true };
    } catch (msError) {
      logger.error("MS Graph API Mail Error:", msError.response?.data || msError.message);
      // Fallback to SMTP if configured
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      if (smtpUser && smtpPass) {
        logger.warn("MS Graph API failed. Attempting fallback to SMTP...");
      } else {
        throw new HttpsError("internal", `MS Graph API email failed: ${msError.message}`);
      }
    }
  }

  // Fallback / Default: SMTP implementation
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    logger.error("SMTP_USER or SMTP_PASS secrets are not set.");
    throw new HttpsError("internal", "Mail service is not configured.");
  }

  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false
    }
  });

  const resolvedFromEmail = fromEmail || smtpUser;
  const resolvedFromName = fromName || "Brookspeed";

  const mailOptions = {
    from: `"${resolvedFromName}" <${smtpUser}>`,
    to: to,
    replyTo: resolvedFromEmail,
    bcc: smtpUser,
    subject: subject,
    text: body,
    html: body.replace(/\n/g, "<br>")
  };

  if (attachment && attachment.content && attachment.filename) {
    mailOptions.attachments = [
      {
        content: attachment.content,
        filename: attachment.filename,
        encoding: "base64",
        contentType: attachment.type || "application/pdf"
      }
    ];
  }

  try {
    logger.info(`Sending email to ${to} using SMTP user ${smtpUser}`);
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    logger.error("SMTP Mail Error:", error.message);
    throw new HttpsError("internal", `Failed to send email: ${error.message}`);
  }
});

/**
 * Inbound Email Webhook (triggered by SendGrid Inbound Parse)
 * Parses incoming email, searches for matching customer/documents,
 * and creates an Inquiry Card.
 */
exports.inboundEmailWebhook = onRequest({
  region: "europe-west1",
  cors: true,
  secrets: ["GEMINI_API_KEY"]
}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    let fields = {};
    if (req.headers["content-type"] && req.headers["content-type"].includes("application/json")) {
      fields = req.body || {};
    } else {
      // Parse multipart form data
      const Busboy = require("busboy");
      fields = await new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const parsedFields = {};
        busboy.on("field", (fieldname, val) => {
          parsedFields[fieldname] = val;
        });
        busboy.on("finish", () => resolve(parsedFields));
        busboy.on("error", (err) => reject(err));
        req.pipe(busboy);
      });
    }

    const fromField = fields.from || ""; // e.g. "John Doe <john@example.com>"
    const toField = fields.to || ""; // e.g. "trimming@brookspeed.com"
    const subject = fields.subject || "";
    const textBody = fields.text || fields.body || fields.html || "";

    logger.info(`Received inbound email from ${fromField} to ${toField}. Subject: "${subject}"`);

    // Parse email and name from "from" header
    let fromEmail = "";
    let fromName = "";
    const emailMatch = fromField.match(/<([^>]+)>/);
    if (emailMatch) {
      fromEmail = emailMatch[1].trim();
      fromName = fromField.replace(emailMatch[0], "").replace(/"/g, "").trim();
    } else {
      fromEmail = fromField.trim();
      fromName = fromField.trim();
    }

    // Parse clean recipient email
    let recipientEmail = toField;
    const recipientMatch = toField.match(/<([^>]+)>/);
    if (recipientMatch) {
      recipientEmail = recipientMatch[1].trim();
    }

    let matchedCustomerId = null;
    let matchedVehicleId = null;
    let matchedEstimateId = null;

    const db = admin.firestore();

    // 1. Look up customer by email
    if (fromEmail) {
      const customerSnap = await db.collection("brooks_customers")
        .where("email", "==", fromEmail)
        .limit(1)
        .get();
      
      if (!customerSnap.empty) {
        matchedCustomerId = customerSnap.docs[0].id;
        logger.info(`Matched customer ID: ${matchedCustomerId}`);
      }
    }

    // 2. Look up estimate/document reference in subject line
    // Matches patterns like "Estimate #1024", "Estimate 1024", "Invoice #3090"
    const refMatch = subject.match(/(?:Estimate|Invoice|Purchase\s*Order|Job)\s*#?\s*([a-zA-Z0-9_-]+)/i);
    if (refMatch) {
      const refId = refMatch[1].trim();
      logger.info(`Found reference ID in subject: ${refId}`);

      // Try searching for estimate number or ID
      const estimateSnap = await db.collection("brooks_estimates")
        .where("estimateNumber", "==", refId)
        .limit(1)
        .get();

      if (!estimateSnap.empty) {
        const estDoc = estimateSnap.docs[0];
        matchedEstimateId = estDoc.id;
        matchedCustomerId = matchedCustomerId || estDoc.data().customerId;
        matchedVehicleId = estDoc.data().vehicleId;
        logger.info(`Matched estimate ID: ${matchedEstimateId}`);
      } else {
        // Try exact document ID match for estimate
        const estDocById = await db.collection("brooks_estimates").doc(refId).get();
        if (estDocById.exists) {
          matchedEstimateId = estDocById.id;
          matchedCustomerId = matchedCustomerId || estDocById.data().customerId;
          matchedVehicleId = estDocById.data().vehicleId;
          logger.info(`Matched estimate ID by document ID: ${matchedEstimateId}`);
        }
      }
    }

    let entityId = null;
    let classificationReason = "";

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
Analyze the following email subject and body received by a vehicle service center.
Determine:
1. Is this email a new request, inquiry, or question regarding an estimate, quotation, pricing, or booking/scheduling a service? (true/false)
2. Which business entity does this email best match? Use one of the following exact entity IDs:
   - 'ent_porsche' (for Porsche vehicles, Porsche performance tuning, or Porsche servicing)
   - 'ent_audi' (for Audi, VW, Volkswagen, Seat, Skoda, or general German cars servicing/repair)
   - 'ent_trimming' (for car upholstery, leather repair, hood/soft top replacement, interior re-trim, coachbuilding)
   - 'ent_sales' (for buying or selling cars, vehicle sales inquiries, car showroom)
   - 'ent_storage' (for secure vehicle storage, car storage)
   - 'ent_rentals' (for renting cars, hire cars, courtesy cars)
   If it's none of the above or ambiguous, return null.

Format your response as a valid JSON object with the following fields:
{
  "isEstimateOrQuoteRequest": boolean,
  "matchedEntityId": string | null,
  "reasoning": "brief description of why this classification was made"
}

Email Subject: "${subject.replace(/"/g, '\\"')}"
Email Body:
${textBody}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Strip markdown code block wrappers if any
        const cleanJsonText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const classification = JSON.parse(cleanJsonText);

        if (classification.matchedEntityId) {
          entityId = classification.matchedEntityId;
        }
        classificationReason = classification.reasoning || "";
        logger.info(`Gemini classified email: Entity=${entityId}, QuoteRequest=${classification.isEstimateOrQuoteRequest}, Reason=${classificationReason}`);
      } catch (geminiError) {
        logger.error("Error using Gemini for email classification:", geminiError.message);
      }
    }

    // Fallback to estimate's entity if matched
    if (!entityId && matchedEstimateId) {
      try {
        const estDoc = await db.collection("brooks_estimates").doc(matchedEstimateId).get();
        if (estDoc.exists) {
          entityId = estDoc.data().entityId;
          logger.info(`Fallback: Matched entity ID from estimate: ${entityId}`);
        }
      } catch (err) {
        logger.error("Error fetching fallback estimate entity:", err.message);
      }
    }

    // Default to Porsche if completely unmatched
    entityId = entityId || "ent_porsche";

    // 3. Create Inquiry Card
    const newInquiry = {
      createdAt: new Date().toISOString(),
      fromName: fromName || fromEmail || "Unknown Sender",
      fromContact: fromEmail || "No Email",
      message: textBody || "Received email with empty text body.",
      takenByUserId: "system",
      status: "New",
      linkedCustomerId: matchedCustomerId,
      linkedVehicleId: matchedVehicleId,
      linkedEstimateId: matchedEstimateId,
      entityId: entityId,
      actionNotes: `[System]: Created automatically from email reply sent to ${recipientEmail}.\nSubject: "${subject}"${classificationReason ? `\nAI Classification: ${classificationReason}` : ''}`
    };

    const docRef = await db.collection("brooks_inquiries").add(newInquiry);
    logger.info(`Successfully created Inquiry Card: ${docRef.id}`);

    res.status(200).json({ success: true, inquiryId: docRef.id });
  } catch (error) {
    logger.error("Inbound Webhook Parsing Error:", error);
    res.status(500).send(`Internal Webhook Error: ${error.message}`);
  }
});