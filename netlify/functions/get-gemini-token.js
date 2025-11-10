// netlify/functions/get-gemini-token.js
// Purpose: Generate ephemeral token for Gemini Live using strict v1beta endpoint and fully-qualified model names.

const BASE_TOKEN_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TOKEN_GENERATION_MODEL_ID = "models/gemini-2.5-flash"; // verified in your model list
const TARGET_LIVE_MODEL_ID = "models/gemini-2.5-flash-live-preview"; // fully-qualified live model
const MAX_TOKEN_DURATION_SECONDS = 1800; // 30 minutes

export async function handler(event) {
  // Allow GET/POST only
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY env var");
    return { statusCode: 500, body: JSON.stringify({ error: "Server error: Missing GEMINI_API_KEY" }) };
  }

  const url = `${BASE_TOKEN_URL}/${encodeURIComponent(TOKEN_GENERATION_MODEL_ID)}:generateContentAsEphemeralToken?key=${encodeURIComponent(apiKey)}`;

  // Strict payload shape for ephemeral token generation + live usage
  const payload = {
    // token lifetime
    durationSeconds: MAX_TOKEN_DURATION_SECONDS,
    // liveConfig instructs the token to be used for a Live websocket session
    liveConfig: {
      model: TARGET_LIVE_MODEL_ID,
      audio: {
        encoding: "linear16",
        sampleRateHertz: 16000
      },
      // If you want to constrain response modalities, add them here:
      // responseModalities: ["TEXT", "AUDIO"]
    }
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Capture raw body for debugging even if empty
    const raw = await resp.text().catch(() => "");

    if (!resp.ok) {
      // log status + raw body (so you don't get "null")
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

    // Try parse JSON success response; if parse fails, return raw text for debugging
    let tokenResponse;
    try {
      tokenResponse = JSON.parse(raw || "{}");
    } catch (e) {
      console.error("Failed to parse JSON token response, raw:", raw);
      return { statusCode: 500, body: JSON.stringify({ error: "Invalid JSON from token endpoint", raw }) };
    }

    // Common fields may be token, name, url
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
        rawResponse: tokenResponse // useful for debugging; remove in production
      })
    };
  } catch (err) {
    console.error("Unhandled error generating token:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to generate token", detail: String(err) }) };
  }
}
