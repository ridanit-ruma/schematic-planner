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
    "folder": "Specs/Billing"
  }
}`;

const APPLY_OPS = `{
  "name": "apply_ops",
  "arguments": {
    "planId": "…",
    "ops": [
      { "op": "upsert_node",
        "node": { "slug": "pricing-rules", "title": "Pricing rules" } },
      { "op": "upsert_node",
        "node": { "slug": "tax", "title": "Tax by region",
                  "kind": "decision", "status": "blocked" } },
      { "op": "upsert_edge",
        "edge": { "from": "tax", "to": "pricing-rules",
                  "carries": "rate table" } }
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
        <p>计划是这样归档的，注册之后前两层就已经有了：</p>
        <pre>{`工作区             成员、角色，以及智能体连接所用的密钥
  └─ 项目          你正在构建的一样东西，以及它的计划所用的词汇
       └─ 文件夹   可选，文件夹里还可以再放文件夹
            └─ 计划  一张图`}</pre>
        <p>
          整个应用就是一个界面。左侧的侧边栏里有<strong>最近</strong>
          ，下面是工作区里的所有项目，以及它们的文件夹和计划。点击项目或文件夹可以展开或收起，点击计划就会在右侧打开。设置、成员和回收站也在右侧打开，侧边栏始终留在旁边。拖动侧边栏的边缘可以把它拉宽。
        </p>
        <p>
          把指针移到项目或文件夹上，那一行会出现<strong>新建计划</strong>和
          <strong>新建文件夹</strong>两个图标，用来在其中新建。树底部的图标可以新建计划、文件夹或
          <strong>新建项目</strong>
          。名称直接在树里输入。把计划或文件夹拖到另一个文件夹上就能归档进去；通过每一行的菜单或右键，可以重命名、移动、分享、导出或移到回收站。
        </p>
        <p>
          一开始就有一个名为 <strong>General</strong>{' '}
          的项目。计划是一张图，而不是一篇文档：你要做的是添加内容并说明它们之间的关系，而不是从头到尾往下写。
        </p>

        <h2>2. 把它画出来</h2>
        <p>
          新建节点最快的方式是从另一个节点开始。从节点右侧的端点拖出，在画布空白处松开：松开的位置会出现一个已经连好的新节点，可以直接输入标题。按{' '}
          <strong>Enter</strong> 保留，按 <strong>Escape</strong>{' '}
          撤回。在分组里松开，新节点就会加入那个分组。在空白的计划里，可以用标题栏中的
          <strong>添加节点</strong>，或在画布上右键选择<strong>在此添加节点</strong>
          ，以同样的方式新建。双击标题，就能直接在卡片上重命名。
        </p>
        <p>
          点击一个节点，右侧会打开面板：设置它的类型、状态和标签，并写下任意多的详情。导出时，详情会成为该节点
          Markdown 文件的正文，所以值得认真写。
        </p>
        <p>
          新画的连接一律从流向开始。点击连接，选择它的<strong>含义</strong>：
        </p>
        <ul>
          <li>
            <strong>流向</strong>
            ：系统实际运转的方向，比如这个页面调用那个接口，那个接口读取那张表。说明是什么触发了这次交接、传递的是什么，两者都会写在连接上。回应就是另一条指回去的流向。画出一个系统而不是一张清单，靠的就是它。
          </li>
          <li>
            <strong>包含</strong>
            ：从容器指向要放进去的内容。导出时变成目录的就是它；拖动一个分组，里面的所有内容都会跟着移动。
          </li>
          <li>
            <strong>依赖</strong>
            ：必须先存在的东西，这和谁调用谁并不是一回事。它决定导出时文件的编号顺序。
          </li>
          <li>
            <strong>关联</strong>：单纯的关联，不带任何结构。
          </li>
        </ul>
        <p>在同一个面板里，可以说明是什么触发了这条连接、它传递什么，或者删除它。</p>
        <p>
          <strong>自动布局</strong>
          会重新排布整张图。它不会移动任何你亲手拖动过的东西：你放下的节点从此被固定，只有你再次移动它才能解除固定。
        </p>

        <h2>3. 操作画布</h2>
        <p>画布的操作方式和绘图工具一样：</p>
        <ul>
          <li>
            <strong>在画布空白处拖动</strong>会画出一个选框，碰到的节点都会被选中；按住 Shift
            拖动则加入当前的选择。按住 Shift、Ctrl 或 ⌘ 点击，可以把单个节点加入或移出选择。
          </li>
          <li>
            <strong>平移</strong>可以用鼠标中键拖动、按住空格键拖动，或者滚动滚轮；Shift
            加滚轮则横向移动。<strong>缩放</strong>用 Ctrl 或 ⌘ 加滚轮，或者双指捏合。
          </li>
          <li>
            <strong>拖动选中的内容</strong>会整体移动，按 Backspace 或 Delete 删除。
          </li>
          <li>
            <strong>按住 Alt/⌥ 拖动</strong>会把原节点留在原处，在松开的位置放下副本。
          </li>
          <li>
            <strong>Ctrl/⌘ + C、X、V</strong>{' '}
            分别是复制、剪切和粘贴——粘贴在指针所在的位置，也可以粘贴到另一个计划或另一个标签页里。
            <strong>Ctrl/⌘ + D</strong> 在原地创建副本。
          </li>
        </ul>
        <p>
          拖动时，画布还会对齐间距：把一个节点移到与相邻节点的距离恰好等于另外两个节点间距的位置，它就会吸附过去，相同的间距以粉色标注显示。选中一行或一列间距相等的节点，每个间距上都会出现一个手柄，拖动其中一个就能同时调整所有间距。如果间距不均匀，先右键选择
          <strong>整理间距</strong>。
        </p>

        <h2>4. 编写详情</h2>
        <p>
          节点的详情是一个块编辑器。输入 <code>#</code> 和空格就是标题（<code>##</code>、
          <code>###</code> 是更小的标题），<code>-</code> 是列表，<code>1.</code> 是编号列表，
          <code>[]</code> 是待办，<code>&gt;</code> 是引用，三个反引号是代码，<code>---</code>{' '}
          是分隔线。输入 <code>/</code> 会打开所有块的菜单，其中也有<strong>表格</strong>、
          <strong>折叠块</strong>和<strong>标注</strong>
          （备注、提示、注意、危险）。拖动块旁边的手柄，可以把它移到别处。
        </p>
        <p>
          多个人可以同时在同一份详情里写作，并看到彼此的光标；智能体写入的内容也会以同样的方式合并。画布上的卡片会显示同样的内容，连标题也不例外，待办事项可以直接在卡片上勾选。
        </p>
        <p>
          在编辑器之外，无论是导出还是智能体，读到的详情都是 Markdown。表格是 Markdown
          表格，折叠块是 <code>&lt;details&gt;</code> 块，标注是 Obsidian
          标注，所以放进仓库后仍然是原来的样子。
        </p>

        <h2>5. 项目的词汇</h2>
        <p>
          类型和状态属于项目，所以同一个项目里的所有计划使用同一套词汇。新项目一开始就有这些状态：
          <strong>构想</strong>、<strong>已计划</strong>、<strong>进行中</strong>、
          <strong>受阻</strong>、<strong>已完成</strong>、<strong>已放弃</strong>；以及这些类型：
          <strong>功能</strong>、<strong>任务</strong>、<strong>决策</strong>、<strong>备注</strong>
          、<strong>分组</strong>
          。状态选择器中每个状态都显示自己的颜色，类型选择器中每个类型都显示自己的轮廓；两者的最后一项都是
          <strong>编辑…</strong>，点击后会打开<strong>项目设置</strong>中的
          <strong>状态、类型与标签</strong>。
        </p>
        <p>
          在那里可以添加、重命名、更改颜色和调整顺序。每个状态都属于一个分类——待办、进行中、受阻、已完成或已取消——分类决定了它的作用：向智能体推荐下一步做什么、哪些流向画成红色、哪些算作进度。每个类型都有自己的轮廓，并决定是否算作工作。删除状态或类型会将其归档：它会从选择器中消失，但正在使用它的节点会一直保留，直到有人更改。分组是内置的，无法删除。
        </p>
        <p>
          标签的用法像下拉选择。输入文字会筛选项目的标签，按 Enter
          选中高亮的那个；如果没有匹配的，就新建一个带有自己颜色的标签。输入框为空时按
          Backspace，会移除最后一个标签。标签自己的菜单可以更改颜色，或把它从项目中删除，节点上仍会保留这个名称。
        </p>

        <h2>6. 连接智能体</h2>
        <p>
          在账号设置中打开<strong>智能体</strong>，创建一个密钥，然后把 URL 和密钥粘贴到你的 MCP
          客户端中。你的机器上不需要安装任何东西，服务器通过 HTTP 访问。
          <Link href={localePath('zh-CN', '/docs')}>文档</Link>
          中有完整的配置代码块和全部工具列表。
        </p>
        <p>
          密钥在你所属的每个工作区里都代表你本人行事，所以无论你有多少个工作区，一个密钥就够了。一个密钥只交给一个客户端，用那个客户端的名字给它命名，机器易手时就撤销它。
        </p>

        <h2>7. 让智能体来画</h2>
        <p>
          让你的智能体照常把计划写出来，然后让它把计划放到画布上。它用 <code>create_plan</code>{' '}
          打开一个计划；愿意的话，可以给出路径，直接归档到某个文件夹里：
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          然后用 <code>apply_ops</code>{' '}
          来画：一次批量、原子的调用，会同时出现在每一个打开着的画布上。此后的每一处改动也都用这个调用：
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          注意这里少了什么：坐标。智能体只声明结构，布局由服务器来做，因为让语言模型给出位置，画出来的图没人想看，还白白耗费你的上下文。另外还要注意，节点是通过标识符来引用的，所以同一个调用发送两次，第二次什么也不会改变。
        </p>
        <p>
          智能体使用的也是项目的词汇。读取计划时，它会知道有哪些类型和状态；使用项目里没有的值会被拒绝，并附上现有值的列表——所以智能体没法悄悄编造一个自己的状态。
        </p>
        <p>
          有一件事值得向你的智能体提出：使用你认得出的标识符。<code>pricing-rules</code>{' '}
          是你在下一条消息里就能直接提到的名字，<code>node-7</code> 不是。
        </p>

        <h2>8. 把文件带走</h2>
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

        <h2>9. 与他人协作</h2>
        <p>
          编辑是实时的。两个人同时编辑一份计划，会即时看到对方的改动；两个人在同一个节点的详情里打字，内容会合并而不是互相覆盖。通过
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

        <h2>10. 自己运行</h2>
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
          直说吧，因为你迟早会遇到：系统从不发送邮件，所以邀请就是一个由你转交的链接，邮箱地址也无法更改。登录只支持邮箱和密码。应用里没有搜索框；历史记录会列出每一处改动，但还不能恢复到之前的版本。
        </p>
        <p>
          如果其中某一项妨碍了你，请在 <Link href={ISSUES}>GitHub Issues</Link>{' '}
          上告诉我们；这会影响接下来优先做什么。
        </p>
      </Prose>
    </>
  );
}
