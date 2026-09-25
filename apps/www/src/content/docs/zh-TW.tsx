import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: '文件',
  description: '透過 MCP 將 AI 代理連接到 Schematic Planner，並了解匯出的內容包含哪些東西。',
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
  ['list_workspaces', '這把金鑰可以操作的工作區。'],
  ['list_projects', '它能存取的專案，可以涵蓋整個帳號，也可以限定在單一工作區。'],
  ['list_plans', '依工作區、專案和資料夾分組列出的計畫，每一份都附上開啟它的連結。'],
  [
    'search',
    '在這把金鑰能存取的所有計畫中尋找字詞——標題、識別碼、標籤和詳細內容——並回應它們所在的計畫。畫新東西之前先用它：別人已經畫過的系統再畫一份，工作區很快就會亂成一團。',
  ],
  [
    'trace',
    '沿著計畫中某一部分的流向追下去：一個節點能到達哪裡，或有哪些節點會到達它，一步一步列出，並附上每一步由什麼觸發、傳遞了什麼。這是閱讀計畫的方式：它回應的是那一條脈絡，而不是整份文件；遇到循環時會直接回報，而不會繞著它打轉。',
  ],
  [
    'get_plan',
    '一次取得整份計畫。可以是大綱、圖的 JSON，或完整的 Markdown。從不包含座標。回應的最後會附上專案使用的類型和狀態，讓 AI 代理知道有哪些詞彙可用。',
  ],
  ['read_nodes', '以 Markdown 回應指定節點的完整詳細內容，並附上每個節點連接到什麼、被什麼包含。'],
  [
    'next_task',
    '計畫進展到哪裡，以及現在可以開始哪些工作，每一項都附上詳細內容。它依照狀態的意義而不是名稱來判斷：已經在進行的工作、受阻的工作，以及前面的工作都已完成或放棄、可以馬上開始的工作。',
  ],
  ['plan_history', '誰改了什麼，由新到舊排列——不論是人還是 AI 代理。'],
  ['create_project', '建立一個新專案，用來在其中繪製計畫。'],
  [
    'create_plan',
    '開啟一份空白計畫；給出資料夾路徑，就會歸檔到那個資料夾裡。這是第一個呼叫，而不是最後一個：它會回應一個 id、可以檢視這份計畫的網址，以及專案使用的類型和狀態。',
  ],
  [
    'apply_ops',
    '計畫在那之後如何成長，也是唯一的寫入入口。批次、原子化，以識別碼為鍵，所以重試是安全的；而且每個批次都會同時送達每一個開啟中的畫布，讓正在看這份計畫的人看著它變化，而不是直接拿到一張已經完成的圖。類型和狀態會對照專案檢查：只要有一個是專案裡沒有的，整個批次都會被拒絕，並列出現有的值。',
  ],
  [
    'set_plan_sources',
    '說明這份計畫是根據哪些計畫寫成的。重新讀取計畫時，會告訴你每個來源是否還在。',
  ],
  ['layout', '重新排列。有人拖曳過的節點會留在原位。'],
  ['export_plan', 'Markdown 檔案包，外加 zip 檔的連結。'],
  [
    'delete_plan',
    '把一份計畫移到工作區的垃圾桶，之後可以由人還原。必須重新輸入它的標題，這樣一個錯誤的 id 就不會刪掉別人的成果。',
  ],
  [
    'list_folders',
    '專案中的資料夾，每個都以 Specs/Billing 這樣的路徑列出，並附上其中歸檔的計畫數量。',
  ],
  [
    'create_folder',
    '建立資料夾。給出路徑就會建在另一個資料夾裡，路徑上缺少的資料夾也會一併建立。如果要的資料夾已經存在，就直接回應那一個。',
  ],
  ['rename_folder', '重新命名資料夾。資料夾和其中的內容都留在原處。'],
  [
    'delete_folder',
    '把資料夾連同裡面的資料夾和計畫一起移到垃圾桶，還原時全部一起回來。必須重新輸入資料夾的名稱。',
  ],
  [
    'move_plan',
    '把計畫移到別處：另一個資料夾、另一個專案，或另一個工作區中的專案；跨工作區移動會讓它的分享連結失效。',
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
            資料夾以路徑指定
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            資料夾可以巢狀放置，所以接受資料夾參數的工具，使用的是從專案最上層開始的路徑，例如{' '}
            <code className="slug">Specs/Billing</code>
            。如果專案裡只有一個資料夾叫這個名字，只寫名字也可以，所以在資料夾能巢狀放置之前寫好的提示詞照樣能用。兩個資料夾同名時，伺服器不會亂猜，而是列出兩者的路徑並拒絕。
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            類型和狀態由專案定義
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            每個專案定義自己的類型和狀態，專案中的所有計畫都使用它們。AI 代理從{' '}
            <code className="slug">get_plan</code> 或 <code className="slug">create_plan</code>{' '}
            的回應中讀到它們，並寫入它們的 id；寫名稱也可以。沒有人改過的專案使用內建的一套：
            <code className="slug">idea</code>、<code className="slug">planned</code>、
            <code className="slug">in_progress</code>、<code className="slug">blocked</code>、
            <code className="slug">done</code>、<code className="slug">dropped</code>，以及{' '}
            <code className="slug">feature</code>、<code className="slug">task</code>、
            <code className="slug">decision</code>、<code className="slug">note</code>、
            <code className="slug">group</code>
            。專案裡沒有的值會被拒絕，並附上現有值的清單。AI
            代理可以使用這套詞彙，但不能修改；修改要在專案設定中進行。
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            節點的詳細內容在應用程式裡用區塊編輯器撰寫，AI 代理則以 Markdown
            讀寫。表格、摺疊區塊和提示框分別以 Markdown 表格、
            <code className="slug">&lt;details&gt;</code> 區塊和 Obsidian 的 callout 形式往來。
          </p>

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
