const fetch = require("node-fetch");

function getClient() {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) {
    throw new Error("HUGGINGFACE_API_KEY is missing");
  }
  return key;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function chatCompletion(systemPrompt, userPrompt, jsonMode = false) {
  const apiKey = getClient();

  // Use Mistral-7B-Instruct for better instruction following and JSON support
  const model = "mistralai/Mistral-7B-Instruct-v0.1";

  // Combine system prompt with user prompt for better instruction following
  const fullPrompt = systemPrompt 
    ? `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`
    : `${userPrompt}\n\nResponse:`;

  const payload = {
    inputs: fullPrompt,
    parameters: {
      max_new_tokens: 2048,
      temperature: 0.3,
      top_p: 0.9,
      top_k: 50,
      do_sample: true,
      repetition_penalty: 1.2,
    },
    options: {
      wait_for_model: true,
      use_cache: false,
    }
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        if (response.status === 503) {
          console.warn(`Model loading on attempt ${attempt + 1}, waiting...`);
          await sleep(3000);
          continue;
        }
        throw new Error(`Hugging Face API error: ${response.status} ${error}`);
      }

      const data = await response.json();

      // Extract generated text from response
      let generatedText = "";
      if (Array.isArray(data) && data.length > 0) {
        generatedText = data[0].generated_text || "";
      } else if (data.generated_text) {
        generatedText = data.generated_text;
      }

      // Clean up the response - remove the prompt from the output
      generatedText = generatedText.replace(fullPrompt, "").trim();

      if (!generatedText) {
        throw new Error("Empty response from Hugging Face");
      }

      // If JSON mode is requested, try to extract JSON from response
      if (jsonMode) {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return jsonMatch[0];
        }
        // If no JSON found, still return the text (caller will handle)
      }

      return generatedText;

    } catch (err) {
      console.error(`Hugging Face attempt ${attempt + 1} failed:`, err.message);
      if (attempt === 2) throw err;
      await sleep(2000 + attempt * 1000);
    }
  }

  throw new Error("Failed to get response from Hugging Face after 3 attempts");
}

async function visionCompletion(systemPrompt, imageUrl, userPrompt) {
  // Hugging Face has vision models, but for free tier we'll use text-only
  // You could implement image captioning with models like "Salesforce/blip-image-captioning-base"
  // For now, return a text-based response
  return chatCompletion(systemPrompt, `Describe this image context: ${userPrompt}`);
}

async function analyzeResume(text) {
  const prompt = `Analyze this resume and extract key information in JSON format:
  Resume text: ${text}

  Return JSON with: name, email, phone, skills, experience_years, education, summary`;

  const response = await chatCompletion("", prompt, true);

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(response);
    return {
      name: parsed.name || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience_years: parsed.experience_years || 0,
      education: parsed.education || "",
      summary: parsed.summary || "",
    };
  } catch (e) {
    // Fallback parsing
    return {
      name: text.split('\n')[0] || "",
      email: text.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || "",
      phone: text.match(/[\+]?[1-9][\d]{0,15}/)?.[0] || "",
      skills: [],
      experience_years: 0,
      education: "",
      summary: text.substring(0, 200),
    };
  }
}

async function generatePrediction(admissionData) {
  const prompt = `Based on this student profile, predict admission chances:
  GPA: ${admissionData.gpa}
  Test Scores: ${admissionData.testScores}
  University: ${admissionData.university}
  Course: ${admissionData.course}

  Give a percentage chance and brief reasoning.`;

  return chatCompletion("", prompt);
}

async function getFinancialAdvice(budgetData) {
  const prompt = `Give financial advice for studying abroad with this budget:
  Monthly Budget: ${budgetData.monthlyBudget} ${budgetData.currency}
  Duration: ${budgetData.duration} months
  Country: ${budgetData.country}

  Provide practical tips for saving money.`;

  return chatCompletion("", prompt);
}

async function matchScholarships(profile) {
  const prompt = `Find suitable scholarships for this student:
  Nationality: ${profile.nationality}
  Course: ${profile.course}
  GPA: ${profile.gpa}
  Financial Need: ${profile.financialNeed}

  Suggest 3-5 relevant scholarships with brief descriptions.`;

  return chatCompletion("", prompt);
}

module.exports = {
  chatCompletion,
  visionCompletion,
  analyzeResume,
  generatePrediction,
  getFinancialAdvice,
  matchScholarships,
};