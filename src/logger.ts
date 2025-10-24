import type { Logger } from './types.js'

/**
 * Simple console logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(private debugEnabled: boolean = false) {}

  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [${level}] ${message}`, ...args)
  }

  info(message: string, ...args: any[]): void {
    this.log('INFO', message, ...args)
  }

  error(message: string, ...args: any[]): void {
    this.log('ERROR', message, ...args)
  }

  debug(message: string, ...args: any[]): void {
    if (this.debugEnabled) {
      this.log('DEBUG', message, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    this.log('WARN', message, ...args)
  }
}
