import Link from 'next/link';

import { Band, Step } from '@/components/Sections';
import type { PageMeta } from '@/content/types';

import { HeroSchematic } from '@/components/HeroSchematic';
import { appUrl } from '@/lib/app-url';
import { REPO_URL } from '@/lib/links';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: 'Schematic Planner — 계획은 브라우저에서, 결과물은 내 손에',
  description:
    '글로 쓴 계획을 나와 AI 에이전트가 함께 편집하는 그래프로 바꾸고, Markdown 파일과 Obsidian Canvas로 내보냅니다. 오픈 소스이며 직접 호스팅할 수 있습니다.',
};

const AGENT_CALL = `create_plan({
  title: "Billing rework",
  nodes: [
    { slug: "ledger-schema", title: "Ledger schema" },
    { slug: "pricing-rules", title: "Pricing rules" },
    { slug: "render-pdf",    title: "Render PDF" }
  ],
  edges: [
    { from: "pricing-rules", to: "ledger-schema" },
    { from: "render-pdf",    to: "pricing-rules" }
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
              코드를 쓰기 전에, 계획의 형태부터.
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-ink-muted">
              Schematic Planner는 글로 쓴 계획을 나와 AI 에이전트가 함께 편집하는 그래프로 바꾼
              다음, 계속 간직할 수 있는 Markdown 파일과 Obsidian Canvas로 돌려줍니다.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={appUrl()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
              >
                플랜 만들기
              </a>
              <Link
                href={localePath('ko', '/guide')}
                className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
              >
                가이드 읽기
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-rule bg-surface-2 p-3">
            <HeroSchematic />
          </div>
        </div>
      </section>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">해결하려는 문제</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          코딩 에이전트는 계획을 잘 씁니다. 못하는 것은 그 계획을 붙잡아 두는 일입니다. 기능을 하나
          부탁하면 그럴듯한 작업 목록이 나오지만, 메시지 세 개만 지나도 절반은 잊히고, 다음
          실행에서는 아키텍처가 슬그머니 새로 만들어집니다. 계획은 처음부터 어디에도 없었습니다.
          대화 속에 있었고, 대화는 이미 흘러가 버렸습니다.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          나와 에이전트가 함께 볼 수 있는 곳에 계획을 두면, 이런 일은 더 이상 생기지 않습니다.
        </p>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">진행 방식</h2>
        <ol className="mt-6 space-y-6">
          <Step
            title="에이전트가 계획을 씁니다"
            body="줄글이든, 작업 목록이든, 설계 메모든 원하는 방식대로 씁니다. 이 부분은 이미 잘
              됩니다."
          />
          <Step
            title="호출 한 번으로 그림이 됩니다"
            body="에이전트는 구조를 보내고, 노드는 서버가 모두 배치합니다. 에이전트는 무엇이 무엇에
              의존하는지만 선언하고 좌표는 절대 정하지 않습니다. 모델에게 위치를 정하게 하면 아무도
              읽고 싶지 않은 다이어그램이 나오기 때문입니다."
          />
          <Step
            title="옮기고 싶은 것은 직접 옮깁니다"
            body="직접 끌어다 놓은 노드는 고정되고, 그때부터 자동 배치는 그 노드를 건드리지
              않습니다. 나머지 노드는 그 주변에 맞춰 다시 배치됩니다."
          />
          <Step
            title="파일은 그대로 가져갑니다"
            body="포함 관계는 디렉터리가 되고, 의존 순서는 파일 이름 앞의 번호가 됩니다. 이 폴더를
              소스 코드 옆에 커밋해 두면 에이전트가 실행할 때마다 읽습니다."
          />
        </ol>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">에이전트가 보는 것</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              URL 하나와 키 하나로 도구 열한 개를 쓸 수 있습니다. 설치할 것도, 서버와 버전을 맞춰 둘
              것도 없습니다. 플랜 전체가 호출 한 번으로 들어오고, 그 뒤의 모든 변경은 여러 변경을
              묶어 원자적으로 처리하는 단 하나의 통로를 거칩니다. 그래서 노드 마흔 개가 하나씩
              느릿느릿 기어 나오는 대신 캔버스에 한꺼번에 나타납니다.
            </p>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              노드는 사람이 알아볼 수 있는 식별자로 가리키므로, 같은 요청을 다시 보내도 두 번째에는
              아무것도 바뀌지 않습니다.
            </p>
            <Link
              href={localePath('ko', '/docs')}
              className="mt-4 inline-block text-sm text-accent underline"
            >
              도구 레퍼런스
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
            <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">내보내면 나오는 것</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-[1.65] text-ink-muted">
              그래프를 frontmatter에 담은 평범한 Markdown 파일들을 묶은 zip, 그리고 Obsidian에서
              배치 그대로 열리는 <code className="slug">.canvas</code> 파일입니다. 이 형식을 읽는 데
              이 서비스는 전혀 필요 없고, 같은 플랜은 언제 내보내도 바이트 하나 다르지 않은 결과가
              나옵니다.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {EXPORT_TREE}
          </pre>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">직접 호스팅하기</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          전체 스택이 AGPL-3.0이고, Node와 Postgres만 있으면 됩니다. 독점 인증 서비스도,
          관리형으로만 제공되는 의존성도 없으며, 모든 설정은 환경 변수로 합니다. 소스 코드가 내
          네트워크 밖으로 나갈 수 없다면, 플랜도 마찬가지로 그 안에 머뭅니다.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={REPO_URL}
            className="rounded-md border border-rule bg-surface-2 px-4 py-2 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-surface-3"
          >
            소스 코드 보기
          </a>
          <Link href={localePath('ko', '/guide')} className="text-sm text-accent underline">
            또는 가이드부터 보기
          </Link>
        </div>
      </Band>

      <Band>
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">지금 어디까지 왔는지</h2>
        <p className="mt-3 max-w-[62ch] text-base leading-[1.65] text-ink-muted">
          프리알파 단계이며, 이 점은 분명히 말해 두겠습니다. 계획 세우기, 그리기, 실시간 공동 편집,
          에이전트 연동, 공유, 내보내기, 워크스페이스와 계정 관리는 모두 동작합니다. 이메일은 한
          통도 보내지 않으므로 초대는 직접 전달하는 링크이고, 소셜 로그인은 아직 없습니다. 플랜은
          내보내 두세요. 내보내기는 바로 그러라고 있는 기능입니다.
        </p>
      </Band>
    </>
  );
}
