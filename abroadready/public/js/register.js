(() => {
  const { fetchAPI, showToast } = window.AbroadReady;

  const form = document.getElementById("registerForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    if (payload.password !== payload.confirm) {
      showToast("Passwords do not match", "error");
      return;
    }
    try {
      await fetchAPI("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, email: payload.email, password: payload.password }),
      });
      window.location.href = "/onboarding";
    } catch (err) {
      showToast(err.message || "Registration failed", "error");
    }
  });
})();

