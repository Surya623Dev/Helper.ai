// This Netlify Serverless Function securely generates a short-lived
// ephemeral token required for the Gemini Live WebSocket connection.
// It relies on the GEMINI_API_KEY environment variable set in Netlify.

import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI instance. It automatically picks up
// the GEMINI_API_KEY from environment variables on Netlify.
const ai = new GoogleGenAI({});

// The model ID must be specified for the token generation.
const LIVE_MODEL_ID = "gemini-2.5-flash-live-preview";

// Maximum duration for the ephemeral token (in seconds, max 1800 for 30 min)
const MAX_TOKEN_DURATION_SECONDS = 1800; 

// The expected structure for the Netlify function handler
export async function handler(event, context) {
    // 1. Check for API Key availability (for safety)
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server configuration error: Missing API Key" }),
        };
    }
    
    // 2. Only allow GET or POST methods
    if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method Not Allowed" }),
        };
    }

    try {
        // 3. Generate the Ephemeral Token
        const tokenResponse = await ai.generativeModel.generateContentAsEphemeralToken({
            model: LIVE_MODEL_ID,
            durationSeconds: MAX_TOKEN_DURATION_SECONDS,
            // The Live API automatically applies the Live URL/config to the token.
        });

        const ephemeralToken = tokenResponse.token;
        const webSocketUrl = tokenResponse.url; // The direct WebSocket URL

        // 4. Return the token and URL securely
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                // Essential CORS headers for cross-origin local testing
                "Access-Control-Allow-Origin": "*", 
                "Access-Control-Allow-Methods": "GET, POST",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            body: JSON.stringify({
                token: ephemeralToken,
                websocketUrl: webSocketUrl,
                modelId: LIVE_MODEL_ID,
                expiresInSeconds: MAX_TOKEN_DURATION_SECONDS,
            }),
        };
    } catch (error) {
        console.error("Error generating ephemeral token:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to generate token", detail: error.message }),
        };
    }
}