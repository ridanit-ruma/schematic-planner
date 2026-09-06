const NODES = [
  { x: 8, y: 96, w: 116, h: 40, title: 'Database', slug: 'database', status: 'done' },
  { x: 8, y: 152, w: 116, h: 40, title: 'Auth', slug: 'auth', status: 'progress' },
  { x: 168, y: 60, w: 128, h: 40, title: 'Plan graph', slug: 'plan-graph', status: 'planned' },
  { x: 168, y: 124, w: 128, h: 40, title: 'Canvas', slug: 'canvas', status: 'planned' },
  { x: 168, y: 188, w: 128, h: 40, title: 'MCP surface', slug: 'mcp', status: 'idea' },
  { x: 340, y: 124, w: 116, h: 40, title: 'Export', slug: 'export', status: 'idea' },
] as const;

const COLOR: Record<string, string> = {
  done: 'var(--status-done)',
  progress: 'var(--status-progress)',
  planned: 'var(--status-planned)',
  idea: 'var(--status-idea)',
};

/**
 * The product's own plan, drawn the way the product draws it. It opens the page
 * with the actual artifact rather than a picture of an interface.
 */
export function HeroSchematic() {
  return (
    <svg
      viewBox="0 0 472 252"
      className="w-full"
      role="img"
      aria-label="A plan drawn as a graph: Database and Auth feed the plan graph, canvas and MCP surface, which all feed Export."
    >
      <defs>
        <pattern id="fine" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0 H0 V16" fill="none" stroke="var(--grid-fine)" strokeWidth="1" />
        </pattern>
        <marker
          id="tip"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 1 L9 5 L0 9 z" fill="var(--rule-strong)" />
        </marker>
      </defs>

      <rect width="472" height="252" fill="url(#fine)" />

      {/* Solid with a head: a dependency. Dashed: containment. */}
      <g fill="none" stroke="var(--rule-strong)" strokeWidth="1.1">
        <path d="M124 116 H146 V80 H168" markerEnd="url(#tip)" />
        <path d="M124 172 H146 V144 H168" markerEnd="url(#tip)" />
        <path d="M296 80 H318 V144 H340" markerEnd="url(#tip)" />
        <path d="M296 144 H340" markerEnd="url(#tip)" />
        <path d="M296 208 H318 V144 H340" markerEnd="url(#tip)" />
        <path d="M124 136 H146 V208 H168" strokeDasharray="6 4" />
      </g>

      {NODES.map((node) => (
        <g key={node.slug}>
          {/* The same card the canvas draws: a level-2 surface, a 6px corner,
              and status carried by the rail down its left edge. */}
          <rect
            x={node.x}
            y={node.y}
            width={node.w}
            height={node.h}
            rx="6"
            fill="var(--surface-2)"
            stroke="var(--rule)"
          />
          <path
            d={`M${node.x + 6} ${node.y} h-2 a4 4 0 0 0 -4 4 v${node.h - 8} a4 4 0 0 0 4 4 h2 z`}
            fill={COLOR[node.status]}
          />
          <text
            x={node.x + 12}
            y={node.y + 17}
            fill="var(--ink)"
            fontSize="11"
            fontWeight="500"
            fontFamily="var(--font-sans)"
          >
            {node.title}
          </text>
          <text
            x={node.x + 12}
            y={node.y + 30}
            fill="var(--ink-faint)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {node.slug}
          </text>
        </g>
      ))}
    </svg>
  );
}
