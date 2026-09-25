import Link from 'next/link';

import { Band, Step } from '@/components/Sections';
import type { PageMeta } from '@/content/types';

import { HeroSchematic } from '@/components/HeroSchematic';
import { appUrl } from '@/lib/app-url';
import { REPO_URL } from '@/lib/links';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: 'Schematic Planner — ブラウザで計画し、成果物は手元に残す',
  description:
    '文章で書いたプランを、あなたと AI エージェントの両方が編集できるグラフにし、Markdown ファイルと Obsidian Canvas としてエクスポートできます。オープンソースで、セルフホストも可能です。',
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

export default function HomeJa() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <h1 className="max-w-[18ch] text-2xl leading-[1.12] font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
              コードを書く前に、プランに形を与える。
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-ink-muted">
              Schematic Planner は、文章で書いたプランを、あなたと AI
              エージェントの両方が編集できるグラフに変えます。そして最後には、手元に残せる Markdown
              ファイルと Obsidian Canvas として返します。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={appUrl()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
              >
                プランを作り始める
              </a>
              <Link
                href={localePath('ja', '/guide')}
                className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
              >
                ガイドを読む
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-rule bg-surface-2 p-3">
            <HeroSchematic />
          </div>
        </div>
      </section>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">解決する問題</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          コーディングエージェントはプランを書くのが得意です。苦手なのは、そのプランをぶらさずに保っておくことです。機能を頼めばもっともらしいタスクリストが出てきますが、三つメッセージを送るころには半分が忘れられ、次の実行ではアーキテクチャがいつの間にか作り直されています。プランはどこにも置かれていなかったのです。会話の中にあっただけで、その会話は先へ進んでしまいました。
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          あなたとエージェントの両方から見える場所にプランを置けば、そうはならなくなります。
        </p>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">使い方の流れ</h2>
        <ol className="mt-6 space-y-6">
          <Step
            title="エージェントがプランを書く"
            body="書き方は自由です。文章でも、タスクリストでも、設計メモでも構いません。ここはすでにうまくいっている部分です。"
          />
          <Step
            title="一度の呼び出しで図になる"
            body="エージェントは構造を送り、サーバーがすべてのノードを配置します。エージェントが宣言するのは何が何に依存するかだけで、座標は決して指定しません。位置を求められたモデルは、誰も読みたくない図を描くからです。"
          />
          <Step
            title="動かしたいものは自分で動かす"
            body="ドラッグしたノードは固定され、それ以降は自動レイアウトの対象外になります。それ以外のものは、その周りに配置し直されます。"
          />
          <Step
            title="ファイルは手元に持ち帰れる"
            body="包含関係はディレクトリに、依存の順序はファイル名の番号になります。フォルダをソースコードの隣にコミットしておけば、エージェントは毎回それを読みます。"
          />
        </ol>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">
              エージェントから見えるもの
            </h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              URL とキーの先に、ツールが 21
              個あります。インストールするものも、サーバーに合わせて更新し続けるものもありません。一度の呼び出しでプランを開き、そこに描くものはすべて、バッチでアトミックに適用されるただ一つの入り口を通ります。だから
              40 個のノードが一つずつ這い出てくるのではなく、キャンバスに一度に現れます。
            </p>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              ノードは見ればそれとわかる識別子で指定するので、再試行しても二度目は何も変わりません。
            </p>
            <Link
              href={localePath('ja', '/docs')}
              className="mt-4 inline-block text-sm text-accent underline"
            >
              ツールリファレンス
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
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">出力されるもの</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              グラフをフロントマターに収めたプレーンな Markdown の zip
              と、レイアウトをそのまま保って Obsidian で開ける <code className="slug">.canvas</code>{' '}
              ファイルです。形式のどこをとっても、読むのにこのサービスは必要ありません。また、同じプランは常にバイト単位で同一の内容にエクスポートされます。
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {EXPORT_TREE}
          </pre>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">セルフホストする</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          スタック全体が AGPL-3.0 で、必要なのは Node と Postgres
          だけです。独自の認証サービスも、マネージドサービス専用の依存もなく、設定はすべて環境変数で行います。ソースコードをネットワークの外に出せない環境でも、プランが外に出ることはありません。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={REPO_URL}
            className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
          >
            ソースコードを読む
          </a>
          <Link href={localePath('ja', '/guide')} className="text-sm text-accent underline">
            まずはガイドから
          </Link>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">現在の状況</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          プレアルファ版です。これははっきり書いておきます。プランの作成、図の描画、リアルタイムの共同編集、エージェント向けのインターフェース、共有、エクスポート、そしてワークスペースとアカウントの管理は、すべて動作します。メールは一切送信されないため、招待は自分で相手に渡すリンクです。ソーシャルログインは実装されていません。プランはエクスポートしておいてください。エクスポートはそのためにあります。
        </p>
      </Band>
    </>
  );
}
