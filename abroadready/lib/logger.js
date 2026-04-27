/**
 * Logging utility for AbroadReady
 * Provides structured logging for debugging and monitoring
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor(name, level = 'INFO') {
    this.name = name;
    this.level = level;
    this.levelValue = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(levelName, message, data = {}) {
    const timestamp = new Date().toISOString();
    const context = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
    return `[${timestamp}] [${levelName}] [${this.name}] ${message} ${context}`.trim();
  }

  /**
   * Write log to file and console (in development)
   */
  write(levelName, message, data) {
    const formatted = this.formatMessage(levelName, message, data);

    // Console output (development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatted);
    }

    // File output (always)
    try {
      const logFile = path.join(logsDir, `${this.name}.log`);
      fs.appendFileSync(logFile, formatted + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  debug(message, data) {
    if (this.levelValue <= LOG_LEVELS.DEBUG) {
      this.write('DEBUG', message, data);
    }
  }

  info(message, data) {
    if (this.levelValue <= LOG_LEVELS.INFO) {
      this.write('INFO', message, data);
    }
  }

  warn(message, data) {
    if (this.levelValue <= LOG_LEVELS.WARN) {
      this.write('WARN', message, data);
    }
  }

  error(message, data, err) {
    if (this.levelValue <= LOG_LEVELS.ERROR) {
      const errorData = { ...data };
      if (err instanceof Error) {
        errorData.errorMessage = err.message;
        errorData.stack = err.stack;
      }
      this.write('ERROR', message, errorData);
    }
  }
}

/**
 * Factory function to create loggers
 */
function getLogger(name) {
  const level = process.env.LOG_LEVEL || 'INFO';
  return new Logger(name, level);
}

module.exports = {
  getLogger,
  Logger,
  LOG_LEVELS,
};
