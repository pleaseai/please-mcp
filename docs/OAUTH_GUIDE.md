# OAuth Authentication Guide

## Overview

MCP Wrapper now supports **OAuth 2.1** authentication for connecting to remote MCP servers that require OAuth authorization, such as Asana's MCP server.

## Authentication Modes

The wrapper supports three authentication modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| `none` | No authentication | Open/public MCP servers |
| `token` | Token-based (Bearer) | Servers using pre-issued tokens |
| `oauth` | OAuth 2.1 flow | Servers requiring OAuth (e.g., Asana) |

## OAuth Configuration

### Environment Variables

Configure OAuth authentication using these environment variables:

```bash
# Required
UPSTREAM_URL="https://mcp.asana.com/sse"
AUTH_MODE="oauth"

# Optional OAuth settings
OAUTH_CALLBACK_PORT="3334"              # Default: 3334
OAUTH_CALLBACK_HOST="localhost"         # Default: localhost
OAUTH_CLIENT_ID="your-client-id"        # For pre-registered clients
OAUTH_CLIENT_SECRET="your-secret"       # For confidential clients
OAUTH_CONFIG_DIR="~/.mcp-auth"          # Token storage directory

# Tool filtering (optional)
ALLOWED_TOOLS="get_tasks,create_task,update_task"

# Debugging
DEBUG="true"
```

### MCP Configuration File

For Claude Code or other MCP clients:

```json
{
  "mcpServers": {
    "asana-filtered": {
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

## How OAuth Works

### 1. Initial Connection

When you first connect to an OAuth-enabled server:

1. **Metadata Discovery**: The wrapper discovers OAuth endpoints from `/.well-known/oauth-authorization-server`
2. **Client Registration**: If no static client credentials are provided, the wrapper automatically registers as an OAuth client
3. **Authorization Flow**: A browser window opens for you to authorize the connection
4. **Token Storage**: Tokens are securely stored in `~/.mcp-auth/{server-hash}/session.json`

### 2. PKCE (Proof Key for Code Exchange)

The wrapper implements PKCE for enhanced security:

- Generates a random code verifier
- Creates SHA-256 challenge
- Includes challenge in authorization request
- Validates with verifier during token exchange

### 3. Token Management

**Automatic Refresh**: Tokens are automatically refreshed when they expire

**Session Persistence**: Tokens are saved to disk and reused across sessions

**Expiration Handling**: Tokens are refreshed 5 minutes before expiration

## Using with Asana MCP Server

### Quick Start

1. **Update Configuration**:
```bash
cd /home/coder/IdeaProjects/please-mcp
bun run build
```

2. **Configure MCP Client**:
Update `.mcp.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": ["/absolute/path/to/please-mcp/dist/index.js"],
      "env": {
        "UPSTREAM_URL": "https://mcp.asana.com/sse",
        "AUTH_MODE": "oauth"
      }
    }
  }
}
```

3. **Start Your MCP Client**:
- Claude Code will automatically start the wrapper
- A browser window will open for Asana authorization
- Authorize the connection in your browser
- Return to Claude Code - you're connected!

### Filtering Asana Tools

Limit which Asana tools are available:

```json
{
  "env": {
    "UPSTREAM_URL": "https://mcp.asana.com/sse",
    "AUTH_MODE": "oauth",
    "ALLOWED_TOOLS": "get_tasks,create_task,update_task,get_projects"
  }
}
```

## Advanced Configuration

### Pre-registered OAuth Clients

If you've manually registered an OAuth client with the upstream server:

```bash
OAUTH_CLIENT_ID="your-pre-registered-client-id"
OAUTH_CLIENT_SECRET="your-client-secret"  # For confidential clients
```

### Custom Callback Port

If port 3334 is in use:

```bash
OAUTH_CALLBACK_PORT="8080"
```

### Custom Token Storage

Store tokens in a custom location:

```bash
OAUTH_CONFIG_DIR="/path/to/token/storage"
```

## Security Features

### ✅ PKCE Required

All OAuth flows use PKCE (Proof Key for Code Exchange) for enhanced security, even for public clients.

### ✅ Secure Token Storage

Tokens are stored locally in `~/.mcp-auth/` with file system permissions, isolated per server.

### ✅ Automatic Token Refresh

Access tokens are automatically refreshed using refresh tokens, minimizing manual re-authorization.

### ✅ HTTPS Enforcement

OAuth endpoints must use HTTPS (except localhost for development).

### ✅ State Parameter

State parameter prevents CSRF attacks during authorization flow.

## Troubleshooting

### Browser Doesn't Open Automatically

If the authorization browser window doesn't open:

```
[2025-10-24T11:05:30.474Z] [INFO] Please open this URL in your browser: https://...
```

Copy and paste the URL manually into your browser.

### Token Expired or Invalid

Clear the saved session and re-authorize:

```bash
rm -rf ~/.mcp-auth/[server-hash]
# Restart your MCP client
```

### Port Already in Use

Change the callback port:

```bash
OAUTH_CALLBACK_PORT="3335"
```

### Debug Logging

Enable detailed OAuth flow logging:

```bash
DEBUG="true"
```

Logs show:
- Metadata discovery
- Client registration
- Authorization URL
- Token exchange
- Token refresh cycles

### Connection Timeout

The authorization flow times out after 5 minutes. If you don't complete authorization in time:

1. Restart your MCP client
2. Complete authorization more quickly
3. Check your firewall isn't blocking localhost connections

## Comparison with mcp-remote

This wrapper provides similar OAuth functionality to [mcp-remote](https://github.com/geelen/mcp-remote) but with added features:

| Feature | MCP Wrapper | mcp-remote |
|---------|-------------|------------|
| OAuth 2.1 Support | ✅ | ✅ |
| PKCE | ✅ | ✅ |
| Token Persistence | ✅ | ✅ |
| Auto Refresh | ✅ | ✅ |
| **Tool Filtering** | ✅ | Limited |
| **Custom Headers** | ✅ | ✅ |
| **Statistics Tracking** | ✅ | ❌ |
| **Multiple Auth Modes** | ✅ | ❌ |

## Examples

### Read-Only Asana Access

```json
{
  "env": {
    "UPSTREAM_URL": "https://mcp.asana.com/sse",
    "AUTH_MODE": "oauth",
    "ALLOWED_TOOLS": "get_tasks,get_projects,search,get_user"
  }
}
```

### Full Asana Access with Debug Logging

```json
{
  "env": {
    "UPSTREAM_URL": "https://mcp.asana.com/sse",
    "AUTH_MODE": "oauth",
    "DEBUG": "true"
  }
}
```

### Task Management Only

```json
{
  "env": {
    "UPSTREAM_URL": "https://mcp.asana.com/sse",
    "AUTH_MODE": "oauth",
    "ALLOWED_TOOLS": "get_tasks,create_task,update_task,delete_task"
  }
}
```

## Token Storage Structure

Tokens are stored in a hash-based directory structure:

```
~/.mcp-auth/
  └── abc12345/              # Hash of server URL
      └── session.json       # Token and client info
```

**session.json** contains:
```json
{
  "clientInfo": {
    "client_id": "...",
    "client_secret": "..."
  },
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "Bearer",
    "expires_in": 3600
  },
  "expiresAt": 1234567890000
}
```

## Next Steps

- 📖 See [README.md](../README.md) for general wrapper usage
- 🔧 See [USAGE.md](USAGE.md) for command-line usage
- 🐛 Report issues on [GitHub Issues](https://github.com/amondnet/please-mcp/issues)

## Resources

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Asana MCP Server Documentation](https://developers.asana.com/docs/using-asanas-mcp-server)
