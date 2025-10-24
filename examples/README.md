# Examples

This directory contains example code for using the MCP Wrapper.

## Available Examples

### 1. basic-usage.ts
Basic programmatic usage of MCP Wrapper with a local SSE server.

**Usage:**
```bash
# Make sure you have a local MCP server running on http://localhost:3000/sse
bun run examples/basic-usage.ts
```

### 2. basic-oauth.ts
OAuth authentication example using Asana MCP server.

**Usage:**
```bash
bun run examples/basic-oauth.ts
```

This will:
- Open your browser for Asana authorization
- Save OAuth tokens to `~/.mcp-auth/`
- Connect to Asana MCP with filtered tools

### 3. multiple-upstreams.ts
Advanced example showing how to aggregate multiple upstream MCP servers.

**Usage:**
```bash
# Make sure you have multiple MCP servers running
bun run examples/multiple-upstreams.ts
```

### 4. asana-example.md
Complete documentation for using MCP Wrapper with Asana, including:
- All 43 available Asana tools
- OAuth setup instructions
- Tool filtering examples
- Troubleshooting guide

## Running Examples

### Prerequisites

1. **Build the project:**
```bash
bun run build
```

2. **For OAuth examples:**
- No additional setup needed
- Browser will open for authorization

3. **For local server examples:**
- Start a local MCP server on the configured port
- Or change the `upstreamUrl` in the example

### Using with ts-node or bun

```bash
# Using bun (recommended)
bun run examples/basic-oauth.ts

# Using ts-node
npx ts-node examples/basic-usage.ts
```

## Environment Variables

You can also override configuration using environment variables:

```bash
# Override upstream URL
UPSTREAM_URL="https://different-server.com/sse" bun run examples/basic-usage.ts

# Change OAuth callback port
OAUTH_CALLBACK_PORT=8080 bun run examples/basic-oauth.ts

# Enable debug logging
DEBUG=true bun run examples/basic-usage.ts
```

## More Information

- See [../docs/OAUTH_GUIDE.md](../docs/OAUTH_GUIDE.md) for OAuth setup
- See [../docs/USAGE.md](../docs/USAGE.md) for general usage
- See [asana-example.md](asana-example.md) for Asana-specific examples
