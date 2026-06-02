
const LOG_ENABLED = true;

export class Logger {
  static info(tag: string, ...args: unknown[]): void {
    if (!LOG_ENABLED) return;
    console.log(tag, ...args);
  }

  static warn(tag: string, ...args: unknown[]): void {
    if (!LOG_ENABLED) return;
    console.warn(tag, ...args);
  }

  static error(tag: string, ...args: unknown[]): void {
    if (!LOG_ENABLED) return;
    console.error(tag, ...args);
  }
}

