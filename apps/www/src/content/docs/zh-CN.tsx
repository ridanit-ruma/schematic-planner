import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: '文档',
  description: '通过 MCP 把 AI 智能体连接到 Schematic Planner，并了解导出包里有什么。',
};

const MCP_CONFIG = `{
  "mcpServers": {
    "schematic-planner": {
      "url": "https://your-instance.example/mcp",
      "headers": { "Authorization": "Bearer sp_..." }
    }
  }
}`;

const TOOLS = [
  ['list_workspaces', '这个密钥可以操作的工作区。'],
  ['list_projects', '它能访问的项目，范围可以是整个账号，也可以限定在某一个工作区。'],
  ['list_plans', '按工作区和项目分组的计划，每一份都附有打开它的链接。'],
  [
    'trace',
    '沿着流向追踪计划中的某一部分：一个节点能到达哪里，或者哪些节点能到达它，逐跳列出，并附上每一跳由什么触发、传递什么。这是阅读计划的方式：它返回的是这条线索，而不是整篇文档；遇到循环会报告出来，而不是绕着它一直走下去。',
  ],
  ['get_plan', '一次取回整份计划。大纲、图的 JSON，或者完整的 Markdown。从不包含坐标。'],
  [
    'create_plan',
    '开启一份计划：可以带上你已知的结构，也可以是空的。它是第一个调用，而不是最后一个：返回一个 id，以及可以查看这份计划的地址。',
  ],
  ['create_project', '新建一个用来绘图的项目。'],
  [
    'apply_ops',
    '此后计划靠它继续生长，这也是唯一的写入入口。批量、原子，以标识符为键，所以重试是安全的；而且每一批改动都会同时到达每一个打开着的画布，看着计划的人能看到它逐步变化，而不是直接拿到一张画好的图。',
  ],
  ['layout', '重新排列。人手动拖动过的节点保持原位。'],
  ['export_plan', 'Markdown 文件包，外加 zip 的下载链接。'],
  [
    'delete_plan',
    '把一份计划移入工作区的回收站，人可以从那里恢复它。需要重新输入它的标题作为确认，这样一个写错的 id 就不会删掉别人的成果。',
  ],
] as const;

export default function Docs() {
  return (
    <>
      <article className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">连接智能体</h1>
          <p className="mt-4 text-base leading-[1.65] text-ink-muted">
            Schematic Planner 通过 HTTP 提供 MCP 服务。无需安装任何东西：在账号设置中打开
            <strong className="font-medium text-ink">智能体</strong>，创建一个密钥，然后把 URL
            和密钥粘贴到你的客户端中。
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            密钥属于你本人，而不属于某一个工作区，所以一个密钥就能访问你所属的每一个工作区。在需要选择的地方，工具会接受一个工作区参数；如果要求创建某样东西却没有指定工作区，服务器会列出可选项，而不是替你猜。
          </p>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {MCP_CONFIG}
          </pre>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">工具</h2>
          <dl className="mt-4 space-y-4">
            {TOOLS.map(([name, description]) => (
              <div key={name} className="border-l-2 border-rule pl-4">
                <dt className="slug text-ink">{name}</dt>
                <dd className="mt-1 text-sm leading-[1.6] text-ink-muted">{description}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            为什么智能体不设置位置
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            让语言模型给出坐标，画出来的图没人想看，还白白耗费你的上下文。所以这些工具没有位置字段。智能体只说明什么流向哪里；布局由服务器来做，连接上的文字也由它来摆放。人拖动过的任何东西都会被固定，自动布局再也不会动它。
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">导出包里有什么</h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            流向会写进每个节点的 front
            matter，连同触发它的是什么、传递的是什么。包含连接变成目录嵌套。依赖连接经拓扑排序，变成每个文件名前的数字前缀。每个节点都带有自己的
            frontmatter，因此这个文件包完整地描述了整张图，而不是渲染出它的一张图片。依赖出现循环并不会阻止导出：循环会以稳定的方式被断开，并在
            README 中报告。
          </p>
        </div>
      </article>
    </>
  );
}
