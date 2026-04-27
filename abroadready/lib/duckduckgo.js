const fetch = require("node-fetch");

const BASE_URL = process.env.SEARCH_API_URL || "https://api.duckduckgo.com/";

const cache = new Map();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function duckDuckGoSearch(query) {
  const cached = cache.get(query);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const url = new URL(BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse DuckDuckGo response
    const results = [];

    // Add abstract if available
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || "Abstract",
        url: data.AbstractURL,
        content: data.AbstractText,
      });
    }

    // Add definition if available
    if (data.Definition && data.DefinitionURL) {
      results.push({
        title: data.DefinitionSource || "Definition",
        url: data.DefinitionURL,
        content: data.Definition,
      });
    }

    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 3).forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || "Related Topic",
            url: topic.FirstURL,
            content: topic.Text,
          });
        }
      });
    }

    // Add results from Answer if available
    if (data.Answer && data.AnswerURL) {
      results.push({
        title: "Answer",
        url: data.AnswerURL,
        content: data.Answer,
      });
    }

    // Ensure we have at least some results
    if (results.length === 0) {
      results.push({
        title: "Search Results",
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        content: `Search results for: ${query}`,
      });
    }

    // Cache the results
    cache.set(query, {
      expiresAt: Date.now() + TTL_MS,
      data: results.slice(0, 5) // Limit to 5 results
    });

    return results.slice(0, 5);

  } catch (error) {
    console.error("DuckDuckGo search error:", error);

    // Fallback: return a basic result
    return [{
      title: "Search Unavailable",
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      content: `Please visit DuckDuckGo to search for: ${query}`,
    }];
  }
}

function searchUniversityPlacement(uniName, courseName) {
  return duckDuckGoSearch(`placement rate ${uniName} ${courseName} salary`);
}

function searchScholarshipDeadlines(name) {
  return duckDuckGoSearch(`scholarship ${name} deadline application`);
}

function searchScholarships(query) {
  return duckDuckGoSearch(`scholarships ${query} for international students`);
}

function searchUniversities(query) {
  return duckDuckGoSearch(`universities ${query} rankings courses`);
}

function searchCourses(query) {
  return duckDuckGoSearch(`courses ${query} universities programs`);
}

module.exports = {
  duckDuckGoSearch,
  searchUniversityPlacement,
  searchScholarshipDeadlines,
  searchScholarships,
  searchUniversities,
  searchCourses,
};