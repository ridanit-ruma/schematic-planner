import Link from 'next/link';

import { Band, Step } from '@/components/Sections';
import type { PageMeta } from '@/content/types';

import { HeroSchematic } from '@/components/HeroSchematic';
import { appUrl } from '@/lib/app-url';
import { REPO_URL } from '@/lib/links';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: 'Schematic Planner — 在浏览器里规划，产出归你所有',
  description:
    '把写好的计划变成一张你和 AI 智能体都能编辑的图，再导出为 Markdown 文件和 Obsidian Canvas。开源，可自托管。',
};

const AGENT_CALL = `create_plan({
  title: "Billing rework",
  nodes: [
    { slug: "ledger-schema", title: "Ledger schema" },
    { slug: "pricing-rules", title: "Pricing rules" },
    { slug: "render-pdf",    title: "Render PDF" }
  ],
  edges: [
    { from: "pricing-rules", to: "ledger-schema" },
    { from: "render-pdf",    to: "pricing-rules" }
  ]
})`;

const EXPORT_TREE = `plan-export.zip
├── README.md
├── 01-foundation/
│   ├── 01-ledger-schema.md
│   └── 02-pricing-rules.md
├── 02-invoicing/
│   └── 01-render-pdf.md
├── plan.canvas
└── plan.json`;

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <h1 className="max-w-[18ch] text-2xl leading-[1.12] font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
              写代码之前，先让计划成形。
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-ink-muted">
              Schematic Planner 把写好的计划变成一张你和 AI 智能体都能编辑的图，然后以 Markdown
              文件和 Obsidian Canvas 的形式交还给你，由你保存。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={appUrl()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
              >
                开始规划
              </a>
              <Link
                href={localePath('zh-CN', '/guide')}
                className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
              >
                阅读指南
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-rule bg-surface-2 p-3">
            <HeroSchematic />
          </div>
        </div>
      </section>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">它要解决的问题</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          编程智能体很会写计划，却没法让计划稳住不动。你要一个功能，它给你一份像模像样的任务清单；三条消息之后，一半已被忘掉，下一次运行时，架构又被悄悄重新发明了一遍。计划从来不在任何地方：它只在对话里，而对话早已往前走了。
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          把计划放在你们双方都看得见的地方，这种事就不会再发生。
        </p>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">流程是这样的</h2>
        <ol className="mt-6 space-y-6">
          <Step
            title="智能体写出计划"
            body="怎么写都行：一段文字、一份任务清单、一篇设计笔记。这部分本来就没问题。"
          />
          <Step
            title="一次调用，把它变成图"
            body="智能体发送结构，服务器负责摆放每个节点。智能体只声明谁依赖谁，从不给出坐标，因为让模型给出位置，画出来的图没人想看。"
          />
          <Step
            title="想挪哪里，你来挪"
            body="你拖动过的节点会被固定，此后自动布局不再动它。其余部分围绕它重新排布。"
          />
          <Step
            title="文件随你带走"
            body="包含关系变成目录，依赖顺序变成文件名前的编号。把这个文件夹和源代码一起提交，智能体每次运行都会读到它。"
          />
        </ol>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">智能体看到的是什么</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              一个 URL
              加一个密钥，背后是十一个工具。无需安装，也无需跟着服务器同步更新。整份计划一次调用就能送达，之后的每处改动都经由同一个批量、原子的入口，所以四十个节点会同时出现在你的画布上，而不是一个接一个慢慢爬进来。
            </p>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              节点通过你一眼就能认出的标识符来引用，所以重试不会造成第二次改动。
            </p>
            <Link
              href={localePath('zh-CN', '/docs')}
              className="mt-4 inline-block text-sm text-accent underline"
            >
              工具参考
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {AGENT_CALL}
          </pre>
        </div>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">导出的是什么</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              一个纯 Markdown 的 zip 包，图结构写在 frontmatter 里，另附一个{' '}
              <code className="slug">.canvas</code>，在 Obsidian
              中打开时布局原样保留。这个格式的任何部分都不依赖本服务就能读懂，同一份计划每次导出的字节都完全相同。
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {EXPORT_TREE}
          </pre>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">自己运行</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          整套系统以 AGPL-3.0 发布，只需要 Node 和
          Postgres。没有专有的身份验证服务，没有只能托管使用的依赖，每项设置都是一个环境变量。如果你的源代码不能离开你的网络，你的计划也不会。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={REPO_URL}
            className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
          >
            阅读源代码
          </a>
          <Link href={localePath('zh-CN', '/guide')} className="text-sm text-accent underline">
            或者从指南开始
          </Link>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">它现在的真实状态</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          预览早期版（pre-alpha），这一点值得直说。规划、绘图、实时协作、智能体接口、分享、导出，以及管理工作区和账号，都已可用。它从不发送邮件，所以邀请就是一个由你转交的链接；社交账号登录尚未实现。请导出你的计划，导出功能就是为此而设的。
        </p>
      </Band>
    </>
  );
}
