import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';

import { Public } from '../auth/public.decorator.js';
import { ApiKeyService, type McpIdentity } from './api-key.service.js';
import { McpFactory } from './mcp.factory.js';

/**
 * The Remote MCP endpoint: a URL and a Bearer key that any MCP client can be
 * pointed at. Nothing to install on the user's machine, nothing to keep in step
 * with the server, and a self-hosted instance simply hands out its own URL.
 *
 * Stateless: each request gets its own server and transport, so no session state
 * has to be shared between API instances.
 */
@Public()
@Controller('mcp')
export class McpController {
  constructor(
    private readonly keys: ApiKeyService,
    private readonly factory: McpFactory,
  ) {}

  @Post()
  async handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    const identity = await this.identify(request);
    if (identity === null) {
      response
        .status(401)
        .setHeader('WWW-Authenticate', 'Bearer realm="schematic-planner"')
        .json({ error: 'Invalid or missing API key' });
      return;
    }

    const server = this.factory.build(identity);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    response.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  /** Stateless mode has no stream to resume and no session to end. */
  @Get()
  notStreamable(@Res() response: Response): void {
    response.status(405).json({ error: 'This endpoint is stateless; use POST' });
  }

  @Delete()
  noSession(@Res() response: Response): void {
    response.status(405).json({ error: 'This endpoint is stateless; there is no session to end' });
  }

  private async identify(request: Request): Promise<McpIdentity | null> {
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith('Bearer ')) return null;
    return this.keys.resolve(header.slice(7).trim());
  }
}
