# MCP Wrapper Usage Guide

## Installation

```bash
bun install
bun run build
```

## Usage

### 1. Run with Environment Variables

```bash
UPSTREAM_URL="http://localhost:3000/sse" \
ALLOWED_TOOLS="search_web,fetch_url,read_file" \
DEBUG=true \
node dist/index.js
```

### 2. Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filtered-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/please-mcp/dist/index.js"],
      "env": {
        "UPSTREAM_URL": "http://localhost:3000/sse",
        "ALLOWED_TOOLS": "search_web,fetch_url,read_file",
        "DEBUG": "false"
      }
    }
  }
}
```

### 3. Programmatic Usage

```typescript
import { MCPWrapper } from './src/wrapper.js'

const wrapper = new MCPWrapper({
  upstreamUrl: 'http://localhost:3000/sse',
  allowedTools: ['search_web', 'fetch_url', 'read_file'],
  debug: true,
  serverName: 'my-wrapper',
  serverVersion: '1.0.0',
})

await wrapper.start()
```

## Environment Variables

### Basic Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `UPSTREAM_URL` | Upstream SSE MCP server URL | - | ✅ |
| `ALLOWED_TOOLS` | Allowed tool list (comma-separated) | Allow all | ❌ |
| `DEBUG` | Enable debug logging | `false` | ❌ |
| `SERVER_NAME` | Server name | `mcp-wrapper` | ❌ |
| `SERVER_VERSION` | Server version | `1.0.0` | ❌ |

### Authentication Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH_MODE` | Authentication mode: `none`, `token`, `oauth` | `none` | ❌ |
| `AUTHORIZATION_TOKEN` | Bearer token (for `token` mode) | - | ❌ |
| `HEADER_*` | Custom HTTP headers | - | ❌ |

### OAuth Configuration (when AUTH_MODE=oauth)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OAUTH_CALLBACK_PORT` | OAuth callback server port | `3334` | ❌ |
| `OAUTH_CALLBACK_HOST` | OAuth callback server host | `localhost` | ❌ |
| `OAUTH_CLIENT_ID` | Pre-registered OAuth client ID | - | ❌ |
| `OAUTH_CLIENT_SECRET` | Pre-registered OAuth client secret | - | ❌ |
| `OAUTH_CONFIG_DIR` | Token storage directory | `~/.mcp-auth` | ❌ |

### Authentication Headers

**Method 1: AUTHORIZATION_TOKEN (Recommended)**
```bash
AUTHORIZATION_TOKEN="your_token_here"
# Automatically adds "Authorization: Bearer your_token_here" header
```

**Method 2: HEADER_ Prefix**
```bash
HEADER_Authorization="Bearer your_token_here"
HEADER_X_Custom_Header="custom_value"
# Characters after HEADER_ are converted to hyphens (-)
# HEADER_X_Custom_Header → X-Custom-Header: custom_value
```

## Examples

### Basic Usage

```bash
cd examples
UPSTREAM_URL="http://localhost:3000/sse" \
node ../dist/index.js
```

### Tool Filtering

Allow only specific tools:

```bash
UPSTREAM_URL="http://localhost:3000/sse" \
ALLOWED_TOOLS="search_web,read_file" \
node dist/index.js
```

### Debug Mode

```bash
UPSTREAM_URL="http://localhost:3000/sse" \
DEBUG=true \
node dist/index.js
```

### OAuth Authentication (e.g., Asana MCP)

```bash
UPSTREAM_URL="https://mcp.asana.com/sse" \
AUTH_MODE="oauth" \
ALLOWED_TOOLS="asana_get_tasks,asana_create_task" \
DEBUG="true" \
node dist/index.js
```

See [OAUTH_GUIDE.md](OAUTH_GUIDE.md) for detailed OAuth setup.

### Token-Based Authentication

```bash
UPSTREAM_URL="https://example.com/sse" \
AUTH_MODE="token" \
AUTHORIZATION_TOKEN="your_token_here" \
node dist/index.js
```

## Troubleshooting

### Connection Errors

Check if upstream server is running:

```bash
curl http://localhost:3000/sse
```

### Tools Not Showing

Check `ALLOWED_TOOLS` environment variable:

```bash
echo $ALLOWED_TOOLS
```

### Permission Errors

Check execution permissions:

```bash
chmod +x dist/index.js
```

### Node.js Version

Node.js 18 or higher is required:

```bash
node --version
```

## Logs

All logs are output to `stderr`. Log levels:

- `INFO`: General information
- `ERROR`: Errors
- `WARN`: Warnings
- `DEBUG`: Debug information (only when DEBUG=true)

## Development

### Build

```bash
bun run build        # Build with bun (fast)
bun run build:tsc    # Build with tsc (generates .d.ts files)
```

### Watch Mode

```bash
bun run watch
```

### Development Run

```bash
bun run dev
```

### Lint

```bash
bun run lint         # Check code style
bun run lint:fix     # Fix code style issues
```
