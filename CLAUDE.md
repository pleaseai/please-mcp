# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Standards

When working on this codebase, follow these standards:

- **Coding Standards**: See `.please/docs/STANDARDS.md` - Follow YAGNI principle, keep changes small, read files thoroughly before modifying
- **Testing Guidelines**: See `.please/docs/TESTING.md` - Follow FIRST principles, use proper test doubles (fakes, stubs, spies, mocks)
- **TDD Methodology**: See `.please/docs/TDD.md` - Follow Red-Green-Refactor cycle, Tidy First approach (separate structural from behavioral changes), commit only when tests pass
- **Commit Convention**: See `.please/docs/commit-convention.md` - Must follow conventional commits format (feat, fix, docs, chore, refactor, test, build, ci, perf, style, revert)
  - Type must be lowercase
  - Subject must be lowercase (not sentence-case, start-case, pascal-case, or upper-case)
  - No period at the end of subject
  - Header max length: 100 characters
  - Body and footer lines max length: 100 characters

## Project Overview

**MCP Wrapper** (package: `@pleaseai/mcp`) is a proxy MCP (Model Context Protocol) server that wraps upstream SSE-based MCP servers to filter and customize the tools they expose. It acts as a middleware layer between Claude and upstream MCP servers.

**Project Configuration**: See `package.json` for:
- Package name: `@pleaseai/mcp`
- Build system: Bun with fallback to TypeScript compiler
- Node.js requirement: >=18.0.0
- Main entry: `dist/index.js`
- Available scripts: build, build:tsc, start, dev, watch, lint, lint:fix

```
Claude ↔️ MCP Wrapper ↔️ Upstream SSE MCP Server
```

Key capabilities:
- **Tool filtering**: Expose only specific tools from upstream servers via `ALLOWED_TOOLS`
- **Authentication**: Supports no-auth (`none`), token-based (`token`), and OAuth 2.1 (`oauth`) modes
- **Statistics tracking**: Monitors tool call counts, success rates, and durations
- **Multi-server support**: Can theoretically integrate multiple upstream servers

## Development Commands

### Building
```bash
bun run build        # Compile TypeScript to dist/ (uses Bun)
bun run build:tsc    # Compile using TypeScript compiler
bun run watch        # Watch mode - recompile on changes
bun run dev          # Build and run
```

### Running
```bash
# With environment variables (most common)
UPSTREAM_URL="https://mcp.asana.com/sse" \
AUTH_MODE="oauth" \
ALLOWED_TOOLS="get_tasks,create_task" \
DEBUG="true" \
node dist/index.js

# Direct execution after build
npm start            # Runs dist/index.js
```

### Testing OAuth Setup
```bash
# Build first
bun run build

# Test with Asana MCP (requires OAuth)
UPSTREAM_URL="https://mcp.asana.com/sse" \
AUTH_MODE="oauth" \
DEBUG="true" \
node dist/index.js
```

## Architecture

### Core Components

1. **src/index.ts** - Entry point
   - Loads configuration from environment variables
   - Handles graceful shutdown (SIGINT, SIGTERM)
   - Instantiates and starts `MCPWrapper`

2. **src/wrapper.ts** - Main proxy logic (`MCPWrapper` class)
   - **Server**: Exposes MCP server to Claude via stdio
   - **Client**: Connects to upstream SSE MCP server
   - Request handlers:
     - `tools/list`: Filters tools based on `ALLOWED_TOOLS`
     - `tools/call`: Validates and proxies tool calls, tracks statistics
   - Authentication: Injects auth headers (Bearer tokens or OAuth)

3. **src/oauth.ts** - OAuth 2.1 implementation (`OAuthManager`)
   - Metadata discovery from `/.well-known/oauth-authorization-server`
   - Dynamic client registration (if no static credentials provided)
   - PKCE (Proof Key for Code Exchange) flow with SHA-256
   - Token storage in `~/.mcp-auth/{server-hash}/session.json`
   - Automatic token refresh (5 minutes before expiration)
   - Local HTTP server on configurable port (default: 3334) for OAuth callback

4. **src/types.ts** - TypeScript interfaces
   - `WrapperConfig`: Main configuration interface
   - `AuthMode`: "none" | "token" | "oauth"
   - `ToolStats`: Tool call statistics
   - `Logger`: Logging interface

5. **src/logger.ts** - Console logger implementation
   - All output goes to stderr (stdout reserved for MCP protocol)
   - Debug messages only shown when `DEBUG=true`

6. **src/config.ts** - Configuration file support (future enhancement)
   - Currently unused - config loaded from env vars in index.ts
   - Defines JSON schema for file-based configuration

### Authentication Flow

#### OAuth Mode (`AUTH_MODE=oauth`)
1. Wrapper starts → OAuthManager initialized
2. Discovers OAuth metadata from upstream server
3. Registers client (if no static credentials)
4. Opens browser for user authorization
5. User authorizes → callback received with code
6. Exchange code for tokens using PKCE verifier
7. Tokens saved to `~/.mcp-auth/{hash}/session.json`
8. Tokens auto-refresh before expiration
9. `Authorization: Bearer {token}` injected into SSE connection

#### Token Mode (`AUTH_MODE=token`)
Set via `AUTHORIZATION_TOKEN` or `HEADER_Authorization` environment variables.

#### No Auth Mode (`AUTH_MODE=none`)
Default - no authentication headers sent.

### MCP Protocol Implementation

Uses `@modelcontextprotocol/sdk`:
- **Client side**: `SSEClientTransport` connects to upstream SSE endpoint
- **Server side**: `StdioServerTransport` communicates with Claude
- Request schemas: `ListToolsRequestSchema`, `CallToolRequestSchema`

### Data Flow

```
1. Claude → Stdio → Wrapper Server → tools/list handler
2. Wrapper Client → SSE → Upstream Server → get tools
3. Filter tools by ALLOWED_TOOLS
4. Wrapper Server → Stdio → Claude (filtered tools)

5. Claude → Stdio → Wrapper Server → tools/call handler
6. Validate tool in ALLOWED_TOOLS
7. Wrapper Client → SSE (with auth headers) → Upstream Server
8. Update statistics (success/failure, duration)
9. Wrapper Server → Stdio → Claude (result)
```

## Configuration

### Environment Variables (src/index.ts loadConfig())

**Required:**
- `UPSTREAM_URL` - Upstream SSE MCP server URL

**Optional:**
- `ALLOWED_TOOLS` - Comma-separated tool names to expose
- `AUTH_MODE` - "none" (default), "token", or "oauth"
- `AUTHORIZATION_TOKEN` - For token auth (becomes `Authorization: Bearer {token}`)
- `HEADER_*` - Custom headers (e.g., `HEADER_X_Custom_Key=value`)
- `DEBUG` - "true" enables debug logging
- `SERVER_NAME` - Server name (default: "mcp-wrapper")
- `SERVER_VERSION` - Server version (default: "1.0.0")

**OAuth-specific:**
- `OAUTH_CALLBACK_PORT` - Callback server port (default: 3334)
- `OAUTH_CALLBACK_HOST` - Callback host (default: "localhost")
- `OAUTH_CLIENT_ID` - Pre-registered client ID (optional)
- `OAUTH_CLIENT_SECRET` - Pre-registered client secret (optional)
- `OAUTH_CONFIG_DIR` - Token storage directory (default: "~/.mcp-auth")

### Claude Desktop Configuration

Example `.mcp.json`:
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

## Common Patterns

### Adding a New Authentication Mode

1. Add type to `AuthMode` in `src/types.ts`
2. Update `loadConfig()` in `src/index.ts` to parse new mode
3. Implement auth logic in `wrapper.ts start()` method
4. Update headers before SSE connection

### Tool Filtering Logic

Tool filtering happens in `wrapper.ts setupHandlers()`:
- Empty `ALLOWED_TOOLS` → allow all tools
- Non-empty `ALLOWED_TOOLS` → filter to only listed tools
- Tool call validation in `CallToolRequestSchema` handler

### OAuth Token Refresh

Implemented in `oauth.ts OAuthManager`:
- Tokens checked before every authorization request
- Refresh triggered if expiration within 5 minutes
- Refresh uses stored `refresh_token`
- Updated tokens saved back to session file

## Troubleshooting

### Debugging OAuth Issues
Enable debug logging:
```bash
DEBUG=true node dist/index.js
```

Check logs for:
- Metadata discovery failures
- Client registration issues
- Authorization URL
- Token exchange errors
- Token refresh cycles

### Token Storage Location
Tokens stored at: `~/.mcp-auth/{server-hash}/session.json`

To force re-authorization:
```bash
rm -rf ~/.mcp-auth/
```

### Common Error: "UPSTREAM_URL environment variable is required"
The wrapper cannot start without `UPSTREAM_URL`. Always set it:
```bash
UPSTREAM_URL="https://example.com/sse" node dist/index.js
```

### Port Conflicts (OAuth callback)
If port 3334 is in use:
```bash
OAUTH_CALLBACK_PORT=8080 node dist/index.js
```

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ES2022 with Node resolution
- **Output**: `dist/` directory
- **Source Maps**: Enabled for debugging
- **Strict Mode**: Enabled
- **Declaration Files**: Generated for library usage

## Dependencies

**Runtime:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - OAuth callback server
- `open` - Opens browser for OAuth authorization

**Development:**
- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@types/express` - Express type definitions

## Security Considerations

1. **OAuth PKCE**: Always uses PKCE for OAuth flows (even public clients)
2. **Token Storage**: Tokens stored with file system permissions in user directory
3. **HTTPS Enforcement**: OAuth endpoints must use HTTPS (except localhost)
4. **State Parameter**: CSRF protection during OAuth authorization
5. **Tool Filtering**: Principle of least privilege - expose only needed tools
6. **Logging**: Sensitive data (tokens) should not appear in logs (check oauth.ts logger calls)
