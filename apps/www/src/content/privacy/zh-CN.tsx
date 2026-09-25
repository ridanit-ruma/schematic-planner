import type { PageMeta } from '@/content/types';
import Link from 'next/link';

import { Prose } from '@/components/Prose';

export const meta: PageMeta = {
  title: '隐私',
  description: '托管版 Schematic Planner 服务存储哪些数据，以及不存储哪些数据。',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

export default function Privacy() {
  return (
    <>
      <Prose
        title="隐私"
        updated="最后更新：2026年9月6日"
        notice="本页为方便阅读而提供的译文。如本译文与英文版本有任何不一致，以英文版本为准。"
        lede="本说明适用于由 ruma 运营的托管服务。如果你使用的是其他人的实例，你的数据由对方持有，适用的是对方的政策：代码是一样的，运营方却不是。"
      >
        <h2>存储哪些数据</h2>
        <ul>
          <li>
            <strong>你的账号：</strong>
            邮箱地址、显示名称，以及你密码的哈希值。密码本身从不存储：它经过 Argon2
            哈希处理，无法从哈希值还原出原始密码。
          </li>
          <li>
            <strong>你的计划：</strong>
            你写下的一切。标题、节点文字、标签、结构以及节点位置。每份计划保存两份：一份是支撑实时编辑的在线协作文档，另一份是它的快照，供列表和导出读取。
          </li>
          <li>
            <strong>会话：</strong>
            每个登录令牌的哈希值、它的过期时间，以及请求到达时附带的浏览器标识字符串。
          </li>
          <li>
            <strong>API 密钥：</strong>
            密钥的哈希值、用于让你区分各个密钥的开头几个字符、你为它起的名字，以及它最后一次被使用的时间。
          </li>
          <li>
            <strong>分享链接：</strong>链接的令牌，以及你设置的过期时间（如有）。
          </li>
        </ul>

        <h2>不存储哪些数据</h2>
        <p>
          没有任何分析统计，没有广告，也没有任何形式的第三方跟踪器。你的计划从不用于训练模型。不出售任何东西。
        </p>
        <p>
          确实会发生一个外部请求：页面会从 Google Fonts 加载一款字体，这意味着 Google
          能看到你的浏览器连接时所用的地址。自托管这款字体已列入计划。
        </p>

        <h2>Cookie 与浏览器存储</h2>
        <p>
          只有一个 Cookie，即 <code>sp_refresh</code>，用于保存你的会话。它设置了
          httpOnly，页面脚本无法读取，也是本服务设置的唯一一个
          Cookie。你对浅色或深色模式的偏好保存在浏览器的本地存储中，从不离开你的机器。
        </p>

        <h2>谁能看到你的计划</h2>
        <ul>
          <li>工作区中的成员，受其被授予的角色限制。</li>
          <li>持有你创建的分享链接的任何人：只读，直到你停止分享为止。</li>
          <li>持有该工作区 API 密钥的任何智能体。</li>
          <li>实例的运营方，其必然能够访问实例的数据库。在托管服务上，运营方是 ruma。</li>
        </ul>

        <h2>连接 AI 智能体</h2>
        <p>
          当你通过 MCP
          连接智能体时，该智能体读取的任何内容都会发送给运行它的一方：视客户端而定，可能是
          Anthropic、OpenAI，或者你自己的机器。这层关系存在于你和对方之间，受对方的政策约束。只有当你能接受某个智能体的提供方读取某个工作区中的计划时，才把该智能体连接到那个工作区。
        </p>

        <h2>保留与删除</h2>
        <p>
          数据会一直保留，直到被删除。删除一份计划会同时移除它及其协作文档。撤销一个 API
          密钥后，它会立即失效。自助删除账号的功能尚未实现；请在{' '}
          <Link href={ISSUES}>GitHub Issues</Link> 上提出，账号及其中的全部内容将被移除。
        </p>

        <h2>运行在哪里</h2>
        <p>
          托管实例运行在 ruma
          运营的基础设施上。自托管实例运行在其运营方部署的任何地方，其中没有任何东西会向这里回传信息。
        </p>

        <h2>联系方式</h2>
        <p>
          问题和请求请提交至 <Link href={ISSUES}>GitHub Issues</Link>。
        </p>
      </Prose>
    </>
  );
}
