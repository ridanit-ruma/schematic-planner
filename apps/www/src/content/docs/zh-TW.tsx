import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: '文件',
  description: '透過 MCP 將 AI 代理連接到 Schematic Planner，並了解匯出的內容包含哪些東西。',
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
  ['list_workspaces', '這把金鑰可以操作的工作區。'],
  ['list_projects', '它能存取的專案，可以涵蓋整個帳號，也可以限定在單一工作區。'],
  ['list_plans', '依工作區和專案分組列出的計畫，每一份都附上開啟它的連結。'],
  [
    'trace',
    '沿著計畫中某一部分的流向追下去：一個節點能到達哪裡，或有哪些節點會到達它，一步一步列出，並附上每一步由什麼觸發、傳遞了什麼。這是閱讀計畫的方式：它回應的是那一條脈絡，而不是整份文件；遇到循環時會直接回報，而不會繞著它打轉。',
  ],
  ['get_plan', '一次取得整份計畫。可以是大綱、圖的 JSON，或完整的 Markdown。從不包含座標。'],
  [
    'create_plan',
    '開啟一份計畫，可以帶著你已經知道的結構，也可以是空白的。這是第一個呼叫，而不是最後一個：它會回應一個 id，以及可以檢視這份計畫的網址。',
  ],
  ['create_project', '建立一個新專案，用來在其中繪製計畫。'],
  [
    'apply_ops',
    '計畫在那之後如何成長，也是唯一的寫入入口。批次、原子化，以識別碼為鍵，所以重試是安全的；而且每個批次都會同時送達每一個開啟中的畫布，讓正在看這份計畫的人看著它變化，而不是直接拿到一張已經完成的圖。',
  ],
  ['layout', '重新排列。有人拖曳過的節點會留在原位。'],
  ['export_plan', 'Markdown 檔案包，外加 zip 檔的連結。'],
  [
    'delete_plan',
    '把一份計畫移到工作區的垃圾桶，之後可以由人還原。必須重新輸入它的標題，這樣一個錯誤的 id 就不會刪掉別人的成果。',
  ],
] as const;

export default function Docs() {
  return (
    <>
      <article className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">連接 AI 代理</h1>
          <p className="mt-4 text-base leading-[1.65] text-ink-muted">
            Schematic Planner 透過 HTTP 提供 MCP。不需要安裝任何東西：在帳號設定中開啟{' '}
            <strong className="font-medium text-ink">AI 代理</strong>，建立一把金鑰，然後把 URL
            和金鑰貼到你的用戶端。
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            金鑰屬於你本人，而不是屬於某個工作區，所以一把金鑰就能用在你所屬的每一個工作區。遇到需要選擇的時候，工具會接受一個工作區參數；如果要求建立東西卻沒有指定工作區，伺服器會列出可以選擇的項目，而不是自己亂猜。
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
            為什麼 AI 代理不設定位置
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            要語言模型給出座標，只會得到一張沒人想看的圖，還白白耗掉你的上下文。所以這些工具沒有位置欄位。AI
            代理只說明什麼流向哪裡；伺服器執行自動版面配置，也負責擺放每條連接上的文字。凡是有人拖曳過的東西都會被固定，自動版面配置再也不會碰它。
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            匯出的內容包含什麼
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            流向會寫進每個節點的
            frontmatter，連同觸發它們的條件和它們傳遞的內容。包含連接會變成目錄的巢狀結構。依賴連接會形成拓撲排序，再變成每個檔名前面的數字前綴。每個節點都帶有自己的
            frontmatter，所以這個檔案包完整描述了整張圖，而不是畫出一張圖片。依賴循環不會阻擋匯出：它會以固定的方式被打斷，並記錄在
            README 中。
          </p>
        </div>
      </article>
    </>
  );
}
