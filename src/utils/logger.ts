export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

export class StderrLogger {
  private level: LogLevel;

  constructor(level: LogLevel = (process.env.SEQ_MCP_LOG_LEVEL as LogLevel) || "info") {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? " " + args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") : "";
    return `[${timestamp}] [${level.toUpperCase()}] [seq-mcp] ${message}${formattedArgs}\n`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      process.stderr.write(this.formatMessage("debug", message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      process.stderr.write(this.formatMessage("info", message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      process.stderr.write(this.formatMessage("warn", message, ...args));
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      process.stderr.write(this.formatMessage("error", message, ...args));
    }
  }
}

export const logger = new StderrLogger();
