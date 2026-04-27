const nodemailer = require("nodemailer");

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP env vars missing (SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function fromEmail() {
  return process.env.FROM_EMAIL || process.env.SMTP_USER;
}

async function sendMail(to, subject, html) {
  const transporter = getTransport();
  const info = await transporter.sendMail({
    from: fromEmail(),
    to,
    subject,
    html,
  });
  return info;
}

async function sendVerificationEmail(to, token) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const link = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail(
    to,
    "Verify your email — AbroadReady",
    `<p>Verify your email:</p><p><a href="${link}">${link}</a></p>`,
  );
}

async function sendMagicLink(to, link) {
  return sendMail(to, "Your magic link — AbroadReady", `<p>Sign in:</p><p><a href="${link}">${link}</a></p>`);
}

async function sendResumeReadyNotification(to, resumeId) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const link = `${baseUrl}/resume?resumeId=${encodeURIComponent(resumeId)}`;
  return sendMail(to, "Your resume analysis is ready — AbroadReady", `<p>Your analysis is ready:</p><p><a href="${link}">${link}</a></p>`);
}

async function sendDeadlineAlert(to, courseName, deadline) {
  return sendMail(
    to,
    "Deadline approaching — AbroadReady",
    `<p><strong>${courseName}</strong> deadline is approaching: ${deadline || ""}</p>`,
  );
}

module.exports = {
  sendVerificationEmail,
  sendMagicLink,
  sendResumeReadyNotification,
  sendDeadlineAlert,
};

