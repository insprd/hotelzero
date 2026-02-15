import pino from "pino";

// Log level can be configured via HOTELZERO_LOG_LEVEL environment variable
// Levels: trace, debug, info, warn, error, fatal, silent
const LOG_LEVEL = process.env.HOTELZERO_LOG_LEVEL || "info";

// Create a base logger instance
// In MCP context, we output to stderr to avoid interfering with stdio transport
export const logger = pino({
  level: LOG_LEVEL,
  transport: {
    target: "pino/file",
    options: { destination: 2 }, // 2 = stderr
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "hotelzero",
  },
});

// Create child loggers for different modules
export const browserLogger = logger.child({ module: "browser" });
export const serverLogger = logger.child({ module: "server" });

// Export type for external use
export type Logger = pino.Logger;
