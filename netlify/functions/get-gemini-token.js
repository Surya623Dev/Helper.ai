// netlify/functions/get-gemini-token.js
// Purpose: Generate ephemeral token for Gemini Live using the most reliable public v1beta endpoint structure.

const BASE_TOKEN_URL = "https://generativelanguage.googleapis.com/v1beta";
const TOKEN_GENERATION_MODEL_ID = "models/gemini-2.5-flash"; // Verified to exist on your account
const TARGET_LIVE_MODEL_ID = "models/gemini-2.5-flash-live-preview";
const MAX_TOKEN_DURATION_SECONDS = 1800; // 30 minutes

export async function handler(event) {
  // Allow GET/POST only
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Handle CORS pre-flight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        body: ''
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY env var");
    return { statusCode: 500, body: JSON.stringify({ error: "Server error: Missing GEMINI_API_KEY" }) };
  }

  // Final, most accurate URL structure for this method
  const url = `${BASE_TOKEN_URL}/${encodeURIComponent(TOKEN_GENERATION_MODEL_ID)}:generateContentAsEphemeralToken?key=${encodeURIComponent(apiKey)}`;

  // Payload includes liveConfig, which is critical for Live API access
  const payload = {
    durationSeconds: MAX_TOKEN_DURATION_SECONDS,
    liveConfig: {
      model: TARGET_LIVE_MODEL_ID,
      audio: {
        encoding: "linear16",
        sampleRateHertz: 16000
      },
    }
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text().catch(() => "");

    if (!resp.ok) {
      console.error("API Token Generation Failed:", resp.status, raw);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "API Token Generation Failed",
          status: resp.status,
          raw_response_text: raw || null
        })
      };
    }

    let tokenResponse;
    try {
      tokenResponse = JSON.parse(raw || "{}");
    } catch (e) {
      console.error("Failed to parse JSON token response, raw:", raw);
      return { statusCode: 500, body: JSON.stringify({ error: "Invalid JSON from token endpoint", raw }) };
    }

    const ephemeralToken = tokenResponse.token ?? tokenResponse.name ?? tokenResponse.authToken ?? null;
    const webSocketUrl = tokenResponse.url ?? tokenResponse.websocketUrl ?? null;

    if (!ephemeralToken) {
      console.error("Token not present in tokenResponse:", tokenResponse);
      return { statusCode: 500, body: JSON.stringify({ error: "Missing token in response", tokenResponse }) };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        token: ephemeralToken,
        websocketUrl,
        modelId: TOKEN_GENERATION_MODEL_ID,
        targetLiveModel: TARGET_LIVE_MODEL_ID,
        expiresInSeconds: MAX_TOKEN_DURATION_SECONDS,
        rawResponse: tokenResponse
      })
    };
  } catch (err) {
    console.error("Unhandled error generating token:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to generate token", detail: String(err) }) };
  }
}
