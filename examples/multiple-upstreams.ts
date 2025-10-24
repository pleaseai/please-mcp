#!/usr/bin/env node

/**
 * Example of aggregating multiple upstream MCP servers
 *
 * This shows how to create multiple wrapper instances for different upstream servers
 * and combine their tools under a single namespace.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

interface ClientConfig {
  name: string
  url: string
  client: Client
}

async function createClient(name: string, url: string): Promise<ClientConfig> {
  const client = new Client(
    { name: `${name}-client`, version: '1.0.0' },
    { capabilities: {} },
  )

  const transport = new SSEClientTransport(new URL(url))
  await client.connect(transport)

  return { name, url, client }
}

async function main() {
  // Connect to multiple upstream servers
  const clients: ClientConfig[] = await Promise.all([
    createClient('github', 'http://localhost:3000/sse'),
    createClient('slack', 'http://localhost:3001/sse'),
    createClient('asana', 'http://localhost:3002/sse'),
  ])

  console.error(`Connected to ${clients.length} upstream servers`)

  // Create aggregator server
  const server = new Server(
    { name: 'multi-mcp-wrapper', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  // List tools from all upstreams with namespace prefix
  server.setRequestHandler('tools/list', async () => {
    const allTools = []

    for (const { name, client } of clients) {
      const { tools } = await client.listTools()
      allTools.push(
        ...tools.map(tool => ({
          ...tool,
          name: `${name}_${tool.name}`, // Add namespace prefix
          description: `[${name}] ${tool.description}`,
        })),
      )
    }

    console.error(`Listing ${allTools.length} tools from ${clients.length} sources`)
    return { tools: allTools }
  })

  // Route tool calls to appropriate upstream
  server.setRequestHandler('tools/call', async (request) => {
    const [namespace, ...toolNameParts] = request.params.name.split('_')
    const toolName = toolNameParts.join('_')

    const clientConfig = clients.find(c => c.name === namespace)
    if (!clientConfig) {
      throw new Error(`Unknown namespace: ${namespace}`)
    }

    console.error(`Routing ${request.params.name} to ${namespace} server`)

    return await clientConfig.client.callTool({
      ...request.params,
      name: toolName,
    })
  })

  // Start server
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Multi-upstream MCP Wrapper started')
}

main().catch(console.error)
