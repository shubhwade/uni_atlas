(() => {
  const { fetchAPI, skeleton, showToast, formatINR } = window.AbroadReady;
  const grid = document.getElementById("grid");

  function card(c) {
    const monthly = (Number(c.avg_rent_shared_1bhk || 0) + Number(c.avg_groceries_monthly || 0) + Number(c.avg_transport_monthly || 0)) || 0;
    const inr = c.exchange_rate_to_inr ? monthly * Number(c.exchange_rate_to_inr) : 0;
    return `
      <a class="card pad countryCard" href="/country-detail?code=${encodeURIComponent(c.code)}">
        <div class="row" style="justify-content:space-between">
          <div class="h3">${c.flag_emoji || ""} ${c.name}</div>
          <span class="badge info">${(c.currency || "").toUpperCase()}</span>
        </div>
        <div class="caption muted">Post-study work: ${c.post_study_work_months || 0} months</div>
        <div class="caption muted">Safety: ${c.safety_rating_out_of_10 || "—"}/10</div>
        <div class="caption muted">Est. monthly: ${inr ? formatINR(inr) : "—"}</div>
      </a>
    `;
  }

  async function load() {
    grid.innerHTML = skeleton(8).join("");
    const data = await fetchAPI("/api/countries");
    grid.innerHTML = (data.countries || []).map(card).join("");
  }

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message, "error")));
})();

