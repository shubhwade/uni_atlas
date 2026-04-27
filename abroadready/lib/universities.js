const fetch = require("node-fetch");

const BASE_URL = process.env.UNIVERSITIES_API_URL || "http://universities.hipolabs.com";

async function searchUniversities(query = "", country = "") {
  try {
    const url = new URL(BASE_URL + "/search");

    if (query) {
      url.searchParams.set("name", query);
    }

    if (country) {
      url.searchParams.set("country", country);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Universities API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to match our expected format
    return data.map(uni => ({
      id: uni.name + uni.country, // Create a simple ID
      name: uni.name,
      city: uni.state_province || "",
      state: uni.country,
      country: uni.country,
      school_url: uni.web_pages?.[0] || "",
      domains: uni.domains || [],
      ownership: "Public", // Default assumption
      size: 0, // Not available in free API
      grad_students: 0, // Not available
      admission_rate: 0, // Not available
      tuition_out_of_state: 0, // Not available
      attendance_academic_year: 0, // Not available
      earnings_10_yrs_after_entry: 0, // Not available
      completion_rate: 0, // Not available
    }));

  } catch (error) {
    console.error("Universities API error:", error);

    // Fallback: return some sample universities
    return [
      {
        id: "sample1",
        name: "Sample University",
        city: "Sample City",
        state: "Sample State",
        country: "United States",
        school_url: "https://example.com",
        domains: ["example.edu"],
        ownership: "Public",
        size: 20000,
        grad_students: 5000,
        admission_rate: 0.3,
        tuition_out_of_state: 35000,
        attendance_academic_year: 45000,
        earnings_10_yrs_after_entry: 60000,
        completion_rate: 0.7,
      }
    ];
  }
}

async function getUniversityByName(name) {
  const results = await searchUniversities(name);
  return results.find(uni =>
    uni.name.toLowerCase().includes(name.toLowerCase())
  ) || null;
}

async function getUniversitiesByCountry(country) {
  return searchUniversities("", country);
}

async function getTopUniversities(limit = 10) {
  // This free API doesn't have rankings, so return popular ones
  const popularCountries = ["United States", "United Kingdom", "Canada", "Australia", "Germany"];

  const allResults = [];
  for (const country of popularCountries) {
    const results = await searchUniversities("", country);
    allResults.push(...results.slice(0, 2)); // 2 from each country
    if (allResults.length >= limit) break;
  }

  return allResults.slice(0, limit);
}

module.exports = {
  searchUniversities,
  getUniversityByName,
  getUniversitiesByCountry,
  getTopUniversities,
};