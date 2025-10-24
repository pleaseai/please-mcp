/**
 * Authentication mode for upstream connection
 */
export type AuthMode = 'none' | 'token' | 'oauth'

/**
 * Transport type for upstream connection
 */
export type TransportType = 'sse' | 'http'

/**
 * OAuth configuration
 */
export interface OAuthOptions {
  /** Callback server port (default: 3334) */
  callbackPort?: number

  /** Callback server host (default: localhost) */
  callbackHost?: string

  /** Static OAuth client info (if pre-registered) */
  clientId?: string
  clientSecret?: string

  /** Directory for storing OAuth tokens (default: ~/.mcp-auth) */
  configDir?: string
}

/**
 * Configuration options for MCP Wrapper
 */
export interface WrapperConfig {
  /** Upstream MCP server URL */
  upstreamUrl: string

  /** Transport type: 'sse' (default) or 'http' */
  transportType?: TransportType

  /** List of allowed tool names (empty = allow all) */
  allowedTools?: string[]

  /** Enable debug logging */
  debug?: boolean

  /** Server name */
  serverName?: string

  /** Server version */
  serverVersion?: string

  /** Authentication mode */
  authMode?: AuthMode

  /** HTTP headers for upstream connection (used when authMode is 'none' or 'token') */
  headers?: Record<string, string>

  /** OAuth configuration (used when authMode is 'oauth') */
  oauth?: OAuthOptions
}

/**
 * Tool call statistics
 */
export interface ToolStats {
  name: string
  callCount: number
  successCount: number
  errorCount: number
  totalDuration: number
}

/**
 * Logger interface
 */
export interface Logger {
  info: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
  debug: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
}
