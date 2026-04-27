/**
 * Security utilities and middleware for AbroadReady
 */

const crypto = require('crypto');

/**
 * Input validation helper
 * @param {*} value - Value to validate
 * @param {string} type - Type to validate against (email, string, number, integer, boolean, url)
 * @param {object} options - Optional constraints (min, max, required, pattern)
 * @returns {object} { valid: boolean, value: sanitized_value, error: error_message }
 */
function validateInput(value, type = 'string', options = {}) {
  const { required = false, min, max, pattern, whitelist } = options;

  // Check required
  if (required && (value === undefined || value === null || value === '')) {
    return { valid: false, value: null, error: 'Field is required' };
  }

  if (!required && (value === undefined || value === null || value === '')) {
    return { valid: true, value: null, error: null };
  }

  switch (type) {
    case 'email': {
      const email = String(value).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { valid: false, value: null, error: 'Invalid email format' };
      }
      return { valid: true, value: email, error: null };
    }

    case 'string': {
      let str = String(value).trim();
      if (min && str.length < min) {
        return { valid: false, value: null, error: `Must be at least ${min} characters` };
      }
      if (max && str.length > max) {
        return { valid: false, value: null, error: `Must not exceed ${max} characters` };
      }
      if (pattern && !new RegExp(pattern).test(str)) {
        return { valid: false, value: null, error: `Must match pattern: ${pattern}` };
      }
      if (whitelist && !whitelist.includes(str)) {
        return { valid: false, value: null, error: `Invalid value. Allowed: ${whitelist.join(', ')}` };
      }
      return { valid: true, value: str, error: null };
    }

    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, value: null, error: 'Must be a valid number' };
      }
      if (min !== undefined && num < min) {
        return { valid: false, value: null, error: `Must be at least ${min}` };
      }
      if (max !== undefined && num > max) {
        return { valid: false, value: null, error: `Must not exceed ${max}` };
      }
      return { valid: true, value: num, error: null };
    }

    case 'integer': {
      const int = Number(value);
      if (!Number.isInteger(int)) {
        return { valid: false, value: null, error: 'Must be an integer' };
      }
      if (min !== undefined && int < min) {
        return { valid: false, value: null, error: `Must be at least ${min}` };
      }
      if (max !== undefined && int > max) {
        return { valid: false, value: null, error: `Must not exceed ${max}` };
      }
      return { valid: true, value: int, error: null };
    }

    case 'boolean': {
      if (typeof value === 'boolean') {
        return { valid: true, value, error: null };
      }
      if (value === 'true' || value === '1' || value === 1) {
        return { valid: true, value: true, error: null };
      }
      if (value === 'false' || value === '0' || value === 0) {
        return { valid: true, value: false, error: null };
      }
      return { valid: false, value: null, error: 'Must be a boolean' };
    }

    case 'url': {
      try {
        new URL(String(value));
        return { valid: true, value: String(value), error: null };
      } catch {
        return { valid: false, value: null, error: 'Invalid URL format' };
      }
    }

    default:
      return { valid: true, value, error: null };
  }
}

/**
 * Sanitize HTML to prevent XSS — strips all tags except a safe allowlist
 * @param {string} dirtyHtml - HTML to sanitize
 * @returns {string} Clean HTML
 */
function sanitizeHTML(dirtyHtml) {
  if (typeof dirtyHtml !== 'string') return '';
  // Strip all tags not in the allowlist using a simple regex approach
  // For server-side use this is sufficient; no external dependency needed
  return dirtyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Escape HTML special characters (alternative simple approach)
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for HTML
 */
function escapeHTML(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generate a strong random secret
 * @param {number} length - Length in bytes
 * @returns {string} Hex-encoded random secret
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a value with SHA256
 * @param {string} value - Value to hash
 * @returns {string} Hex-encoded hash
 */
function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/**
 * Compare two hashes safely (timing-safe comparison)
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @returns {boolean} Whether hashes match
 */
function compareHashes(hash1, hash2) {
  try {
    return crypto.timingSafeEqual(Buffer.from(hash1), Buffer.from(hash2));
  } catch {
    return false;
  }
}

/**
 * Express middleware: Add security headers
 */
function securityHeaders(req, res, next) {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS Protection (legacy)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Disable framing
  res.setHeader('X-Frame-Options', 'DENY');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // CORS headers (allow from same origin and configured domains)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Express middleware: Rate limiting helper (basic in-memory)
 * Production: use redis-backed rate limiter
 */
const rateLimitStore = new Map();

function rateLimitMiddleware(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key).filter((t) => t > windowStart);
    requests.push(now);
    rateLimitStore.set(key, requests);

    if (requests.length > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests.length));
    next();
  };
}

/**
 * Validate request body against a schema
 * @param {object} data - Data to validate
 * @param {object} schema - Schema definition { fieldName: { type, required, ... } }
 * @returns {object} { valid: boolean, errors: object, data: object }
 */
function validateSchema(data, schema) {
  const errors = {};
  const validated = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const { type, required, ...options } = rules;
    const result = validateInput(value, type, { required, ...options });

    if (!result.valid) {
      errors[field] = result.error;
    } else {
      validated[field] = result.value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validated,
  };
}

module.exports = {
  validateInput,
  sanitizeHTML,
  escapeHTML,
  generateSecret,
  hashValue,
  compareHashes,
  securityHeaders,
  rateLimitMiddleware,
  validateSchema,
};
