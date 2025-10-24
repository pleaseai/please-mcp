import type { Express } from 'express'
import type { Server } from 'node:http'
import type { Logger } from './types.js'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import express from 'express'
import open from 'open'

/**
 * OAuth server metadata (RFC 8414)
 */
export interface OAuthMetadata {
  issuer?: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  grant_types_supported?: string[]
  token_endpoint_auth_methods_supported?: string[]
  code_challenge_methods_supported?: string[]
}

/**
 * OAuth client information
 */
export interface OAuthClientInfo {
  client_id: string
  client_secret?: string
}

/**
 * OAuth token response
 */
export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

/**
 * Stored OAuth session
 */
export interface OAuthSession {
  clientInfo: OAuthClientInfo
  tokens: OAuthTokenResponse
  expiresAt?: number
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  serverUrl: string
  callbackPort?: number
  callbackHost?: string
  staticClientInfo?: OAuthClientInfo
  configDir?: string
}

/**
 * PKCE helper to generate code verifier and challenge
 */
function generatePKCE(): { verifier: string, challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return { verifier, challenge }
}

/**
 * OAuth Manager for handling MCP OAuth flows
 */
export class OAuthManager {
  private logger: Logger
  private config: Required<OAuthConfig>
  private metadata?: OAuthMetadata
  private session?: OAuthSession
  private configDir: string
  private sessionFile: string

  constructor(config: OAuthConfig, logger: Logger) {
    this.logger = logger

    // Set defaults for missing config values
    this.config = {
      serverUrl: config.serverUrl,
      callbackPort: config.callbackPort ?? 3334,
      callbackHost: config.callbackHost ?? 'localhost',
      configDir: config.configDir ?? process.env.MCP_REMOTE_CONFIG_DIR ?? join(homedir(), '.mcp-auth'),
      staticClientInfo: config.staticClientInfo,
    } as Required<OAuthConfig>

    // Create config directory path based on server URL hash
    const serverHash = createHash('md5').update(config.serverUrl).digest('hex').substring(0, 8)
    this.configDir = join(this.config.configDir, serverHash)
    this.sessionFile = join(this.configDir, 'session.json')
  }

  /**
   * Get the authorization base URL from the server URL
   */
  private getAuthBaseUrl(): string {
    const url = new URL(this.config.serverUrl)
    return `${url.protocol}//${url.host}`
  }

  /**
   * Discover OAuth metadata from the server
   */
  async discoverMetadata(): Promise<OAuthMetadata> {
    const baseUrl = this.getAuthBaseUrl()
    const metadataUrl = `${baseUrl}/.well-known/oauth-authorization-server`

    this.logger.debug(`Discovering OAuth metadata from: ${metadataUrl}`)

    try {
      const response = await fetch(metadataUrl, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.ok) {
        const metadata = await response.json() as OAuthMetadata
        this.logger.info('OAuth metadata discovered successfully')
        this.metadata = metadata
        return metadata
      }
    }
    catch (error) {
      this.logger.debug('Metadata discovery failed, using defaults:', error)
    }

    // Fall back to default endpoints
    this.logger.info('Using default OAuth endpoints')
    this.metadata = {
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
    }

    return this.metadata
  }

  /**
   * Register a dynamic OAuth client
   */
  private async registerClient(metadata: OAuthMetadata): Promise<OAuthClientInfo> {
    if (!metadata.registration_endpoint) {
      throw new Error('Dynamic client registration not supported by server')
    }

    this.logger.info('Registering dynamic OAuth client')

    const redirectUri = `http://${this.config.callbackHost}:${this.config.callbackPort}/callback`

    const response = await fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_name: 'MCP Wrapper',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none', // Public client
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Client registration failed: ${error}`)
    }

    const clientInfo = await response.json() as OAuthClientInfo
    this.logger.info('OAuth client registered successfully')
    return clientInfo
  }

  /**
   * Start local callback server and perform authorization flow
   */
  private async performAuthorizationFlow(
    metadata: OAuthMetadata,
    clientInfo: OAuthClientInfo,
  ): Promise<OAuthTokenResponse> {
    const { verifier, challenge } = generatePKCE()
    const redirectUri = `http://${this.config.callbackHost}:${this.config.callbackPort}/callback`

    // Build authorization URL
    const authUrl = new URL(metadata.authorization_endpoint)
    authUrl.searchParams.set('client_id', clientInfo.client_id)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    this.logger.info('Starting authorization flow')
    this.logger.debug(`Authorization URL: ${authUrl.toString()}`)

    // Start local callback server
    const app: Express = express()
    let server: Server | undefined

    const authCodePromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authorization timeout'))
      }, 300000) // 5 minutes

      app.get('/callback', (req, res) => {
        clearTimeout(timeout)
        const code = req.query.code as string
        const error = req.query.error as string

        if (error) {
          res.send(`<html><body><h1>Authorization failed: ${error}</h1></body></html>`)
          reject(new Error(`Authorization failed: ${error}`))
        }
        else if (code) {
          res.send('<html><body><h1>Authorization successful!</h1><p>You can close this window.</p></body></html>')
          resolve(code)
        }
        else {
          res.send('<html><body><h1>Invalid callback</h1></body></html>')
          reject(new Error('Invalid callback: missing code'))
        }

        // Close server after handling callback
        setTimeout(() => server?.close(), 1000)
      })

      server = app.listen(this.config.callbackPort, () => {
        this.logger.info(`Callback server listening on port ${this.config.callbackPort}`)
        // Open browser for user authorization
        open(authUrl.toString()).catch((err) => {
          this.logger.warn('Failed to open browser automatically:', err)
          this.logger.info(`Please open this URL in your browser: ${authUrl.toString()}`)
        })
      })
    })

    // Wait for authorization code
    const code = await authCodePromise
    this.logger.info('Authorization code received')

    // Exchange code for tokens
    const tokenResponse = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientInfo.client_id,
        code_verifier: verifier,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const tokens = await tokenResponse.json() as OAuthTokenResponse
    this.logger.info('Access token obtained successfully')

    return tokens
  }

  /**
   * Load saved session from disk
   */
  private async loadSession(): Promise<OAuthSession | undefined> {
    try {
      if (!existsSync(this.sessionFile)) {
        return undefined
      }

      const content = await readFile(this.sessionFile, 'utf-8')
      const session = JSON.parse(content) as OAuthSession

      // Check if token is expired
      if (session.expiresAt && Date.now() >= session.expiresAt) {
        this.logger.debug('Saved session expired')
        return undefined
      }

      this.logger.debug('Loaded saved session')
      return session
    }
    catch (error) {
      this.logger.debug('Failed to load saved session:', error)
      return undefined
    }
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: OAuthSession): Promise<void> {
    try {
      await mkdir(this.configDir, { recursive: true })
      await writeFile(this.sessionFile, JSON.stringify(session, null, 2), 'utf-8')
      this.logger.debug('Session saved to disk')
    }
    catch (error) {
      this.logger.warn('Failed to save session:', error)
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<OAuthTokenResponse> {
    if (!this.metadata || !this.session) {
      throw new Error('Cannot refresh token: no active session')
    }

    if (!this.session.tokens.refresh_token) {
      throw new Error('No refresh token available')
    }

    this.logger.info('Refreshing access token')

    const response = await fetch(this.metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.session.tokens.refresh_token,
        client_id: this.session.clientInfo.client_id,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token refresh failed: ${error}`)
    }

    const tokens = await response.json() as OAuthTokenResponse
    this.logger.info('Access token refreshed successfully')

    return tokens
  }

  /**
   * Perform complete OAuth authorization and return access token
   */
  async authorize(): Promise<string> {
    // Try to load saved session
    this.session = await this.loadSession()
    if (this.session) {
      this.logger.info('Using saved OAuth session')
      return this.session.tokens.access_token
    }

    // Discover metadata
    const metadata = await this.discoverMetadata()

    // Get or register client
    let clientInfo = this.config.staticClientInfo
    if (!clientInfo) {
      try {
        clientInfo = await this.registerClient(metadata)
      }
      catch (error) {
        this.logger.error('Failed to register client:', error)
        throw new Error('OAuth client registration failed and no static client info provided')
      }
    }

    // Perform authorization flow
    const tokens = await this.performAuthorizationFlow(metadata, clientInfo)

    // Calculate expiration time
    const expiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined

    // Save session
    this.session = {
      clientInfo,
      tokens,
      expiresAt,
    }
    await this.saveSession(this.session)

    return tokens.access_token
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.session) {
      return this.authorize()
    }

    // Check if token is expired or about to expire (within 5 minutes)
    if (this.session.expiresAt && Date.now() >= this.session.expiresAt - 300000) {
      try {
        const tokens = await this.refreshAccessToken()
        this.session.tokens = tokens
        this.session.expiresAt = tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined
        await this.saveSession(this.session)
      }
      catch (error) {
        this.logger.warn('Token refresh failed, re-authorizing:', error)
        return this.authorize()
      }
    }

    return this.session.tokens.access_token
  }

  /**
   * Clear saved session
   */
  async clearSession(): Promise<void> {
    this.session = undefined
    try {
      if (existsSync(this.sessionFile)) {
        const { unlink } = await import('node:fs/promises')
        await unlink(this.sessionFile)
        this.logger.info('Session cleared')
      }
    }
    catch (error) {
      this.logger.warn('Failed to clear session:', error)
    }
  }
}
