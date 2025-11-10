// netlify/functions/get-gemini-token.js
// Generate ephemeral Gemini "live" token via Generative Language API (v1alpha)
// Env var: GEMINI_API_KEY (preferred) OR GEMINI_BEARER_TOKEN (optional, if you use OAuth)
// NOTE: Do NOT commit your keys to source control.

const DEFAULT_MAX_TOKEN_SECONDS = 600; // 10 minutes default

exports.handler = async function (event, context) {
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    // Read env vars (user specified GEMINI_API_KEY)
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY && !BEARER) {
      console.error("Missing GEMINI_API_KEY and GEMINI_BEARER_TOKEN env vars");
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Server misconfiguration: API key not set" }),
      };
    }

    // endpoint + model
    const BASE_URL = "https://generativelanguage.googleapis.com/v1alpha";
    const TARGET_LIVE_MODEL_ID = "gemini-live-2.5-flash-preview";
    const maxTokenSeconds = Number(process.env.MAX_TOKEN_SECONDS) || DEFAULT_MAX_TOKEN_SECONDS;
    const expireTime = new Date(Date.now() + maxTokenSeconds * 1000).toISOString();

    const requestBody = {
      authToken: {
        liveConnectConstraints: { model: TARGET_LIVE_MODEL_ID },
        expireTime,
      },
    };

    const url = BEARER && BEARER.length > 0
      ? `${BASE_URL}/authTokens:create`
      : `${BASE_URL}/authTokens:create?key=${encodeURIComponent(API_KEY)}`;

    const headers = { "Content-Type": "application/json" };
    if (BEARER && BEARER.length > 0) headers["Authorization"] = `Bearer ${BEARER}`;

    const fetchResp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const rawText = await fetchResp.text();
    let parsed;
    try { parsed = rawText ? JSON.parse(rawText) : {}; } catch (e) { parsed = { rawText }; }

    if (!fetchResp.ok) {
      console.error(
        "AuthToken create failed",
        "status:", fetchResp.status,
        "statusText:", fetchResp.statusText,
        "responsePreview:", typeof parsed === "object" ? parsed : String(parsed).slice(0, 300)
      );

      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "API Token Generation Failed",
          status: fetchResp.status,
          detail: parsed,
        }),
      };
    }

    const token =
      parsed?.authToken?.name ||
      parsed?.authToken?.token ||
      parsed?.token ||
      parsed?.name ||
      null;

    if (!token) {
      console.warn("No token field found in response; returning full response for inspection");
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: "No standard token field found in upstream response — inspect `rawResponse`",
          rawResponse: parsed,
        }),
      };
    }

    const expiresAt = parsed?.authToken?.expireTime || parsed?.expireTime || expireTime || null;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ephemeralToken: token, expiresAt }),
    };
  } catch (err) {
    console.error("Unexpected error generating ephemeral token:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error", detail: String(err) }),
    };
  }
};
