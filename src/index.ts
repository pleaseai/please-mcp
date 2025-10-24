#!/usr/bin/env node

import type { AuthMode, TransportType, WrapperConfig } from './types.js'
import process from 'node:process'
import { MCPWrapper } from './wrapper.js'

/**
 * Load configuration from environment variables
 */
function loadConfig(): WrapperConfig {
  const upstreamUrl = process.env.UPSTREAM_URL
  if (!upstreamUrl) {
    console.error('Error: UPSTREAM_URL environment variable is required')
    process.exit(1)
  }

  const allowedTools = process.env.ALLOWED_TOOLS
    ? process.env.ALLOWED_TOOLS.split(',')
        .map(tool => tool.trim())
        .filter(Boolean)
    : []

  // Determine transport type
  const transportType: TransportType = (process.env.TRANSPORT_TYPE as TransportType) || 'sse'

  // Determine auth mode
  const authMode: AuthMode = (process.env.AUTH_MODE as AuthMode) || 'none'

  // Load headers from environment variables (for token-based auth)
  // Format: HEADER_Authorization="Bearer token", HEADER_X_Custom="value"
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('HEADER_') && value) {
      const headerName = key.substring(7).replace(/_/g, '-')
      headers[headerName] = value
    }
  }

  // Special case: AUTHORIZATION_TOKEN becomes Authorization: Bearer {token}
  if (process.env.AUTHORIZATION_TOKEN) {
    headers.Authorization = `Bearer ${process.env.AUTHORIZATION_TOKEN}`
  }

  // Load OAuth configuration
  const oauth = {
    callbackPort: process.env.OAUTH_CALLBACK_PORT
      ? Number.parseInt(process.env.OAUTH_CALLBACK_PORT, 10)
      : undefined,
    callbackHost: process.env.OAUTH_CALLBACK_HOST,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    configDir: process.env.OAUTH_CONFIG_DIR,
  }

  return {
    upstreamUrl,
    transportType,
    allowedTools,
    debug: process.env.DEBUG === 'true',
    serverName: process.env.SERVER_NAME || 'mcp-wrapper',
    serverVersion: process.env.SERVER_VERSION || '1.0.0',
    authMode,
    headers,
    oauth,
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = loadConfig()
    const wrapper = new MCPWrapper(config)

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.error(`\nReceived ${signal}, shutting down gracefully...`)
      try {
        await wrapper.stop()
        process.exit(0)
      }
      catch (error) {
        console.error('Error during shutdown:', error)
        process.exit(1)
      }
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

    // Start the wrapper
    await wrapper.start()
  }
  catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
