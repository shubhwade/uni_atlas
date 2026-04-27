/**
 * Error handling middleware and utilities for AbroadReady
 */

const { getLogger } = require('./logger');

const logger = getLogger('ErrorHandler');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, context = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.context = context;
  }
}

/**
 * Async route wrapper - catches errors and passes to error handler
 * Usage: router.post('/endpoint', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Express error handling middleware
 * Must be the last middleware defined
 */
function errorHandler(err, req, res, next) {
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.session?.userId,
  }, err);

  // Default error response
  let statusCode = 500;
  let message = 'Server error. Please try again later.';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = true;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    isOperational = true;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    isOperational = true;
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    isOperational = true;
  }

  // For API routes, return JSON
  if (req.path.startsWith('/api')) {
    return res.status(statusCode).json({
      ok: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }

  // For other routes, return HTML error page
  return res.status(statusCode).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Error</title>
      <style>
        body { font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; }
        h1 { color: #d32f2f; }
        pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>Error ${statusCode}</h1>
      <p>${message}</p>
      ${process.env.NODE_ENV === 'development' ? `<pre>${err.stack}</pre>` : ''}
      <p><a href="/">Go home</a></p>
    </body>
    </html>
  `);
}

/**
 * 404 Not Found middleware
 */
function notFoundHandler(req, res) {
  const statusCode = 404;
  const message = `Cannot ${req.method} ${req.path}`;

  logger.warn('Route not found', { method: req.method, path: req.path });

  if (req.path.startsWith('/api')) {
    return res.status(statusCode).json({
      ok: false,
      error: message,
    });
  }

  return res.status(statusCode).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Not Found</title>
      <style>
        body { font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; }
        h1 { color: #666; }
      </style>
    </head>
    <body>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p><a href="/">Go home</a></p>
    </body>
    </html>
  `);
}

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
