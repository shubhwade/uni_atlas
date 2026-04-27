const { GoogleGenerativeAI } = require("@google/generative-ai");

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is missing");
  }
  return new GoogleGenerativeAI(key);
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function chatCompletion(systemPrompt, userPrompt, jsonMode = false) {
  const genAI = getClient();
  const modelNames = [
    "gemini-1.5-flash",
    "gemini-1.5",
    "gemini-1.5-pro",
    "gemini-1.5-mini",
    "gemini-1.0",
  ];

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  const generationConfig = jsonMode ? { responseMimeType: "application/json" } : undefined;
  let lastError = null;

  for (const modelName of modelNames) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        return text;
      } catch (err) {
        lastError = err;
        console.error(`Gemini model ${modelName} attempt ${attempt + 1} failed:`, err.message);

        if (err.message?.includes("404") || err.message?.includes("not found") || err.message?.includes("not supported")) {
          break; // try next model name
        }

        if (err.message?.includes("429") || err.message?.includes("quota")) {
          if (attempt < 1) {
            await sleep(2000 + attempt * 1000);
            continue;
          }
        }

        if (attempt < 1) {
          await sleep(1000);
          continue;
        }
      }
    }
  }

  if (lastError) {
    throw new Error(`Gemini failed: ${lastError.message}`);
  }
  throw new Error("Gemini failed with no usable model response");
}

async function visionCompletion(systemPrompt, imageUrl, userPrompt) {
  const genAI = getClient();
  
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
  });

  // Download image and convert to base64
  const fetch = require("node-fetch");
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  const base64 = buffer.toString('base64');
  
  // Determine mime type from URL
  let mimeType = "image/jpeg";
  if (imageUrl.includes(".png")) mimeType = "image/png";
  if (imageUrl.includes(".webp")) mimeType = "image/webp";

  const fullPrompt = systemPrompt 
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const result = await model.generateContent([
    fullPrompt,
    {
      inlineData: {
        data: base64,
        mimeType: mimeType,
      },
    },
  ]);

  const visionResponse = await result.response;
  return visionResponse.text();
}

module.exports = {
  chatCompletion,
  visionCompletion,
};
