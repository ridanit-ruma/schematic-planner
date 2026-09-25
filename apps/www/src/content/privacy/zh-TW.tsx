import type { PageMeta } from '@/content/types';
import Link from 'next/link';

import { Prose } from '@/components/Prose';

export const meta: PageMeta = {
  title: '隱私權政策',
  description: 'Schematic Planner 託管服務會儲存哪些資料，以及不會儲存哪些資料。',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

export default function Privacy() {
  return (
    <>
      <Prose
        title="隱私權政策"
        updated="最後更新：2026年9月6日"
        notice="本頁為方便閱讀而提供的中文翻譯。中文版本與英文版本如有任何不一致，以英文版本為準。"
        lede="本政策說明由 ruma 營運的託管服務。如果你使用的是別人的執行個體，你的資料由對方持有，適用的也是對方的政策：程式碼相同，營運者卻不同。"
      >
        <h2>儲存哪些資料</h2>
        <ul>
          <li>
            <strong>你的帳號：</strong>
            電子郵件地址、顯示名稱，以及密碼的雜湊值。密碼本身從不儲存：它以 Argon2
            進行雜湊，無法從雜湊值還原出原始密碼。
          </li>
          <li>
            <strong>你的計畫：</strong>
            你所寫的一切，包括標題、節點文字、標籤、結構和節點位置。每份計畫都保存兩份：一份是讓即時編輯得以運作的即時協作文件，另一份是它的快照，供列表和匯出讀取。
          </li>
          <li>
            <strong>工作階段：</strong>
            每個登入權杖的雜湊值、它的到期時間，以及請求送達時附帶的瀏覽器識別字串。
          </li>
          <li>
            <strong>API 金鑰：</strong>
            金鑰的雜湊值、金鑰的前幾個字元（讓你能分辨自己的各把金鑰）、你為它取的名稱，以及它最後一次被使用的時間。
          </li>
          <li>
            <strong>分享連結：</strong>連結的權杖，以及它的到期時間（如果你有設定的話）。
          </li>
        </ul>

        <h2>不儲存哪些資料</h2>
        <p>
          沒有任何分析工具、沒有廣告，也沒有任何形式的第三方追蹤器。你的計畫從不會被用來訓練模型。不會出售任何東西。
        </p>
        <p>
          確實會發生一個對外請求：頁面會從 Google Fonts 載入字型，這表示 Google
          會看到你的瀏覽器連線時所用的位址。自行託管這個字型已列入待辦事項。
        </p>

        <h2>Cookie 與瀏覽器儲存空間</h2>
        <p>
          只有一個 Cookie（<code>sp_refresh</code>）用來保存你的工作階段。它設為
          httpOnly，因此頁面腳本無法讀取，而且它是本服務設定的唯一一個
          Cookie。你偏好的淺色或深色模式保存在瀏覽器的本機儲存空間中，從不離開你的電腦。
        </p>

        <h2>誰能看到你的計畫</h2>
        <ul>
          <li>工作區中的成員，範圍受其被指派的角色所限。</li>
          <li>持有你所建立之分享連結的任何人：僅能閱讀，且僅限於你停止分享之前。</li>
          <li>持有該工作區 API 金鑰的任何 AI 代理。</li>
          <li>執行個體的營運者，因為他們必然能存取其資料庫。在託管服務上，營運者就是 ruma。</li>
        </ul>

        <h2>連接 AI 代理</h2>
        <p>
          當你透過 MCP 連接 AI 代理時，該 AI
          代理所讀取的任何內容，都會傳給執行它的一方：依用戶端不同，可能是 Anthropic、OpenAI
          或你自己的電腦。這是你和他們之間的關係，由他們的政策規範。只有在你能接受某個 AI
          代理的提供者讀取某個工作區中的計畫時，才將該 AI 代理連接到那個工作區。
        </p>

        <h2>保存與刪除</h2>
        <p>
          資料會保存到被刪除為止。刪除計畫會同時移除該計畫及其協作文件。撤銷 API
          金鑰會讓它立即失效。自助刪除帳號的功能尚未建置；請在{' '}
          <Link href={ISSUES}>GitHub Issues</Link> 上提出要求，帳號及其中的所有內容都會被移除。
        </p>

        <h2>在哪裡執行</h2>
        <p>
          託管的執行個體運行在 ruma
          營運的基礎設施上。自行架設的執行個體則運行在其營運者選擇的任何地方，其中沒有任何東西會回報到這裡。
        </p>

        <h2>聯絡方式</h2>
        <p>
          問題和要求請提交至 <Link href={ISSUES}>GitHub Issues</Link>。
        </p>
      </Prose>
    </>
  );
}
