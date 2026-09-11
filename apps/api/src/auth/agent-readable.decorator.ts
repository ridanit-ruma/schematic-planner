import { SetMetadata } from '@nestjs/common';

export const AGENT_READABLE = 'agentReadable';

/**
 * This route also answers to an MCP key, acting as the person who issued it.
 *
 * Only for reading something a key can already reach another way. The export is
 * the case it exists for: `get_plan({ view: 'markdown' })` hands an agent the
 * whole of it already, so the zip carries nothing new — and without this the
 * link `export_plan` gives back is one the caller's own key cannot open.
 */
export const AgentReadable = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AGENT_READABLE, true);
