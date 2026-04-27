const cron = require("node-cron");

const { getCurrentRates, updateAllCourseINRPrices } = require("./forex");
const { syncTopUniversities } = require("./collegeScorecard");
const { updateCountryLivingCosts } = require("./numbeo");
const { getDB } = require("../database/db");

async function updateAllForexRates() {
  const res = await getCurrentRates();
  updateAllCourseINRPrices();
  return res;
}

async function syncResearchDataWeekly() {
  // Placeholder hook point: will be driven from admin routes per-university to avoid huge API calls at once.
  return { ok: true };
}

async function checkScholarshipDeadlines() {
  // Will be implemented after routes + notification rules are in place
  return { ok: true };
}

async function sendDeadlineDigest() {
  // Will be implemented after routes + notifications/email templates
  return { ok: true };
}

function registerCronJobs() {
  // Every 4 hours
  cron.schedule("0 */4 * * *", async () => {
    try {
      const r = await updateAllForexRates();
      // eslint-disable-next-line no-console
      console.log(`[cron] forex updated (${r.source}) at ${r.updatedAt}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cron] forex update failed", e?.message || e);
    }
  });

  // Sunday 2 AM
  cron.schedule("0 2 * * 0", async () => {
    try {
      const r = await syncTopUniversities();
      // eslint-disable-next-line no-console
      console.log(`[cron] scorecard sync ok: ${r.synced}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cron] scorecard sync failed", e?.message || e);
    }
  });

  // Daily 9 AM
  cron.schedule("0 9 * * *", async () => {
    try {
      await checkScholarshipDeadlines();
      // eslint-disable-next-line no-console
      console.log("[cron] scholarship deadline check ok");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cron] scholarship deadline check failed", e?.message || e);
    }
  });

  // Daily 8 AM
  cron.schedule("0 8 * * *", async () => {
    try {
      await sendDeadlineDigest();
      // eslint-disable-next-line no-console
      console.log("[cron] deadline digest ok");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cron] deadline digest failed", e?.message || e);
    }
  });

  // Monthly living cost refresh: 1st day 03:00
  cron.schedule("0 3 1 * *", async () => {
    try {
      const db = getDB();
      const codes = db.prepare("SELECT code FROM countries").pluck().all();
      for (const code of codes) {
        await updateCountryLivingCosts(code).catch(() => null);
      }
      // eslint-disable-next-line no-console
      console.log("[cron] living cost refresh complete");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cron] living cost refresh failed", e?.message || e);
    }
  });

  // Weekly research sync hook (Monday 03:30)
  cron.schedule("30 3 * * 1", async () => {
    try {
      await syncResearchDataWeekly();
      // eslint-disable-next-line no-console
      console.log("[cron] research weekly hook ok");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cron] research weekly hook failed", e?.message || e);
    }
  });
}

module.exports = {
  registerCronJobs,
  updateAllForexRates,
};

