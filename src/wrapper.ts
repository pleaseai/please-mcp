import type { OAuthClientInfo } from './oauth.js'
import type { Logger, ToolStats, WrapperConfig } from './types.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { ConsoleLogger } from './logger.js'
import { OAuthManager } from './oauth.js'

// HTTP transport for MCP SDK (Streamable HTTP)
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * MCP Wrapper - Proxy MCP server for filtering and customizing upstream MCP server tools
 */
export class MCPWrapper {
  private server: Server
  private upstreamClient: Client
  private config: Required<WrapperConfig>
  private logger: Logger
  private stats: Map<string, ToolStats> = new Map()
  private oauthManager?: OAuthManager

  constructor(config: WrapperConfig) {
    this.config = {
      allowedTools: [],
      debug: false,
      serverName: 'mcp-wrapper',
      serverVersion: '1.0.0',
      authMode: 'none',
      transportType: 'sse',
      headers: {},
      oauth: {},
      ...config,
    }

    this.logger = new ConsoleLogger(this.config.debug)

    // Initialize OAuth manager if needed
    if (this.config.authMode === 'oauth') {
      const staticClientInfo: OAuthClientInfo | undefined
        = this.config.oauth?.clientId
          ? {
              client_id: this.config.oauth.clientId,
              client_secret: this.config.oauth.clientSecret,
            }
          : undefined

      this.oauthManager = new OAuthManager(
        {
          serverUrl: this.config.upstreamUrl,
          callbackPort: this.config.oauth?.callbackPort,
          callbackHost: this.config.oauth?.callbackHost,
          staticClientInfo,
          configDir: this.config.oauth?.configDir,
        },
        this.logger,
      )
    }

    // Initialize upstream client
    this.upstreamClient = new Client(
      {
        name: `${this.config.serverName}-client`,
        version: this.config.serverVersion,
      },
      {
        capabilities: {},
      },
    )

    // Initialize wrapper server
    this.server = new Server(
      {
        name: this.config.serverName,
        version: this.config.serverVersion,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.setupHandlers()
  }

  /**
   * Setup request handlers for the server
   */
  private setupHandlers(): void {
    // Handle tools/list requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling tools/list request')

      try {
        const upstream = await this.upstreamClient.listTools()
        let tools = upstream.tools

        this.logger.debug(`Received ${tools.length} tools from upstream`)
        if (tools.length > 0) {
          this.logger.debug(`Tool names: ${tools.map(t => t.name).join(', ')}`)
        }

        // Filter tools if allowedTools is configured
        if (this.config.allowedTools.length > 0) {
          tools = tools.filter(tool =>
            this.config.allowedTools.includes(tool.name),
          )
          this.logger.debug(
            `Filtered tools: ${tools.length}/${upstream.tools.length} allowed`,
          )
        }

        this.logger.info(`Listing ${tools.length} tools`)
        return { tools }
      }
      catch (error) {
        this.logger.error('Failed to list tools:', error)
        throw error
      }
    })

    // Handle tools/call requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      this.logger.info(`Tool called: ${name}`)
      this.logger.debug(`Arguments:`, JSON.stringify(args, null, 2))

      // Check if tool is allowed
      if (
        this.config.allowedTools.length > 0
        && !this.config.allowedTools.includes(name)
      ) {
        const error = `Tool '${name}' is not allowed`
        this.logger.error(error)
        throw new Error(error)
      }

      const startTime = Date.now()

      try {
        // Forward the call to upstream server
        const result = await this.upstreamClient.callTool(request.params)

        const duration = Date.now() - startTime
        this.logger.info(`Tool '${name}' succeeded in ${duration}ms`)

        // Update statistics
        this.updateStats(name, true, duration)

        return result
      }
      catch (error) {
        const duration = Date.now() - startTime
        this.logger.error(`Tool '${name}' failed after ${duration}ms:`, error)

        // Update statistics
        this.updateStats(name, false, duration)

        throw error
      }
    })
  }

  /**
   * Update tool call statistics
   */
  private updateStats(toolName: string, success: boolean, duration: number): void {
    if (!this.stats.has(toolName)) {
      this.stats.set(toolName, {
        name: toolName,
        callCount: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
      })
    }

    const stats = this.stats.get(toolName)!
    stats.callCount++
    if (success) {
      stats.successCount++
    }
    else {
      stats.errorCount++
    }
    stats.totalDuration += duration
  }

  /**
   * Get statistics for all tools
   */
  public getStats(): ToolStats[] {
    return Array.from(this.stats.values())
  }

  /**
   * Connect to upstream server and start the wrapper server
   */
  public async start(): Promise<void> {
    try {
      this.logger.info(`Connecting to upstream server: ${this.config.upstreamUrl}`)
      this.logger.info(`Transport type: ${this.config.transportType}`)

      // Prepare headers based on auth mode
      const headers: Record<string, string> = { ...this.config.headers }

      if (this.config.authMode === 'oauth' && this.oauthManager) {
        this.logger.info('Performing OAuth authorization')
        const accessToken = await this.oauthManager.authorize()
        headers.Authorization = `Bearer ${accessToken}`
        this.logger.info('OAuth authorization successful')
      }

      // Create transport based on type
      let transport: SSEClientTransport | StreamableHTTPClientTransport

      if (this.config.transportType === 'http') {
        // Streamable HTTP transport
        this.logger.debug('Using Streamable HTTP transport')
        const httpOptions: any = {}
        if (Object.keys(headers).length > 0) {
          this.logger.debug('Adding headers to HTTP connection')
          httpOptions.requestInit = {
            headers,
          }
        }

        transport = new StreamableHTTPClientTransport(
          new URL(this.config.upstreamUrl),
          httpOptions,
        )
      }
      else {
        // SSE transport (default)
        this.logger.debug('Using SSE transport')
        const sseOptions: any = {}
        if (Object.keys(headers).length > 0) {
          this.logger.debug('Adding headers to SSE connection')
          // Use both eventSourceInit (for SSE connection) and requestInit (for message requests)
          sseOptions.eventSourceInit = {
            headers,
          }
          sseOptions.requestInit = {
            headers,
          }
        }

        transport = new SSEClientTransport(
          new URL(this.config.upstreamUrl),
          sseOptions,
        )
      }

      await this.upstreamClient.connect(transport)
      this.logger.info('Connected to upstream server')

      // Start stdio transport for wrapper server
      this.logger.info('Starting MCP Wrapper server')
      const stdioTransport = new StdioServerTransport()
      await this.server.connect(stdioTransport)

      this.logger.info('MCP Wrapper started successfully')
    }
    catch (error) {
      this.logger.error('Failed to start MCP Wrapper:', error)
      throw error
    }
  }

  /**
   * Close connections and cleanup
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping MCP Wrapper')
    await this.upstreamClient.close()
    await this.server.close()
    this.logger.info('MCP Wrapper stopped')
  }
}
