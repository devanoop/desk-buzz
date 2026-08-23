// Structured (JSON-line) logging to stdout/stderr — the standard shape for
// a containerized deployment where the platform (Railway/Render/Fly)
// collects process output rather than a file, and downstream log tooling
// expects one parseable JSON object per line, not free-form text.

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

function write(level: LogLevel, message: string, fields: LogFields) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields: LogFields = {}) =>
    write("debug", message, fields),
  info: (message: string, fields: LogFields = {}) =>
    write("info", message, fields),
  warn: (message: string, fields: LogFields = {}) =>
    write("warn", message, fields),
  error: (message: string, fields: LogFields = {}) =>
    write("error", message, fields),
};
