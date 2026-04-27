(() => {
  const { fetchAPI, showToast, formatINR, skeleton } = window.AbroadReady;

  const out = document.getElementById("out");
  const lendersEl = document.getElementById("lenders");

  function kv(label, value) {
    return `<div class="card pad"><div class="caption muted">${label}</div><div class="h3">${value}</div></div>`;
  }

  async function calc() {
    const p = Number(document.getElementById("p").value || 0);
    const r = Number(document.getElementById("r").value || 0);
    const n = Number(document.getElementById("n").value || 120);
    const m = Number(document.getElementById("m").value || 18);
    out.innerHTML = skeleton(4).join("");
    const data = await fetchAPI(`/api/finance/calculator?principal=${p}&rate=${r}&tenureMonths=${n}&moratoriumMonths=${m}&courseYears=2`);
    const x = data.result;
    out.innerHTML = [
      kv("EMI", formatINR(x.emiAmount)),
      kv("Moratorium interest", formatINR(x.moratoriumInterestCost)),
      kv("Total interest", formatINR(x.totalInterestPaid)),
      kv("Total outflow", formatINR(x.totalOutflow)),
    ].join("");
  }

  async function loadLenders() {
    lendersEl.innerHTML = skeleton(4).join("");
    const data = await fetchAPI("/api/finance/lenders");
    lendersEl.innerHTML = (data.lenders || [])
      .slice(0, 10)
      .map(
        (l) => `
        <div class="card pad">
          <div class="row" style="justify-content:space-between">
            <div class="h3">${l.short_name || l.name}</div>
            <span class="badge info">${l.rate_min}-${l.rate_max}%</span>
          </div>
          <div class="caption muted">${l.type} • Secured up to ${l.max_loan_lakhs_secured}L</div>
          <div class="spacer"></div>
          <a class="btn sm" href="${l.apply_url || "#"}" target="_blank" rel="noreferrer">Apply</a>
        </div>`,
      )
      .join("");
  }

  document.getElementById("calc").addEventListener("click", () => calc().catch((e) => showToast(e.message, "error")));
  document.getElementById("loadLenders").addEventListener("click", () => loadLenders().catch((e) => showToast(e.message, "error")));

  document.addEventListener("DOMContentLoaded", () => {
    calc().catch((e) => showToast(e.message, "error"));
    loadLenders().catch((e) => showToast(e.message, "error"));
  });
})();

