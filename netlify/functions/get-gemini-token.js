// netlify/functions/get-gemini-token.js
// Purpose: Securely provide the permanent API Key and System Instruction to the client.
// This bypasses the blocked ':generateToken' endpoint.

const TARGET_LIVE_MODEL_ID = "gemini-2.5-flash-live-preview";

// System instruction for interview co-pilot (moved to backend for secure management)
const systemInstruction = `You are an AI Interview Co-Pilot assistant. Your role is to help candidates during technical interviews by providing structured, concise answers.

CRITICAL RULES:
1. Listen to the interviewer's question carefully
2. Provide answers in EXACTLY this format:
    • [Key Point 1]: Brief explanation (max 15 words)
    • [Key Point 2]: Brief explanation (max 15 words)
    • [Key Point 3]: Brief explanation (max 15 words)
    
3. ALWAYS use the STAR method when appropriate (Situation, Task, Action, Result). Structure the bullet points to align with STAR if the question is behavioral.
4. Keep responses to 3-5 bullet points maximum.
5. Focus on technical accuracy and clarity.
6. Never provide full sentences or paragraphs - only structured bullets.`;


export async function handler(event) {
  // Allow GET/OPTIONS only (POST is not needed for a simple key fetch)
  if (event.httpMethod !== "GET" && event.httpMethod !== "OPTIONS") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // Handle CORS pre-flight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY env var");
    return { 
      statusCode: 500, 
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error: Missing GEMINI_API_KEY" }) 
    };
  }

  // Success: Return the necessary data to the client
  return {
    statusCode: 200,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: apiKey,
      targetLiveModel: TARGET_LIVE_MODEL_ID,
      systemInstruction: systemInstruction,
      websocketUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`,
    })
  };
}
