# MCP Wrapper

**MCP Wrapper** is a proxy MCP server that wraps existing SSE MCP servers to selectively expose only the tools you need.

## Overview

When using multiple MCP servers, you may not need all available tools or want to use only specific ones. MCP Wrapper allows you to filter and customize tools from upstream MCP servers in these situations.

```
Claude ↔️ MCP Wrapper ↔️ Upstream SSE MCP Server
```

## Key Features

- ✅ **Selective Tool Exposure**: Provide only the tools you want to Claude
- 🔒 **Access Control**: Enhanced security for sensitive tools
- 🔐 **OAuth 2.1 Support**: Connect to MCP servers requiring OAuth authentication (e.g., Asana MCP)
- 📝 **Logging & Monitoring**: Track tool usage patterns
- 🛠️ **Customization**: Modify tool metadata and behavior
- 🔄 **Multiple Authentication Modes**: Choose from no auth, token-based, or OAuth

## Installation

```bash
git clone https://github.com/amondnet/please-mcp.git
cd please-mcp
bun install
bun run build
```

## Quick Start: Asana MCP Server (OAuth)

To connect to servers requiring OAuth authentication like Asana MCP server:

1. **Build the project**:
```bash
bun run build
```

2. **Configure MCP settings** (`.mcp.json` or `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": ["/absolute/path/to/please-mcp/dist/index.js"],
      "env": {
        "UPSTREAM_URL": "https://mcp.asana.com/sse",
        "AUTH_MODE": "oauth",
        "ALLOWED_TOOLS": "get_tasks,create_task,update_task",
        "DEBUG": "true"
      }
    }
  }
}
```

3. **Start MCP client** - Browser window will open for Asana authentication

📖 For detailed OAuth setup: [OAUTH_GUIDE.md](docs/OAUTH_GUIDE.md)

## Usage

### 1. Basic Setup

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

// Connect to upstream MCP server
const upstreamClient = new Client({
  name: 'wrapper-client',
  version: '1.0.0'
}, {
  capabilities: {}
})

const sseTransport = new SSEClientTransport(
  new URL('http://localhost:3000/sse')
)
await upstreamClient.connect(sseTransport)

// Create wrapper server
const server = new Server({
  name: 'mcp-wrapper',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
})
```

### 2. Tool Filtering

```typescript
// List of allowed tools
const ALLOWED_TOOLS = [
  'search_web',
  'fetch_url',
  'read_file'
]

server.setRequestHandler('tools/list', async () => {
  const upstream = await upstreamClient.listTools()

  return {
    tools: upstream.tools.filter(tool =>
      ALLOWED_TOOLS.includes(tool.name)
    )
  }
})
```

### 3. Tool Call Proxy

```typescript
server.setRequestHandler('tools/call', async (request) => {
  const toolName = request.params.name

  // Check if tool is allowed
  if (!ALLOWED_TOOLS.includes(toolName)) {
    throw new Error(`Tool '${toolName}' is not allowed`)
  }

  // Forward request to upstream server
  return await upstreamClient.callTool(request.params)
})
```

### 4. Start Server

```typescript
const transport = new StdioServerTransport()
await server.connect(transport)
```

## Claude Desktop Configuration

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filtered-mcp": {
      "command": "node",
      "args": ["/path/to/mcp-wrapper.js"],
      "env": {
        "UPSTREAM_URL": "http://localhost:3000/sse"
      }
    }
  }
}
```

## Advanced Features

### Modify Tool Metadata

```typescript
server.setRequestHandler('tools/list', async () => {
  const upstream = await upstreamClient.listTools()

  return {
    tools: upstream.tools
      .filter(tool => ALLOWED_TOOLS.includes(tool.name))
      .map(tool => ({
        ...tool,
        description: `[Filtered] ${tool.description}`,
        // Modify parameter schema
        inputSchema: {
          ...tool.inputSchema,
          required: [...(tool.inputSchema.required || []), 'source']
        }
      }))
  }
})
```

### Logging and Monitoring

```typescript
server.setRequestHandler('tools/call', async (request) => {
  const startTime = Date.now()

  console.log(`[${new Date().toISOString()}] Tool called: ${request.params.name}`)
  console.log(`Arguments:`, JSON.stringify(request.params.arguments, null, 2))

  try {
    const result = await upstreamClient.callTool(request.params)
    const duration = Date.now() - startTime

    console.log(`[Success] Completed in ${duration}ms`)
    return result
  }
  catch (error) {
    console.error(`[Error] ${error.message}`)
    throw error
  }
})
```

### Access Control and Validation

```typescript
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  // Additional validation for sensitive tools
  if (name === 'delete_file') {
    if (!args.path.startsWith('/safe/directory/')) {
      throw new Error('Access denied: Path outside allowed directory')
    }
  }

  // Rate limiting
  if (shouldRateLimit(name)) {
    throw new Error('Rate limit exceeded')
  }

  return await upstreamClient.callTool(request.params)
})
```

### Multiple Upstream Server Integration

```typescript
const clients = {
  asana: await createClient('http://localhost:3000/sse'),
  github: await createClient('http://localhost:3001/sse'),
  slack: await createClient('http://localhost:3002/sse')
}

server.setRequestHandler('tools/list', async () => {
  const allTools = []

  for (const [source, client] of Object.entries(clients)) {
    const { tools } = await client.listTools()
    allTools.push(...tools.map(tool => ({
      ...tool,
      name: `${source}_${tool.name}` // Add namespace
    })))
  }

  return { tools: allTools }
})

server.setRequestHandler('tools/call', async (request) => {
  const [source, ...toolNameParts] = request.params.name.split('_')
  const toolName = toolNameParts.join('_')

  const client = clients[source]
  if (!client) {
    throw new Error(`Unknown source: ${source}`)
  }

  return await client.callTool({
    ...request.params,
    name: toolName
  })
})
```

## Complete Example

```typescript
#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const UPSTREAM_URL = process.env.UPSTREAM_URL || 'http://localhost:3000/sse'
const ALLOWED_TOOLS = (process.env.ALLOWED_TOOLS || '').split(',').filter(Boolean)

async function main() {
  // Setup upstream client
  const upstreamClient = new Client({
    name: 'mcp-wrapper-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  })

  const sseTransport = new SSEClientTransport(new URL(UPSTREAM_URL))
  await upstreamClient.connect(sseTransport)

  // Setup wrapper server
  const server = new Server({
    name: 'mcp-wrapper',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  })

  // List tools
  server.setRequestHandler('tools/list', async () => {
    const upstream = await upstreamClient.listTools()

    let tools = upstream.tools

    // Filter if configured
    if (ALLOWED_TOOLS.length > 0) {
      tools = tools.filter(tool => ALLOWED_TOOLS.includes(tool.name))
    }

    return { tools }
  })

  // Call tools
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params

    // Check allowlist
    if (ALLOWED_TOOLS.length > 0 && !ALLOWED_TOOLS.includes(name)) {
      throw new Error(`Tool '${name}' is not allowed`)
    }

    // Logging
    console.error(`[MCP Wrapper] Calling tool: ${name}`)

    try {
      const result = await upstreamClient.callTool(request.params)
      console.error(`[MCP Wrapper] Tool '${name}' succeeded`)
      return result
    }
    catch (error) {
      console.error(`[MCP Wrapper] Tool '${name}' failed:`, error.message)
      throw error
    }
  })

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('MCP Wrapper started')
}

main().catch(console.error)
```

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `UPSTREAM_URL` | Upstream SSE MCP server URL | `http://localhost:3000/sse` | `http://api.example.com/mcp` |
| `ALLOWED_TOOLS` | Allowed tool list (comma-separated) | All allowed | `search_web,fetch_url,read_file` |

## Use Cases

### 1. Enhanced Security
Restrict access to tools performing sensitive operations and maintain audit logs.

### 2. Performance Optimization
Filter out infrequently used tools to efficiently use Claude's context window.

### 3. Team-specific Customization
Provide different tool sets for different teams or projects.

### 4. Unified Interface
Present multiple MCP servers through a single unified interface.

## Troubleshooting

### Cannot Connect to Upstream Server

```bash
# Check if server is running
curl http://localhost:3000/sse

# Check firewall settings
# Verify URL is correct
```

### Tools Not Showing

```bash
# Check ALLOWED_TOOLS environment variable
echo $ALLOWED_TOOLS

# Check logs
# Check MCP logs in Claude Desktop's developer tools
```

### Permission Errors

```bash
# Check script execution permissions
chmod +x mcp-wrapper.js

# Check Node.js version (18+ required)
node --version
```

## License

MIT

## Contributing

Issues and PRs are always welcome!

## Related Links

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Desktop](https://claude.ai/download)
