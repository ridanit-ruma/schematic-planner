import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: 'ドキュメント',
  description:
    'MCP で AI エージェントを Schematic Planner に接続する方法と、エクスポートの中身について説明します。',
};

const MCP_CONFIG = `{
  "mcpServers": {
    "schematic-planner": {
      "type": "http",
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
    'ワークスペース、プロジェクト、フォルダごとにまとめたプランの一覧。それぞれに開くためのリンクが付きます。',
  ],
  [
    'search',
    'このキーでアクセスできるすべてのプランから、タイトル、識別子、タグ、詳細に含まれる語を探し、それが含まれるプランを返します。新しく描く前に使ってください。誰かがすでに描いたシステムを二つ目のプランとして描くと、ワークスペースはすぐに散らかります。',
  ],
  [
    'trace',
    'プランの一部分についてフローをたどります。あるノードがどこへ到達するか、あるいはどこからそのノードへ到達するかを一段ずつ、各段のきっかけと運ばれるものとともに返します。プランを読むための方法で、文書全体ではなく一本の筋だけを返し、循環は一周たどらずに循環として報告します。',
  ],
  [
    'get_plan',
    'プラン全体を一度に取得します。アウトライン、グラフの JSON、または Markdown 全文で返します。座標は返しません。末尾にはプロジェクトで使える種類とステータスが付くので、エージェントはどの言葉を使えるかがわかります。',
  ],
  [
    'read_nodes',
    '指定したノードの詳細全文を Markdown で、それぞれが何とつながり、何に含まれているかとともに返します。',
  ],
  [
    'next_task',
    'プランがどこまで進んだかと、いま始められる作業を、それぞれの詳細とともに返します。ステータスの名前ではなくその意味に基づいて、すでに進行中の作業、ブロックされている作業、先行する作業がすべて完了または中止されてすぐに始められる作業に分けます。',
  ],
  ['plan_history', '誰が何を変えたかを新しい順に。人かエージェントかを問いません。'],
  ['create_project', '描くための新しいプロジェクトを作成します。'],
  [
    'create_plan',
    '空のプランを開きます。フォルダのパスを渡せばそのフォルダに入れます。最後ではなく最初に呼ぶもので、id と、そのプランを見られるアドレス、プロジェクトで使える種類とステータスを返します。',
  ],
  [
    'apply_ops',
    'その後プランを育てていく方法で、書き込みの唯一の入り口です。まとめてアトミックに適用され、識別子をキーにしているので再試行しても安全です。各バッチは開いているすべてのキャンバスに同時に届くため、プランを見ている人は完成した絵を渡されるのではなく、変化していく様子を見ることになります。種類とステータスはプロジェクトと照らし合わせて確認され、プロジェクトにない値があれば、ある値の一覧とともにバッチ全体が拒否されます。',
  ],
  [
    'set_plan_sources',
    'このプランがどのプランをもとに書かれたかを設定します。プランを読み直すと、それぞれの出典がまだあるかどうかがわかります。',
  ],
  ['layout', '配置し直します。人がドラッグしたノードはその場所に残ります。'],
  ['export_plan', 'Markdown 一式と、zip へのリンク。'],
  [
    'delete_plan',
    'プランをワークスペースのゴミ箱に移します。ゴミ箱からは人が復元できます。タイトルをそのまま入力し直す必要があるので、id を間違えても他人の作業を消すことはありません。',
  ],
  [
    'list_folders',
    'プロジェクト内のフォルダを Specs/Billing のようなパスで一覧にし、それぞれに入っているプランの数を返します。',
  ],
  [
    'create_folder',
    'フォルダを作成します。パスを渡すと別のフォルダの中に作り、途中で足りないフォルダもまとめて作ります。すでにあるフォルダを求められた場合は、新しく作らずにそれを返します。',
  ],
  ['rename_folder', 'フォルダの名前を変えます。フォルダも中身もその場所のままです。'],
  [
    'delete_folder',
    'フォルダを、中のフォルダやプランごとゴミ箱に移します。復元すればすべて一緒に戻ります。フォルダ名をそのまま入力し直す必要があります。',
  ],
  [
    'move_plan',
    'プランを別のフォルダ、別のプロジェクト、または別のワークスペースのプロジェクトへ移します。ワークスペースをまたぐと共有リンクは無効になります。',
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
            フォルダはパスで指定する
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            フォルダの中にフォルダを置けるので、フォルダを受け取るツールはプロジェクトの最上位からのパスを受け取ります。たとえば{' '}
            <code className="slug">Specs/Billing</code>{' '}
            です。その名前のフォルダがプロジェクトに一つしかなければ名前だけでも通じるので、フォルダを入れ子にできるようになる前に書いたプロンプトもそのまま動きます。二つのフォルダが同じ名前を使っている場合は、推測せずに両方のパスを示して拒否します。
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            種類とステータスはプロジェクトが決める
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            プロジェクトごとに種類とステータスを定義し、そのプロジェクトのプランはすべてそれを使います。エージェントは{' '}
            <code className="slug">get_plan</code> や <code className="slug">create_plan</code>{' '}
            の応答でそれを読み、id
            で書きます。名前で書いても構いません。誰も変更していないプロジェクトには組み込みの値があります。
            <code className="slug">idea</code>、<code className="slug">planned</code>、
            <code className="slug">in_progress</code>、<code className="slug">blocked</code>、
            <code className="slug">done</code>、<code className="slug">dropped</code>、そして{' '}
            <code className="slug">feature</code>、<code className="slug">task</code>、
            <code className="slug">decision</code>、<code className="slug">note</code>、
            <code className="slug">group</code>{' '}
            です。プロジェクトにない値は、ある値の一覧とともに拒否されます。エージェントはこの一覧を使えますが、変えることはできません。変更はプロジェクト設定で行います。
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            ノードの詳細は、アプリではブロックエディタで書き、エージェントは Markdown
            として読み書きします。表、トグル、コールアウトは、それぞれ Markdown の表、
            <code className="slug">&lt;details&gt;</code> ブロック、Obsidian
            のコールアウトとしてやり取りされます。
          </p>

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
