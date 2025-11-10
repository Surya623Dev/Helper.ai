// netlify/functions/get-gemini-token.js
// Generate an ephemeral token for Gemini Live by calling the stable model endpoint
// and including a liveConfig payload that targets the Live model.
//
// Requirements:
// - Set GEMINI_API_KEY in Netlify site environment variables
// - Netlify uses Node 18+ (fetch available)

const BASE_TOKEN_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TOKEN_GENERATION_MODEL_ID = "models/gemini-2.5-flash"; // verified available for your key
const TARGET_LIVE_MODEL_ID = "models/gemini-2.5-flash-live-preview"; // the Live model you want to use
const MAX_TOKEN_DURATION_SECONDS = 1800; // 30 minutes

export async function handler(event, context) {
  // Allow only GET or POST
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error: Missing API Key" }),
    };
  }

  try {
    // Build URL (use the stable model that exists for your key)
    const url = `${BASE_TOKEN_URL}/${encodeURIComponent(TOKEN_GENERATION_MODEL_ID)}:generateContentAsEphemeralToken?key=${encodeURIComponent(apiKey)}`;

    // Construct payload with liveConfig to indicate this token is for a Live websocket connection.
    // The audio config below is 16kHz PCM (linear16) which is commonly required for Live voice streams.
    const payload = {
      durationSeconds: MAX_TOKEN_DURATION_SECONDS,
      // liveConfig tells the token issuer the intended live usage and constraints
      liveConfig: {
        // The actual Live model identifier (this may be a different "live" alias)
        model: TARGET_LIVE_MODEL_ID,
        // Audio config for microphone streaming: 16kHz, PCM linear16
        audio: {
          encoding: "linear16",      // PCM 16-bit little-endian
          sampleRateHertz: 16000
        },
        // Optionally restrict returned modalities (TEXT, AUDIO, etc).
        // responseModalities: ["TEXT"]
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // If not OK, try to capture the body (json or text) for debugging
    if (!resp.ok) {
      let errBody;
      try { errBody = await resp.json(); } catch { errBody = await resp.text().catch(() => null); }
      console.error("API Token Generation Failed:", resp.status, errBody);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API Token Generation Failed", status: resp.status, detail: errBody }),
      };
    }

    // Parse success response
    let tokenResponse;
    try { tokenResponse = await resp.json(); } catch (e) {
      const raw = await resp.text().catch(() => "");
      console.error("Failed to parse JSON token response:", raw);
      return { statusCode: 500, body: JSON.stringify({ error: "Invalid JSON from token endpoint", raw }) };
    }

    // Common response field names: token, name, url
    const ephemeralToken = tokenResponse.token ?? tokenResponse.name ?? tokenResponse.authToken ?? null;
    const webSocketUrl = tokenResponse.url ?? tokenResponse.websocketUrl ?? null;

    if (!ephemeralToken) {
      console.error("Token response missing token field:", tokenResponse);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing token in response", tokenResponse }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        token: ephemeralToken,
        websocketUrl: webSocketUrl,
        modelId: TOKEN_GENERATION_MODEL_ID,
        targetLiveModel: TARGET_LIVE_MODEL_ID,
        expiresInSeconds: MAX_TOKEN_DURATION_SECONDS,
        rawResponse: tokenResponse // keep for debugging; remove for production
      }),
    };
  } catch (err) {
    console.error("Unhandled error generating token:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate token", detail: String(err) }),
    };
  }
}
