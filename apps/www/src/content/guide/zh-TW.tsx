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
        <p>計畫是這樣歸檔的，註冊之後，前兩層就已經建好了：</p>
        <pre>{`工作區             成員、角色，以及 AI 代理連線用的金鑰
  └─ 專案          你正在打造的一樣東西，以及其中計畫所用的詞彙
       └─ 資料夾   可有可無，資料夾裡還能再放資料夾
            └─ 計畫  一張圖`}</pre>
        <p>
          整個應用程式就是一個畫面。左側的側邊欄裡有<strong>最近</strong>
          ，下面是工作區裡的所有專案，以及它們的資料夾和計畫。點一下專案或資料夾就能展開或收合，點一下計畫就會在右側開啟。設定、成員和垃圾桶也在右側開啟，側邊欄一直留在旁邊。拖曳側邊欄的邊緣可以把它拉寬。
        </p>
        <p>
          把指標移到專案或資料夾上，那一列會出現<strong>新增計畫</strong>和
          <strong>新增資料夾</strong>
          兩個圖示，用來在其中新增。樹狀清單底部的圖示可以新增計畫、資料夾或
          <strong>新增專案</strong>
          。名稱直接在樹狀清單裡輸入。把計畫或資料夾拖曳到另一個資料夾上，就會歸檔進去；透過每一列的選單或按右鍵，可以重新命名、移動、分享、匯出，或移到垃圾桶。
        </p>
        <p>
          一開始就會有一個 <strong>General</strong>{' '}
          專案。計畫是一張圖，不是一份文件：你要做的是加入各個部分、說明它們之間的關係，而不是從頭寫到尾。
        </p>

        <h2>2. 畫出來</h2>
        <p>
          新增節點最快的方法，是從另一個節點開始。從節點右側的端點拖曳出去，在畫布的空白處放開：放開的位置會出現一個已經連好的新節點，可以直接輸入標題。按{' '}
          <strong>Enter</strong> 保留，按 <strong>Escape</strong>{' '}
          取消。在群組裡放開，新節點就會加入那個群組。在空白的計畫裡，可以用標題欄的
          <strong>新增節點</strong>，或在畫布上按右鍵選擇<strong>在此新增節點</strong>
          ，以同樣的方式新增。在標題上按兩下，就能直接在卡片上重新命名。
        </p>
        <p>
          點一下節點，右側的面板就會開啟：設定它的類型、狀態和標籤，並寫下任意多的詳細內容。匯出時，詳細內容會成為該節點
          Markdown 檔案的內文，所以值得好好寫。
        </p>
        <p>
          新畫的連接一律從流向開始。點一下連接，選擇它的<strong>意義</strong>：
        </p>
        <ul>
          <li>
            <strong>流向</strong>
            ：系統實際運作的方向，例如這個畫面呼叫那個端點，那個端點讀取那張資料表。說明是什麼觸發了這次交接、傳遞的又是什麼，兩者都會寫在線上。回應就是另一條指回來的流向。能畫出一個系統、而不只是一份清單的，就是這一種。
          </li>
          <li>
            <strong>包含</strong>
            ：從容器指向放在裡面的東西。匯出時，它會變成目錄；拖曳群組時，裡面的所有東西都會跟著移動。
          </li>
          <li>
            <strong>依賴</strong>
            ：哪些東西必須先存在，這和誰呼叫誰並不相同。匯出時，它決定檔案的編號順序。
          </li>
          <li>
            <strong>關聯</strong>：單純的關聯，不帶任何結構。
          </li>
        </ul>
        <p>在同一個面板裡，可以說明是什麼觸發了這條連接、它傳遞什麼，或把它刪除。</p>
        <p>
          <strong>自動排列</strong>
          會替你把整張圖排好。它不會移動任何你親手拖曳過的東西：你擺放過的節點從此就被固定，只有你再次移動它，才能解除固定。
        </p>

        <h2>3. 操作畫布</h2>
        <p>畫布的操作方式和繪圖工具一樣：</p>
        <ul>
          <li>
            <strong>在畫布空白處拖曳</strong>會畫出一個選取框，碰到的節點都會被選取；按住 Shift
            拖曳則加入目前的選取。按住 Shift、Ctrl 或 ⌘ 點一下，可以把單一節點加入或移出選取。
          </li>
          <li>
            <strong>平移</strong>可以用滑鼠中鍵拖曳、按住空白鍵拖曳，或捲動滾輪；Shift
            加滾輪則橫向移動。<strong>縮放</strong>用 Ctrl 或 ⌘ 加滾輪，或是雙指縮放。
          </li>
          <li>
            <strong>拖曳選取的內容</strong>會整批移動，按 Backspace 或 Delete 刪除。
          </li>
          <li>
            <strong>按住 Alt/⌥ 拖曳</strong>會把原本的節點留在原處，在放開的位置放下副本。
          </li>
          <li>
            <strong>Ctrl/⌘ + C、X、V</strong>{' '}
            分別是複製、剪下和貼上——貼在指標所在的位置，也能貼到另一份計畫或另一個分頁裡。
            <strong>Ctrl/⌘ + D</strong> 在原地建立副本。
          </li>
        </ul>
        <p>
          拖曳時，畫布也會對齊間距：把節點移到與相鄰節點的距離剛好等於另外兩個節點間距的位置，它就會吸附過去，相同的間距會以粉紅色的標示顯示。選取一排或一列間距相等的節點，每個間距上都會出現一個控點，拖曳其中一個就能同時調整所有間距。如果間距不平均，請先按右鍵選擇
          <strong>整理間距</strong>。
        </p>

        <h2>4. 撰寫詳細內容</h2>
        <p>
          節點的詳細內容是一個區塊編輯器。輸入 <code>#</code> 和空格就是標題（<code>##</code>、
          <code>###</code> 是較小的標題），<code>-</code> 是清單，<code>1.</code> 是編號清單，
          <code>[]</code> 是待辦事項，<code>&gt;</code> 是引言，三個反引號是程式碼，<code>---</code>{' '}
          是分隔線。輸入 <code>/</code> 會開啟所有區塊的選單，其中也有<strong>表格</strong>、
          <strong>摺疊區塊</strong>和<strong>提示框</strong>
          （備註、提示、注意、危險）。拖曳區塊旁的控點，可以把它移到別處。
        </p>
        <p>
          多個人可以同時在同一份詳細內容裡寫作，並看到彼此的游標；AI
          代理寫入的內容也會以同樣的方式合併。畫布上的卡片會顯示同樣的內容，連標題也一樣，待辦事項可以直接在卡片上勾選。
        </p>
        <p>
          在編輯器之外，無論是匯出還是 AI 代理，讀到的詳細內容都是 Markdown。表格是 Markdown
          表格，摺疊區塊是 <code>&lt;details&gt;</code> 區塊，提示框是 Obsidian 的
          callout，所以放進儲存庫後依然是原本的樣子。
        </p>

        <h2>5. 專案的詞彙</h2>
        <p>
          類型和狀態屬於專案，所以同一個專案裡的所有計畫都使用同一套詞彙。新專案一開始就有這些狀態：
          <strong>構想</strong>、<strong>已規劃</strong>、<strong>進行中</strong>、
          <strong>受阻</strong>、<strong>已完成</strong>、<strong>已放棄</strong>；以及這些類型：
          <strong>功能</strong>、<strong>任務</strong>、<strong>決策</strong>、<strong>備註</strong>
          、<strong>群組</strong>
          。狀態選單中每個狀態都會顯示自己的顏色，類型選單中每個類型都會顯示自己的外框；兩者的最後一項都是
          <strong>編輯…</strong>，點下去會開啟<strong>專案設定</strong>中的
          <strong>狀態、類型與標籤</strong>。
        </p>
        <p>
          在那裡可以新增、重新命名、變更顏色和調整順序。每個狀態都屬於一個分類——待辦、進行中、受阻、已完成或已取消——分類決定它的作用：要向
          AI
          代理建議下一步做什麼、哪些流向畫成紅色、哪些算進進度。每個類型都有自己的外框，也決定是否算作工作。刪除狀態或類型會將它封存：它會從選單中消失，但正在使用它的節點會一直保留，直到有人變更為止。群組是內建的，無法刪除。
        </p>
        <p>
          標籤的用法就像下拉選單。輸入文字會篩選專案的標籤，按 Enter
          選取反白的那一個；如果沒有相符的，就新增一個有自己顏色的標籤。輸入框是空的時候按
          Backspace，會移除最後一個標籤。標籤本身的選單可以變更顏色，或把它從專案中刪除，節點上仍會保留這個名稱。
        </p>

        <h2>6. 連接 AI 代理</h2>
        <p>
          在帳號設定中開啟 <strong>AI 代理</strong>，建立一把金鑰，然後把 URL 和金鑰貼到你的 MCP
          用戶端。你的電腦上不會安裝任何東西，伺服器是透過 HTTP 連線的。
          <Link href={localePath('zh-TW', '/docs')}>文件</Link>
          中有確切的設定區塊和完整的工具清單。
        </p>
        <p>
          金鑰在你身為成員的每個地方都代表你本人，所以無論你有多少個工作區，一把金鑰就夠了。一把金鑰只交給一個用戶端，用那個用戶端的名字替它命名，機器換人使用時就撤銷它。
        </p>

        <h2>7. 讓 AI 代理來畫</h2>
        <p>
          請你的 AI 代理照平常的方式寫出計畫，再把它放到畫布上。它用 <code>create_plan</code>{' '}
          開啟一份計畫；如果想要，可以給出路徑，直接歸檔到某個資料夾裡：
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          接著用 <code>apply_ops</code>{' '}
          來畫：一次批次、原子化的呼叫，結果會同時出現在每一個開啟中的畫布上。之後的每一項變更也都用這個呼叫：
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          請注意這裡少了什麼：座標。AI
          代理只宣告結構，由伺服器執行自動版面配置，因為要語言模型給出位置，只會得到一張沒人想看的圖，還白白耗掉你的上下文。也請注意，節點是以識別碼來指定的，所以同一個呼叫送出兩次，第二次不會改變任何東西。
        </p>
        <p>
          AI
          代理用的也是專案的詞彙。讀取計畫時，它會知道有哪些類型和狀態；使用專案裡沒有的值會被拒絕，並附上現有值的清單——所以
          AI 代理沒辦法偷偷自創一個狀態。
        </p>
        <p>
          有件事值得向你的 AI 代理要求：用你認得出來的識別碼。<code>pricing-rules</code>{' '}
          是你在下一則訊息裡可以直接提到的名字，<code>node-7</code> 就不是。
        </p>

        <h2>8. 帶走檔案</h2>
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

        <h2>9. 與他人協作</h2>
        <p>
          編輯是即時的。兩個人在同一份計畫上，會即時看到彼此的變更；兩個人同時在同一個節點的詳細內容裡打字，內容會合併，而不是互相覆蓋。透過
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

        <h2>10. 自行架設</h2>
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
          坦白說明，因為你一定會碰到：系統從不寄送電子郵件，所以邀請是由你轉交的連結，電子郵件地址也無法變更。登入只支援電子郵件和密碼。應用程式裡沒有搜尋框；歷史紀錄會列出每一項變更，但還不能還原到先前的版本。
        </p>
        <p>
          如果其中哪一項妨礙到你，請到 <Link href={ISSUES}>GitHub Issues</Link>{' '}
          提出，這會影響接下來先做什麼。
        </p>
      </Prose>
    </>
  );
}
