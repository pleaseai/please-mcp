import type { WrapperConfig } from './types.js'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

/**
 * Configuration file format
 */
export interface ConfigFile {
  upstream: {
    url: string
    headers?: Record<string, string>
  }
  tools?: {
    allowed?: string[]
  }
  server?: {
    name?: string
    version?: string
  }
  debug?: boolean
}

/**
 * Load configuration from a JSON file
 */
export async function loadConfigFile(path: string): Promise<WrapperConfig> {
  if (!existsSync(path)) {
    throw new Error(`Configuration file not found: ${path}`)
  }

  const content = await readFile(path, 'utf-8')
  const config: ConfigFile = JSON.parse(content)

  return {
    upstreamUrl: config.upstream.url,
    allowedTools: config.tools?.allowed || [],
    debug: config.debug || false,
    serverName: config.server?.name || 'mcp-wrapper',
    serverVersion: config.server?.version || '1.0.0',
    headers: config.upstream.headers || {},
  }
}

/**
 * Create a sample configuration file content
 */
export function createSampleConfig(): ConfigFile {
  return {
    upstream: {
      url: 'http://localhost:3000/sse',
    },
    tools: {
      allowed: [
        'search_web',
        'fetch_url',
        'read_file',
      ],
    },
    server: {
      name: 'mcp-wrapper',
      version: '1.0.0',
    },
    debug: false,
  }
}
