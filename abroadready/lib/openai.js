const OpenAI = require("openai");

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is missing");
  }
  return new OpenAI({ apiKey: key });
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function chatCompletion(systemPrompt, userPrompt, jsonMode = false) {
  const client = getClient();

  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: String(systemPrompt || "") },
      { role: "user", content: String(userPrompt || "") },
    ],
  };
  if (jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resp = await client.chat.completions.create(payload);
      return resp?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 429 && attempt === 0) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
  return "";
}

async function visionCompletion(systemPrompt, imageUrl, userPrompt) {
  const client = getClient();

  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: String(systemPrompt || "") },
      {
        role: "user",
        content: [
          { type: "text", text: String(userPrompt || "") },
          { type: "image_url", image_url: { url: String(imageUrl || "") } },
        ],
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resp = await client.chat.completions.create(payload);
      return resp?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 429 && attempt === 0) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
  return "";
}

module.exports = {
  chatCompletion,
  visionCompletion,
};

