(() => {
  const { fetchAPI, showToast } = window.AbroadReady;

  let step = 1;
  const max = 6;
  const wizard = document.getElementById("wizard");
  const badge = document.getElementById("stepBadge");
  const bar = document.getElementById("progressBar");
  const tabs = document.getElementById("stepTabs");

  function setUI() {
    badge.textContent = `Step ${step} / ${max}`;
    bar.style.width = `${Math.round((step / max) * 100)}%`;
    wizard.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", Number(p.dataset.step) === step));
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", Number(t.dataset.step) === step));
    document.getElementById("prevBtn").disabled = step === 1;
    document.getElementById("nextBtn").textContent = step === max ? "Finish" : "Next";
  }

  function readCurrentStepPayload() {
    const panel = wizard.querySelector(`.panel[data-step="${step}"]`);
    const inputs = panel ? panel.querySelectorAll("input[name], select[name], textarea[name]") : [];
    const payload = {};
    inputs.forEach((el) => {
      const name = el.getAttribute("name");
      if (!name) return;
      payload[name] = el.type === "number" ? (el.value ? Number(el.value) : null) : el.value;
    });
    return payload;
  }

  async function saveStep() {
    const payload = readCurrentStepPayload();
    if (!Object.keys(payload).length) return;
    await fetchAPI("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function loadProfile() {
    try {
      const data = await fetchAPI("/api/profile");
      const p = data.profile || {};
      document.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
        const name = el.getAttribute("name");
        if (!name) return;
        if (p[name] === null || p[name] === undefined) return;
        el.value = String(p[name]);
      });
    } catch {
      // ignore; user can still fill
    }
  }

  function renderTabs() {
    const labels = ["Academics", "Tests", "Work", "Targets", "Finances", "Resume"];
    tabs.innerHTML = labels
      .map((l, i) => `<button class="tab" type="button" data-step="${i + 1}">${i + 1}. ${l}</button>`)
      .join("");
    tabs.addEventListener("click", async (e) => {
      const btn = e.target.closest(".tab");
      if (!btn) return;
      try {
        await saveStep();
      } catch {}
      step = Number(btn.dataset.step);
      setUI();
    });
  }

  document.getElementById("prevBtn")?.addEventListener("click", async () => {
    try {
      await saveStep();
    } catch (e) {
      showToast(e.message || "Save failed", "error");
      return;
    }
    step = Math.max(1, step - 1);
    setUI();
  });

  document.getElementById("nextBtn")?.addEventListener("click", async () => {
    try {
      await saveStep();
    } catch (e) {
      showToast(e.message || "Save failed", "error");
      return;
    }
    if (step === max) {
      await fetchAPI("/auth/onboarding-complete", { method: "POST" }).catch(() => null);
      window.location.href = "/dashboard";
      return;
    }
    step = Math.min(max, step + 1);
    setUI();
  });

  document.getElementById("saveBtn")?.addEventListener("click", async () => {
    try {
      await saveStep();
      showToast("Saved", "success");
    } catch (e) {
      showToast(e.message || "Save failed", "error");
    }
  });

  document.getElementById("uploadBtn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("resumeFile");
    const status = document.getElementById("uploadStatus");
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast("Choose a PDF first", "info");
      return;
    }
    status.textContent = "Uploading…";
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/resumes/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Upload failed");
      status.textContent = "Uploaded. Analysis started — you can continue.";
      showToast("Resume uploaded", "success");
    } catch (e) {
      status.textContent = "";
      showToast(e.message || "Upload failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    renderTabs();
    await loadProfile();
    setUI();
  });
})();

