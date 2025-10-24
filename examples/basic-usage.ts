#!/usr/bin/env node

/**
 * Basic usage example of MCP Wrapper
 *
 * This example shows how to programmatically create and start an MCP wrapper
 * with a local SSE MCP server.
 */

import process from 'node:process'
import { MCPWrapper } from '../src/wrapper.js'

async function main() {
  // Create wrapper with configuration
  const wrapper = new MCPWrapper({
    upstreamUrl: process.env.UPSTREAM_URL || 'http://localhost:3000/sse',
    allowedTools: ['search_web', 'fetch_url', 'read_file'],
    authMode: 'none',
    debug: true,
    serverName: 'my-custom-wrapper',
    serverVersion: '1.0.0',
  })

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.error(`\nReceived ${signal}, shutting down...`)
    await wrapper.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Start the wrapper
  console.error('Starting MCP Wrapper...')
  await wrapper.start()

  console.error('MCP Wrapper is running. Press Ctrl+C to stop.')
}

main().catch(console.error)
