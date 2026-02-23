
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { defineString } = require('firebase-functions/params');

admin.initializeApp();

// Define the Gemini API key as a parameter for the function
const geminiApiKey = defineString('GEMINI_API_KEY');

exports.generate = functions.region('europe-west1').https.onCall(async (data, context) => {
  // Initialize the AI model within the function call
  const genAI = new GoogleGenerativeAI(geminiApiKey.value());

  const { prompt, modelName } = data;

  if (!prompt || !modelName) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "prompt" and "modelName" arguments.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { text: response.text() };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate content from Gemini API.');
  }
});
