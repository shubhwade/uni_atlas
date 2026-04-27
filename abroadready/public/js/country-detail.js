(() => {
  const { fetchAPI, showToast, formatINR } = window.AbroadReady;

  function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  async function render(code) {
    const [c, banks, jobs] = await Promise.all([
      fetchAPI(`/api/countries/${encodeURIComponent(code)}`),
      fetchAPI(`/api/countries/${encodeURIComponent(code)}/banks`).catch(() => ({ banks: {} })),
      fetchAPI(`/api/countries/${encodeURIComponent(code)}/jobs`).catch(() => ({ jobs: {} })),
    ]);

    const country = c.country;
    document.getElementById("title").textContent = `${country.flag_emoji || ""} ${country.name}`;
    document.getElementById("sub").textContent = `${country.currency_symbol || ""}${country.currency} - 1 ${country.currency} = INR ${Number(country.exchange_rate_to_inr || 0).toFixed(2)}`;
    document.getElementById("earningLink").href = `/earning?code=${encodeURIComponent(code)}`;

    document.getElementById("visa").innerHTML = `
      <div class="h2">Visa</div>
      <div class="spacer"></div>
      <div class="kv">
        <div><span class="caption muted">Visa</span><div>${country.student_visa_name || "Unavailable"}</div></div>
        <div><span class="caption muted">Fee</span><div>${country.student_visa_fee_local || 0} ${country.currency} (${formatINR(country.student_visa_fee_inr || 0)})</div></div>
        <div><span class="caption muted">Work during study</span><div>${country.work_hrs_week_during_study || 0} hrs/week</div></div>
        <div><a class="btn sm" href="${country.visa_application_url || "#"}" target="_blank" rel="noreferrer">Official portal</a></div>
      </div>
    `;

    document.getElementById("costs").innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div class="h2">Cost of living (monthly)</div>
        <span class="badge info">Updated ${country.living_cost_updated_at || "Unavailable"}</span>
      </div>
      <div class="spacer"></div>
      <div class="kv">
        <div><span class="caption muted">Rent (shared)</span><div>${country.avg_rent_shared_1bhk || 0} ${country.currency}</div></div>
        <div><span class="caption muted">Groceries</span><div>${country.avg_groceries_monthly || 0} ${country.currency}</div></div>
        <div><span class="caption muted">Transport</span><div>${country.avg_transport_monthly || 0} ${country.currency}</div></div>
      </div>
    `;

    document.getElementById("banks").innerHTML = `
      <div class="h2">Banking</div>
      <div class="spacer"></div>
      <div class="caption muted">Banks: ${banks.banks?.recommended_banks || "Unavailable"}</div>
      <div class="caption muted">Docs: ${banks.banks?.banking_setup_docs || "Unavailable"}</div>
      <div class="caption muted">Remittance: ${banks.banks?.remittance_services || "Unavailable"}</div>
    `;

    document.getElementById("jobs").innerHTML = `
      <div class="h2">Jobs</div>
      <div class="spacer"></div>
      <div class="caption muted">Market: ${jobs.jobs?.tech_job_market_rating || "Unavailable"}</div>
      <div class="caption muted">Cities: ${jobs.jobs?.top_cities_for_jobs || "Unavailable"}</div>
      <div class="caption muted">Companies: ${jobs.jobs?.top_companies_hiring || "Unavailable"}</div>
    `;
  }

  document.getElementById("refreshCosts")?.addEventListener("click", async () => {
    const code = qp("code");
    if (!code) return;
    try {
      await fetchAPI(`/api/countries/${encodeURIComponent(code)}/living-costs`);
      await render(code);
      showToast("Living costs refreshed", "success");
    } catch (e) {
      showToast(e.message || "Refresh failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const code = qp("code");
    if (!code) {
      document.getElementById("title").textContent = "Country not selected";
      document.getElementById("sub").textContent = "Open a country from the country guide list.";
      return;
    }
    render(code).catch((e) => showToast(e.message || "Load failed", "error"));
  });
})();
