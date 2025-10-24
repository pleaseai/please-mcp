#!/usr/bin/env node

/**
 * Basic OAuth example with Asana MCP
 *
 * This example shows how to programmatically create and start an MCP wrapper
 * with OAuth authentication for Asana.
 */

import process from 'node:process'
import { MCPWrapper } from '../src/wrapper.js'

async function main() {
  // Create wrapper with OAuth configuration
  const wrapper = new MCPWrapper({
    upstreamUrl: 'https://mcp.asana.com/sse',
    authMode: 'oauth',
    allowedTools: [
      'asana_get_task',
      'asana_get_tasks',
      'asana_create_task',
      'asana_update_task',
      'asana_search_tasks',
    ],
    debug: true,
    serverName: 'asana-wrapper',
    serverVersion: '1.0.0',
    oauth: {
      callbackPort: 3334,
      callbackHost: 'localhost',
    },
  })

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down...')
    await wrapper.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.error('\nShutting down...')
    await wrapper.stop()
    process.exit(0)
  })

  // Start the wrapper
  console.error('Starting MCP Wrapper with OAuth...')
  await wrapper.start()

  console.error('MCP Wrapper is running. Press Ctrl+C to stop.')
}

main().catch(console.error)
