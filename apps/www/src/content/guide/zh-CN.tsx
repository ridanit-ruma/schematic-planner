import type { PageMeta } from '@/content/types';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: '指南',
  description: '创建计划，把它画出来，连接一个 AI 智能体，再把 Markdown 和 Canvas 文件带走。',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

const CREATE_PLAN = `{
  "name": "create_plan",
  "arguments": {
    "title": "Billing rework",
    "nodes": [
      { "slug": "ledger-schema", "title": "Ledger schema" },
      { "slug": "pricing-rules", "title": "Pricing rules" },
      { "slug": "render-pdf",    "title": "Render PDF" }
    ],
    "edges": [
      { "from": "pricing-rules", "to": "ledger-schema" },
      { "from": "render-pdf",    "to": "pricing-rules" }
    ]
  }
}`;

const APPLY_OPS = `{
  "name": "apply_ops",
  "arguments": {
    "planId": "…",
    "ops": [
      { "op": "upsert_node",
        "node": { "slug": "tax", "title": "Tax by region",
                  "kind": "decision", "status": "blocked" } },
      { "op": "upsert_edge",
        "edge": { "from": "tax", "to": "pricing-rules" } },
      { "op": "upsert_node",
        "node": { "slug": "ledger-schema", "status": "done" } }
    ]
  }
}`;

const EXPORT_TREE = `plan-export.zip
├── README.md                 概览和目录
├── 01-foundation/            包含其他节点的节点会变成一个目录
│   ├── README.md             ……它自己的说明放在这里
│   ├── 01-ledger-schema.md
│   └── 02-pricing-rules.md   按依赖关系编号
├── 02-invoicing/
│   └── 01-render-pdf.md
├── plan.canvas               在 Obsidian 中打开，布局原样保留
└── plan.json                 同样的内容，供机器读取`;

export default function Guide() {
  return (
    <>
      <Prose
        title="指南"
        lede="创建计划，把它画出来，交给智能体，再把文件带走。本页走一遍完整流程；每个 MCP 工具的参考说明在文档里。"
      >
        <h2>1. 创建计划</h2>
        <p>一共三层，注册之后前两层就已经有了：</p>
        <pre>{`工作区         成员、角色，以及智能体连接所用的密钥
  └─ 项目      你正在构建的一样东西
       └─ 计划 一张图`}</pre>
        <p>
          打开你的工作区，选一个项目（一开始就有一个名为 <strong>General</strong> 的项目），然后点击
          <strong>新建计划</strong>
          。计划是一张图，而不是一篇文档：你要做的是添加内容并说明它们之间的关系，而不是从头到尾往下写。
        </p>

        <h2>2. 把它画出来</h2>
        <p>
          <strong>添加节点</strong>
          会在你正在查看的位置放下一个节点。点击它，右侧会打开面板：给它一个标题、类型、状态，以及任意多的详细说明。导出时，详细说明会成为该节点
          Markdown 文件的正文，所以值得认真写。
        </p>
        <p>
          五种类型各有含义，从节点的轮廓就能分辨：<strong>功能</strong>和<strong>任务</strong>
          是实线框，
          <strong>决策</strong>缺了一个角，<strong>备注</strong>是虚线框，<strong>分组</strong>
          则画成一条边界，把它所容纳的内容围在里面。
        </p>
        <p>
          标题栏里的四个按钮决定你接下来画的连接代表什么，每个按钮显示的都是连接本身的样子，而不是一个代替它的图标：
        </p>
        <ul>
          <li>
            <strong>流向</strong>
            ：按系统实际的运转方向拖动，比如这个页面调用那个接口，那个接口读取那张表。说明是什么触发了这次交接、传递的是什么，两者都会写在连接上。回应就是另一条指回去的流向。画出一个系统而不是一张清单，靠的就是它。
          </li>
          <li>
            <strong>包含</strong>
            ：从容器拖向要放进去的内容。导出时变成目录的就是它；拖动一个分组，里面的所有内容都会跟着移动。
          </li>
          <li>
            <strong>依赖</strong>
            ：必须先存在的东西，这和谁调用谁并不是一回事。它决定导出时文件的编号顺序。
          </li>
          <li>
            <strong>关联</strong>：单纯的关联，不带任何结构。
          </li>
        </ul>
        <p>点击一条连接，可以更改它的含义、说明它传递的内容，或者删除它。</p>
        <p>
          <strong>自动布局</strong>
          会重新排布整张图。它不会移动任何你亲手拖动过的东西：你放下的节点从此被固定，只有你再次移动它才能解除固定。
        </p>

        <h2>3. 连接智能体</h2>
        <p>
          在账号设置中打开<strong>智能体</strong>，创建一个密钥，然后把 URL 和密钥粘贴到你的 MCP
          客户端中。你的机器上不需要安装任何东西，服务器通过 HTTP 访问。
          <Link href={localePath('zh-CN', '/docs')}>文档</Link>
          中有完整的配置代码块和全部工具列表。
        </p>
        <p>
          密钥在你所属的每个工作区里都代表你本人行事，所以无论你有多少个工作区，一个密钥就够了。一个密钥只交给一个客户端，用那个客户端的名字给它命名，机器易手时就撤销它。
        </p>

        <h2>4. 让智能体来画</h2>
        <p>
          让你的智能体照常把计划写出来，然后让它把计划放到画布上。它有两个入口。一次放入整份计划，用{' '}
          <code>create_plan</code>：
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          此后的一切改动都用 <code>apply_ops</code>
          ：一次批量、原子的调用，会同时出现在每一个打开着的画布上：
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          注意这里少了什么：坐标。智能体只声明结构，布局由服务器来做，因为让语言模型给出位置，画出来的图没人想看，还白白耗费你的上下文。另外还要注意，节点是通过标识符来引用的，所以同一个调用发送两次，第二次什么也不会改变。
        </p>
        <p>
          有一件事值得向你的智能体提出：使用你认得出的标识符。<code>pricing-rules</code>{' '}
          是你在下一条消息里就能直接提到的名字，<code>node-7</code> 不是。
        </p>

        <h2>5. 把文件带走</h2>
        <p>
          <strong>导出</strong>
          会下载一个 zip 包。包含关系变成目录，依赖顺序变成每个文件名前的编号，每个节点都带有自己的
          frontmatter，因此这个包完整地描述了整张图，而不只是它的一张图片。
        </p>
        <pre>{EXPORT_TREE}</pre>
        <p>
          把这个文件夹放进 Obsidian 仓库，<code>plan.canvas</code>{' '}
          就会以同一张图的样子打开。或者把它和源代码一起提交，你的智能体每次运行都会读到它，而这正是这一切的意义所在。
        </p>
        <p>
          依赖出现循环并不会阻止导出。循环会以稳定的方式被断开，并在 README
          中报告，所以同一份计划每次导出的文件都相同。
        </p>

        <h2>6. 与他人协作</h2>
        <p>
          编辑是实时的。两个人同时编辑一份计划，会即时看到对方的改动；两个人在同一个节点的详细说明里打字，内容会合并而不是互相覆盖。通过
          MCP 写入的智能体，也不过是另一位参与者。
        </p>
        <p>
          <strong>分享</strong>
          会生成一个链接，任何人无需账号即可打开、阅读并导出。停止分享后，链接随即失效。
        </p>
        <p>
          工作区中的<strong>成员</strong>
          页面列出其中的所有人，可以更改角色（所有者、管理员、编辑者、查看者），也可以生成邀请链接。目前还没有邮件功能，所以请你自己把链接发出去。
        </p>

        <h2>7. 自己运行</h2>
        <p>
          整套系统以 AGPL-3.0 发布，只需要 Node 和 Postgres，别无其他。克隆
          <Link href="https://github.com/ridanit-ruma/schematic-planner">代码仓库</Link>，复制{' '}
          <code>.env.example</code>，启动 Postgres，应用数据库迁移，然后运行。具体命令见 README。
        </p>
        <p>
          所有配置都通过环境变量完成，而且 Web
          应用是在运行时而不是构建时读取服务器地址的，所以同一个构建产物可以在任何环境中运行。
        </p>

        <h2>尚未实现的功能</h2>
        <p>
          直说吧，因为你迟早会遇到：系统从不发送邮件，所以邀请就是一个由你转交的链接，邮箱地址也无法更改。登录只支持邮箱和密码。画布上没有撤销，没有针对大型计划的搜索，也没有版本历史。
        </p>
        <p>
          如果其中某一项妨碍了你，请在 <Link href={ISSUES}>GitHub Issues</Link>{' '}
          上告诉我们；这会影响接下来优先做什么。
        </p>
      </Prose>
    </>
  );
}
