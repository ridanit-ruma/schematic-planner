import Link from 'next/link';

import { Band, Step } from '@/components/Sections';
import type { PageMeta } from '@/content/types';

import { HeroSchematic } from '@/components/HeroSchematic';
import { appUrl } from '@/lib/app-url';
import { REPO_URL } from '@/lib/links';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: 'Schematic Planner — 在瀏覽器中規劃，成果歸你所有',
  description:
    '把寫成文字的計畫變成一張由你和 AI 代理共同編輯的圖，再匯出成 Markdown 檔案和 Obsidian Canvas。開放原始碼，可自行架設。',
};

const AGENT_CALL = `create_plan({ title: "Billing rework" })

apply_ops({
  planId: "…",
  ops: [
    { op: "upsert_node",
      node: { slug: "pricing-rules", title: "Pricing rules" } },
    { op: "upsert_node",
      node: { slug: "render-pdf", title: "Render PDF" } },
    { op: "upsert_edge",
      edge: { from: "pricing-rules", to: "render-pdf" } }
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
              寫程式之前，先讓計畫有個形狀。
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-ink-muted">
              Schematic Planner 把寫成文字的計畫變成一張圖，由你和你的 AI 代理一起編輯，最後再以
              Markdown 檔案和 Obsidian Canvas 的形式交還給你保存。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={appUrl()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
              >
                開始規劃
              </a>
              <Link
                href={localePath('zh-TW', '/guide')}
                className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
              >
                閱讀指南
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-rule bg-surface-2 p-3">
            <HeroSchematic />
          </div>
        </div>
      </section>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">它要解決的問題</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          寫程式的 AI
          代理很會寫計畫，卻沒辦法讓計畫維持不變。請它做一個功能，你會拿到一份看似合理的任務清單，三則訊息之後就忘了一半，到了下一次執行，架構又被悄悄重新發明一遍。計畫從來沒有落腳在任何地方：它只存在於對話裡，而對話早就往前走了。
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          把計畫放在你們雙方都看得到的地方，這種事就不會再發生。
        </p>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">運作方式</h2>
        <ol className="mt-6 space-y-6">
          <Step
            title="AI 代理寫出計畫"
            body="用什麼形式都行：一段文字、一份任務清單、一篇設計筆記。這部分本來就做得很好。"
          />
          <Step
            title="一次呼叫，把計畫變成圖"
            body="AI 代理送出結構，由伺服器擺放每一個節點。AI 代理只宣告誰依賴誰，從不指定座標，因為要模型給出位置，得到的只會是一張沒人想看的圖。"
          />
          <Step
            title="想移動的，你自己移動"
            body="你拖曳過的節點會被固定，從此自動版面配置就不會再動它，其餘的部分則圍繞著它重新排列。"
          />
          <Step
            title="檔案跟著你走"
            body="包含關係變成目錄，依賴順序變成檔名上的編號。把這個資料夾和原始碼一起提交，你的 AI 代理每次執行都會讀到它。"
          />
        </ol>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">AI 代理看到什麼</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              一個 URL
              加一把金鑰，背後是二十一個工具。不必安裝任何東西，也不必和伺服器保持版本一致。一次呼叫就能開啟一份計畫，在其中畫的一切都經過同一個批次、原子化的入口，所以四十個節點會同時出現在你的畫布上，而不是一個接一個慢慢爬進來。
            </p>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              節點以你認得出來的識別碼來指定，所以重試的時候，第二次不會改變任何東西。
            </p>
            <Link
              href={localePath('zh-TW', '/docs')}
              className="mt-4 inline-block text-sm text-accent underline"
            >
              工具參考文件
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
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">產出的是什麼</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              一個純 Markdown 的 zip 檔，圖的結構寫在 frontmatter 裡，另外附上一個{' '}
              <code className="slug">.canvas</code>，在 Obsidian
              中開啟時版面完整保留。這個格式的任何部分都不需要本服務就能閱讀，而且同一份計畫每次匯出的位元組都完全相同。
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {EXPORT_TREE}
          </pre>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">自行架設</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          整套系統採用 AGPL-3.0 授權，只需要 Node 和
          Postgres。沒有專有的身分驗證服務，沒有只能搭配託管服務的相依元件，每一項設定都是一個環境變數。如果你的原始碼不能離開你的網路，你的計畫也不必離開。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={REPO_URL}
            className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
          >
            閱讀原始碼
          </a>
          <Link href={localePath('zh-TW', '/guide')} className="text-sm text-accent underline">
            或從指南開始
          </Link>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">目前的實際進度</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          預覽早期版（pre-alpha），這點值得直說。規劃、繪圖、即時協作、AI
          代理介面、分享、匯出，以及工作區和帳號的管理，全都可以使用。系統從不寄送電子郵件，所以邀請就是一個由你自己轉交的連結；社群帳號登入還沒有做。請匯出你的計畫，匯出功能就是為此而設的。
        </p>
      </Band>
    </>
  );
}
