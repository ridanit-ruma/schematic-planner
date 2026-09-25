import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: 'ドキュメント',
  description:
    'MCP で AI エージェントを Schematic Planner に接続する方法と、エクスポートの中身について説明します。',
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
  ['list_workspaces', 'このキーで操作できるワークスペース。'],
  [
    'list_projects',
    'アクセスできるプロジェクト。アカウント全体から、または一つのワークスペースに絞って取得します。',
  ],
  [
    'list_plans',
    'ワークスペースとプロジェクトごとにまとめたプランの一覧。それぞれに開くためのリンクが付きます。',
  ],
  [
    'trace',
    'プランの一部分についてフローをたどります。あるノードがどこへ到達するか、あるいはどこからそのノードへ到達するかを一段ずつ、各段のきっかけと運ばれるものとともに返します。プランを読むための方法で、文書全体ではなく一本の筋だけを返し、循環は一周たどらずに循環として報告します。',
  ],
  [
    'get_plan',
    'プラン全体を一度に取得します。アウトライン、グラフの JSON、または Markdown 全文で返します。座標は返しません。',
  ],
  [
    'create_plan',
    'プランを開きます。すでにわかっている構造を渡しても、空のままでも構いません。最後ではなく最初に呼ぶもので、id と、そのプランを見られるアドレスを返します。',
  ],
  ['create_project', '描くための新しいプロジェクトを作成します。'],
  [
    'apply_ops',
    'その後プランを育てていく方法で、書き込みの唯一の入り口です。まとめてアトミックに適用され、識別子をキーにしているので再試行しても安全です。各バッチは開いているすべてのキャンバスに同時に届くため、プランを見ている人は完成した絵を渡されるのではなく、変化していく様子を見ることになります。',
  ],
  ['layout', '配置し直します。人がドラッグしたノードはその場所に残ります。'],
  ['export_plan', 'Markdown 一式と、zip へのリンク。'],
  [
    'delete_plan',
    'プランをワークスペースのゴミ箱に移します。ゴミ箱からは人が復元できます。タイトルをそのまま入力し直す必要があるので、id を間違えても他人の作業を消すことはありません。',
  ],
] as const;

export default function DocsJa() {
  return (
    <>
      <article className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">
            エージェントを接続する
          </h1>
          <p className="mt-4 text-base leading-[1.65] text-ink-muted">
            Schematic Planner は HTTP 経由の MCP
            に対応しています。インストールするものはありません。アカウント設定で
            <strong className="font-medium text-ink">エージェント</strong>
            を開いてキーを作成し、URL とキーをクライアントに貼り付けてください。
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            キーは特定のワークスペースではなくあなたに属するので、一つのキーで、あなたがメンバーになっているすべてのワークスペースにアクセスできます。そのせいで選択の余地が生じる場面では、ツールがワークスペースを引数として受け取ります。ワークスペースを指定せずに何かを作成しようとすると、サーバーは推測せずに選択肢を示します。
          </p>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {MCP_CONFIG}
          </pre>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">ツール</h2>
          <dl className="mt-4 space-y-4">
            {TOOLS.map(([name, description]) => (
              <div key={name} className="border-l-2 border-rule pl-4">
                <dt className="slug text-ink">{name}</dt>
                <dd className="mt-1 text-sm leading-[1.6] text-ink-muted">{description}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            エージェントが位置を決めない理由
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            座標を求められた言語モデルは、誰も読みたくない図を描き、そのためにコンテキストまで消費します。そこで、ツールには位置を指定するフィールドがありません。エージェントは何がどこへ流れるかを伝え、レイアウトはサーバーが行います。各線に書かれた文字の配置もサーバーが決めます。人がドラッグしたものは固定され、自動レイアウトがそれに触れることは二度とありません。
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            エクスポートの中身
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            フローは、そのきっかけと運ばれるものとともに、各ノードのフロントマターに書き込まれます。包含の接続はディレクトリの入れ子になります。依存の接続はトポロジカル順序になり、それが各ファイル名の先頭の番号になります。どのノードも自分のフロントマターを持っているので、このファイル一式はグラフの絵を描くのではなく、グラフそのものを完全に記述しています。依存関係に循環があってもエクスポートは止まりません。循環は毎回同じ方法で断ち切られ、README
            に報告されます。
          </p>
        </div>
      </article>
    </>
  );
}
