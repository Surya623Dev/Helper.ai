// This Netlify Serverless Function securely generates a short-lived
// ephemeral token required for the Gemini Live WebSocket connection.
// It relies on the GEMINI_API_KEY environment variable set in Netlify.

// We will use standard Node.js fetch for robustness instead of relying on a specific SDK version.
// The base endpoint for token generation (using the public Gemini API infrastructure).
const BASE_TOKEN_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const LIVE_MODEL_ID = "gemini-2.5-flash-live-preview";
const MAX_TOKEN_DURATION_SECONDS = 1800; // 30 minutes

export async function handler(event, context) {
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Check for API Key availability (for safety)
    if (!apiKey) {
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
        // 3. Construct the API URL and Payload
        const url = `${BASE_TOKEN_URL}/${LIVE_MODEL_ID}:generateContentAsEphemeralToken?key=${apiKey}`;
        
        const payload = {
            durationSeconds: MAX_TOKEN_DURATION_SECONDS,
        };

        // 4. Send the POST request to generate the ephemeral token
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // 5. Handle response status
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(`API Token Generation Failed: ${response.status} - ${JSON.stringify(errorBody)}`);
        }

        const tokenResponse = await response.json();
        const ephemeralToken = tokenResponse.token;
        const webSocketUrl = tokenResponse.url;

        // 6. Return the token and URL securely
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
        // Logging the error structure to help with further debugging
        console.error("Error generating ephemeral token:", error.message, "Full Error:", error); 
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "Failed to generate token", 
                detail: error.message 
            }),
        };
    }
}
