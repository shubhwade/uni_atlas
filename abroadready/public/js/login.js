(() => {
  const { fetchAPI, showToast } = window.AbroadReady;

  const note = document.getElementById("authNote");
  const loginForm = document.getElementById("loginForm");
  const magicBtn = document.getElementById("magicLinkBtn");

  // Handle error params from OAuth redirects
  const params = new URLSearchParams(window.location.search);
  if (params.get("error") === "google_not_configured") {
    showToast("Google sign-in is not configured on this server. Use email/password instead.", "info");
  } else if (params.get("error") === "google_failed") {
    showToast("Google sign-in failed. Please try again or use email/password.", "error");
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const payload = Object.fromEntries(fd.entries());
    try {
      await fetchAPI("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.location.href = "/dashboard";
    } catch (err) {
      showToast(err.message || "Login failed", "error");
    }
  });

  magicBtn?.addEventListener("click", async () => {
    const email = loginForm?.querySelector("input[name=email]")?.value?.trim();
    if (!email) {
      showToast("Enter your email first", "info");
      return;
    }
    try {
      await fetchAPI("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      note.textContent = "Magic link sent. Check your inbox.";
      showToast("Magic link sent", "success");
    } catch (err) {
      showToast(err.message || "Failed to send magic link", "error");
    }
  });
})();

