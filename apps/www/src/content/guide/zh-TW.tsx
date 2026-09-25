import type { PageMeta } from '@/content/types';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: '指南',
  description: '建立計畫、把它畫出來、連接 AI 代理，然後帶走 Markdown 和 Canvas 檔案。',
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
├── README.md                 概覽和內容目錄
├── 01-foundation/            包含其他節點的節點會變成目錄
│   ├── README.md             ……它本身的說明放在這裡
│   ├── 01-ledger-schema.md
│   └── 02-pricing-rules.md   按依賴關係編號
├── 02-invoicing/
│   └── 01-render-pdf.md
├── plan.canvas               在 Obsidian 中開啟，版面完整保留
└── plan.json                 相同的內容，機器可讀的格式`;

export default function Guide() {
  return (
    <>
      <Prose
        title="指南"
        lede="建立計畫、把它畫出來、交給 AI 代理，再把檔案帶走。本頁會走過整個流程；每個 MCP 工具的參考說明請見文件。"
      >
        <h2>1. 建立計畫</h2>
        <p>一共有三個層級，註冊之後，前兩個就已經建好了：</p>
        <pre>{`工作區         成員、角色，以及 AI 代理連線用的金鑰
  └─ 專案      你正在打造的一樣東西
       └─ 計畫 一張圖`}</pre>
        <p>
          打開你的工作區，選一個專案（一開始就會有一個 <strong>General</strong>
          ），然後按下<strong>新增計畫</strong>
          。計畫是一張圖，不是一份文件：你要做的是加入各個部分、說明它們之間的關係，而不是從頭寫到尾。
        </p>

        <h2>2. 畫出來</h2>
        <p>
          <strong>新增節點</strong>
          會在你目前檢視的位置放上一個節點。點一下節點，右側的面板就會開啟：為它設定標題、類型、狀態，以及任意多的詳細說明。匯出時，詳細說明會成為該節點
          Markdown 檔案的內文，所以值得好好寫。
        </p>
        <p>
          五種類型各有不同的意義，看節點的外框就能分辨：<strong>功能</strong>和<strong>任務</strong>
          是實線，<strong>決策</strong>有一個切角，<strong>備註</strong>是虛線，
          <strong>群組</strong>則畫成一道邊界，圍住它所包含的一切。
        </p>
        <p>
          標題欄裡的四個按鈕決定你接下來畫的那條連接代表什麼。每個按鈕顯示的都是那種線本身，而不是用圖示來代替：
        </p>
        <ul>
          <li>
            <strong>流向</strong>
            ：照著系統實際運作的方向拖曳，例如這個畫面呼叫那個端點，那個端點讀取那張資料表。說明是什麼觸發了這次交接、傳遞的又是什麼，兩者都會寫在線上。回應就是另一條指回來的流向。能畫出一個系統、而不只是一份清單的，就是這一種。
          </li>
          <li>
            <strong>包含</strong>
            ：從容器拖曳到放在裡面的東西。匯出時，它會變成目錄；拖曳群組時，裡面的所有東西都會跟著移動。
          </li>
          <li>
            <strong>依賴</strong>
            ：哪些東西必須先存在，這和誰呼叫誰並不相同。匯出時，它決定檔案的編號順序。
          </li>
          <li>
            <strong>關聯</strong>：單純的關聯，不帶任何結構。
          </li>
        </ul>
        <p>點一下連接，就可以改變它的意義、說明它傳遞的內容，或把它刪除。</p>
        <p>
          <strong>自動排列</strong>
          會替你把整張圖排好。它不會移動任何你親手拖曳過的東西：你擺放過的節點從此就被固定，只有你再次移動它，才能解除固定。
        </p>

        <h2>3. 連接 AI 代理</h2>
        <p>
          在帳號設定中開啟 <strong>AI 代理</strong>，建立一把金鑰，然後把 URL 和金鑰貼到你的 MCP
          用戶端。你的電腦上不會安裝任何東西，伺服器是透過 HTTP 連線的。
          <Link href={localePath('zh-TW', '/docs')}>文件</Link>
          中有確切的設定區塊和完整的工具清單。
        </p>
        <p>
          金鑰在你身為成員的每個地方都代表你本人，所以無論你有多少個工作區，一把金鑰就夠了。一把金鑰只交給一個用戶端，用那個用戶端的名字替它命名，機器換人使用時就撤銷它。
        </p>

        <h2>4. 讓 AI 代理來畫</h2>
        <p>
          請你的 AI 代理照平常的方式寫出計畫，再把它放到畫布上。它有兩個入口。要一次放上整份計畫，用{' '}
          <code>create_plan</code>：
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          之後的一切都用 <code>apply_ops</code>
          ：一次批次、原子化的呼叫，結果會同時出現在每一個開啟中的畫布上：
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          請注意這裡少了什麼：座標。AI
          代理只宣告結構，由伺服器執行自動版面配置，因為要語言模型給出位置，只會得到一張沒人想看的圖，還白白耗掉你的上下文。也請注意，節點是以識別碼來指定的，所以同一個呼叫送出兩次，第二次不會改變任何東西。
        </p>
        <p>
          有件事值得向你的 AI 代理要求：用你認得出來的識別碼。<code>pricing-rules</code>{' '}
          是你在下一則訊息裡可以直接提到的名字，<code>node-7</code> 就不是。
        </p>

        <h2>5. 帶走檔案</h2>
        <p>
          <strong>匯出</strong>
          會下載一個 zip
          檔。包含關係變成目錄，依賴順序變成每個檔名上的編號，而且每個節點都帶有自己的
          frontmatter，所以這個檔案包完整描述了整張圖，而不只是它的一張圖片。
        </p>
        <pre>{EXPORT_TREE}</pre>
        <p>
          把這個資料夾放進 Obsidian 的儲存庫（vault），<code>plan.canvas</code>{' '}
          就會以同樣的圖開啟。或者把它和原始碼一起提交，你的 AI
          代理每次執行時都會讀取它，而這正是整件事的目的。
        </p>
        <p>
          依賴循環不會阻擋匯出。循環會以固定的方式被打斷，並記錄在 README
          中，所以同一份計畫每次匯出的檔案都相同。
        </p>

        <h2>6. 與他人協作</h2>
        <p>
          編輯是即時的。兩個人在同一份計畫上，會即時看到彼此的變更；兩個人同時在同一個節點的詳細說明裡打字，內容會合併，而不是互相覆蓋。透過
          MCP 寫入的 AI 代理，也只是另一位參與者。
        </p>
        <p>
          <strong>分享</strong>
          會產生一個連結，任何人不需要帳號就能開啟、閱讀，並從中匯出。停止分享後，連結就會失效。
        </p>
        <p>
          工作區裡的<strong>成員</strong>
          會列出有哪些人，讓你變更角色（擁有者、管理員、編輯者、檢視者），並產生邀請連結。目前還沒有電子郵件功能，所以請自己把連結傳出去。
        </p>

        <h2>7. 自行架設</h2>
        <p>
          整套系統採用 AGPL-3.0 授權，只需要 Node 和 Postgres，別無其他。把
          <Link href="https://github.com/ridanit-ruma/schematic-planner">儲存庫</Link> clone
          下來，複製一份 <code>.env.example</code>，啟動
          Postgres，套用資料庫遷移（migration），然後執行。確切的指令都寫在 README 裡。
        </p>
        <p>
          所有設定都透過環境變數完成，而且網頁應用程式是在執行時期、而不是在建置時讀取伺服器位址，所以同一份建置好的套件可以在每一種環境中執行。
        </p>

        <h2>還沒做好的部分</h2>
        <p>
          坦白說明，因為你一定會碰到：系統從不寄送電子郵件，所以邀請是由你轉交的連結，電子郵件地址也無法變更。登入只支援電子郵件和密碼。畫布沒有復原功能，大型計畫無法搜尋，也沒有版本紀錄。
        </p>
        <p>
          如果其中哪一項妨礙到你，請到 <Link href={ISSUES}>GitHub Issues</Link>{' '}
          提出，這會影響接下來先做什麼。
        </p>
      </Prose>
    </>
  );
}
