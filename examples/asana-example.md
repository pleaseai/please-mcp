# Asana MCP Server Usage Example

## Overview

Asana MCP Server (`https://mcp.asana.com/sse`) is a public MCP server that requires OAuth 2.1 authentication.

## Prerequisites

1. Asana account
2. MCP Wrapper with OAuth support

## Setup

### Quick Start with OAuth

**1. Build the wrapper:**
```bash
bun run build
```

**2. Configure MCP client:**

Create or update `.mcp.json`:
```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": ["/absolute/path/to/please-mcp/dist/index.js"],
      "env": {
        "UPSTREAM_URL": "https://mcp.asana.com/sse",
        "AUTH_MODE": "oauth",
        "DEBUG": "true"
      }
    }
  }
}
```

**3. Connect:**
- Start your MCP client (Claude Code, Cursor, etc.)
- Browser opens for Asana authorization
- Authorize the application
- Connection established!

### Tool Filtering

Limit available tools by setting `ALLOWED_TOOLS`:

```json
{
  "env": {
    "UPSTREAM_URL": "https://mcp.asana.com/sse",
    "AUTH_MODE": "oauth",
    "ALLOWED_TOOLS": "asana_get_task,asana_create_task,asana_update_task"
  }
}
```

## Available Tools

All Asana MCP tools use the `asana_` prefix. Here are the main ones:

### Task Management
- `asana_get_task` - Get task details by ID
- `asana_get_tasks` - List tasks
- `asana_create_task` - Create new task
- `asana_update_task` - Update task
- `asana_delete_task` - Delete task
- `asana_search_tasks` - Advanced task search

### Project Management
- `asana_get_project` - Get project details
- `asana_get_projects` - List projects
- `asana_create_project` - Create new project
- `asana_get_project_sections` - Get project sections
- `asana_get_projects_for_team` - List team projects
- `asana_get_projects_for_workspace` - List workspace projects

### Goals & Portfolios
- `asana_get_goal` - Get goal details
- `asana_get_goals` - List goals
- `asana_create_goal` - Create goal
- `asana_update_goal` - Update goal
- `asana_get_portfolio` - Get portfolio details
- `asana_get_portfolios` - List portfolios

### Other Tools
- `asana_typeahead_search` - Search across Asana
- `asana_get_user` - Get user information
- `asana_get_workspace_users` - List workspace users
- `asana_get_teams_for_workspace` - List workspace teams

**Total: 43 tools available**

## Usage Examples

### Example 1: Read-Only Access

Only allow query operations:

```json
{
  "env": {
    "ALLOWED_TOOLS": "asana_get_task,asana_get_tasks,asana_search_tasks,asana_get_project,asana_get_user"
  }
}
```

### Example 2: Task Management

Allow task creation and updates:

```json
{
  "env": {
    "ALLOWED_TOOLS": "asana_get_task,asana_get_tasks,asana_create_task,asana_update_task,asana_search_tasks"
  }
}
```

### Example 3: Full Project Management

Allow project and task operations:

```json
{
  "env": {
    "ALLOWED_TOOLS": "asana_get_project,asana_get_projects,asana_create_project,asana_get_project_sections,asana_get_task,asana_create_task,asana_update_task"
  }
}
```

### Example 4: Everything (No Filter)

Allow all 43 tools:

```json
{
  "env": {
    "ALLOWED_TOOLS": ""
  }
}
```

## OAuth Token Storage

Tokens are automatically saved in:
```
~/.mcp-auth/{server-hash}/session.json
```

The wrapper automatically:
- Refreshes tokens before expiration
- Reuses tokens across sessions
- Handles token refresh failures

## Troubleshooting

### Connection Failed

Check logs for OAuth errors:
```bash
# Logs are in stderr when DEBUG=true
tail -f ~/.mcp-auth/*/debug.log  # if debug logging enabled
```

### Re-authorize

Clear tokens to force re-authorization:
```bash
rm -rf ~/.mcp-auth/
# Restart MCP client
```

### Port Conflict

If port 3334 is in use:
```json
{
  "env": {
    "OAUTH_CALLBACK_PORT": "3335"
  }
}
```

## Security Best Practices

1. ✅ **Use OAuth** - More secure than Personal Access Tokens
2. ✅ **Filter Tools** - Only expose needed functionality
3. ✅ **Token Storage** - Tokens are stored locally, never in code
4. ✅ **Regular Review** - Check authorized applications in Asana settings

## More Information

- 📖 [OAuth Guide](../docs/OAUTH_GUIDE.md) - Complete OAuth setup guide
- 🔧 [Usage Guide](../docs/USAGE.md) - General wrapper usage
- 📝 [Main README](../README.md) - Project overview
- 🐛 [Report Issues](https://github.com/amondnet/please-mcp/issues)

## References

- [Asana MCP Server Docs](https://developers.asana.com/docs/using-asanas-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
