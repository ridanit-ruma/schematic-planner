import type { PageMeta } from '@/content/types';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: '가이드',
  description:
    '플랜을 만들어 캔버스에 그린 뒤, AI 에이전트를 연결하고, Markdown 파일과 Canvas 파일로 가져가는 방법을 안내합니다.',
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
├── README.md                 개요와 목차
├── 01-foundation/            다른 노드를 포함하는 노드는 디렉터리가 됨
│   ├── README.md             …그 노드 자신의 내용은 여기에
│   ├── 01-ledger-schema.md
│   └── 02-pricing-rules.md   의존 관계에 따라 번호가 붙음
├── 02-invoicing/
│   └── 01-render-pdf.md
├── plan.canvas               Obsidian에서 배치 그대로 열림
└── plan.json                 같은 내용을 기계가 읽는 형식으로`;

export default function Guide() {
  return (
    <>
      <Prose
        title="가이드"
        lede="플랜을 만들어 캔버스에 그린 뒤 에이전트에게 넘기고, 파일로 가져가기까지. 이
          가이드는 그 과정을 처음부터 끝까지 따라갑니다. MCP 도구별 레퍼런스는 문서에 있습니다."
      >
        <h2>1. 플랜 만들기</h2>
        <p>구조는 세 단계이며, 가입하고 나면 앞의 두 단계는 이미 준비되어 있습니다.</p>
        <pre>{`워크스페이스    사람, 역할, 에이전트가 접속할 때 쓰는 키
  └─ 프로젝트   만들고 있는 것 하나
       └─ 플랜  그래프 하나`}</pre>
        <p>
          워크스페이스를 열고 프로젝트를 고른 다음(처음부터 <strong>General</strong> 프로젝트가 하나
          있습니다) <strong>새 플랜</strong>을 누르세요. 플랜은 문서가 아니라 그래프입니다. 위에서
          아래로 써 내려가는 대신, 항목을 추가하고 서로 어떤 관계인지 밝혀 나가게 됩니다.
        </p>

        <h2>2. 그리기</h2>
        <p>
          <strong>노드 추가</strong>를 누르면 지금 보고 있는 자리에 노드가 생깁니다. 노드를 클릭하면
          오른쪽에 패널이 열리는데, 여기서 제목, 종류, 상태를 정하고 세부 내용을 원하는 만큼
          적습니다. 세부 내용은 내보낼 때 그 노드의 Markdown 파일 본문이 되므로, 제대로 써 둘
          만합니다.
        </p>
        <p>
          종류는 다섯 가지로 저마다 뜻이 다르며, 노드의 테두리를 보면 어떤 종류인지 알 수 있습니다.{' '}
          <strong>기능</strong>과 <strong>작업</strong>은 실선이고, <strong>결정</strong>은 모서리
          하나가 잘려 있고, <strong>메모</strong>는 점선이며, <strong>그룹</strong>은 안에 담은
          것들을 둘러싼 경계로 그려집니다.
        </p>
        <p>
          타이틀 블록의 버튼 네 개는 다음에 그을 연결이 무슨 뜻인지 정합니다. 버튼마다 그 뜻을
          대신하는 아이콘이 아니라 실제로 그려질 선의 모양이 들어 있습니다.
        </p>
        <ul>
          <li>
            <strong>흐름</strong> — 시스템이 실제로 움직이는 방향으로 끌어 줍니다. 이 화면이 저
            엔드포인트를 호출하고, 그 엔드포인트가 저 테이블을 읽는 식입니다. 무엇이 이 전달을
            일으키는지, 무엇을 싣고 가는지 적으면 둘 다 선 위에 표시됩니다. 응답은 반대 방향을
            가리키는 흐름을 하나 더 그리면 됩니다. 목록이 아니라 시스템을 그리게 해 주는 것이 바로
            이 연결입니다.
          </li>
          <li>
            <strong>포함</strong> — 감싸는 쪽에서 안에 들어갈 쪽으로 끌어 줍니다. 내보낼 때
            디렉터리가 되는 것이 이 연결이며, 그룹을 끌면 안에 든 것이 모두 함께 움직입니다.
          </li>
          <li>
            <strong>의존</strong> — 무엇이 먼저 있어야 하는지를 나타냅니다. 무엇이 무엇을
            호출하는지와는 다른 이야기입니다. 내보낼 때 파일에 번호를 매기는 순서가 됩니다.
          </li>
          <li>
            <strong>관련</strong> — 구조를 담지 않는 단순한 연관입니다.
          </li>
        </ul>
        <p>선을 클릭하면 뜻을 바꾸거나, 무엇을 싣고 가는지 적거나, 선을 지울 수 있습니다.</p>
        <p>
          <strong>자동 배치</strong>를 누르면 그래프를 알아서 배치해 줍니다. 손으로 끌어다 놓은 것은
          움직이지 않습니다. 직접 놓은 노드는 그때부터 고정되며, 직접 다시 옮기지 않는 한 고정은
          풀리지 않습니다.
        </p>

        <h2>3. 에이전트 연결하기</h2>
        <p>
          계정 설정에서 <strong>에이전트</strong>를 열고 키를 만든 다음, URL과 키를 MCP 클라이언트에
          붙여 넣으세요. 컴퓨터에 따로 설치하는 것은 없고, 서버에는 HTTP로 접속합니다. 정확한 설정
          블록과 전체 도구 목록은 <Link href={localePath('ko', '/docs')}>문서</Link>에 있습니다.
        </p>
        <p>
          키는 내가 멤버로 있는 모든 곳에서 나로서 동작하므로, 워크스페이스가 몇 개든 키 하나면
          충분합니다. 키는 클라이언트 하나에만 주고, 그 클라이언트의 이름을 붙여 두고, 그 컴퓨터를
          다른 사람에게 넘길 때는 폐기하세요.
        </p>

        <h2>4. 에이전트에게 그리게 하기</h2>
        <p>
          에이전트에게 평소처럼 계획을 쓰게 한 다음, 그 계획을 캔버스에 올려 달라고 하세요. 방법은
          두 가지입니다. 플랜 전체를 한 번에 올릴 때는 <code>create_plan</code> 도구를 씁니다.
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          그 이후의 모든 변경은 <code>apply_ops</code> 도구로 합니다. 여러 변경을 묶어 원자적으로
          처리하는 호출 한 번이며, 결과는 열려 있는 모든 캔버스에 동시에 나타납니다.
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          여기에 빠진 것이 있습니다. 바로 좌표입니다. 에이전트는 구조만 선언하고 배치는 서버가
          합니다. 언어 모델에게 위치를 정하게 하면 아무도 읽고 싶지 않은 다이어그램이 나오고,
          그러느라 컨텍스트까지 소모하기 때문입니다. 또 노드는 식별자로 가리키므로, 같은 호출을 두
          번 보내도 두 번째에는 아무것도 바뀌지 않습니다.
        </p>
        <p>
          에이전트에게 한 가지 부탁해 둘 만한 것이 있습니다. 사람이 알아볼 수 있는 식별자입니다.{' '}
          <code>pricing-rules</code>는 다음 메시지에서 이름으로 부를 수 있지만, <code>node-7</code>
          은 그렇지 않습니다.
        </p>

        <h2>5. 파일 가져가기</h2>
        <p>
          <strong>내보내기</strong>를 누르면 zip 파일을 내려받습니다. 포함 관계는 디렉터리가 되고,
          의존 순서는 각 파일 이름의 번호가 되며, 노드마다 자기 frontmatter를 담고 있습니다. 그래서
          이 묶음은 그래프를 그림으로 보여 주는 데 그치지 않고, 그래프 자체를 빠짐없이 기술합니다.
        </p>
        <pre>{EXPORT_TREE}</pre>
        <p>
          폴더를 Obsidian 보관소에 넣으면 <code>plan.canvas</code>가 같은 다이어그램으로 열립니다.
          아니면 소스 코드 옆에 커밋해 두세요. 에이전트가 실행할 때마다 읽게 되는데, 사실 이것이 이
          모든 일의 목적입니다.
        </p>
        <p>
          의존 관계에 순환이 있어도 내보내기는 막히지 않습니다. 순환은 매번 같은 방식으로 끊기고
          README에 기록되므로, 같은 플랜은 언제나 같은 파일로 내보내집니다.
        </p>

        <h2>6. 다른 사람과 함께 작업하기</h2>
        <p>
          편집은 실시간으로 이루어집니다. 한 플랜을 함께 보는 두 사람은 서로의 변경을 바로바로 보고,
          같은 노드의 세부 내용을 동시에 입력해도 한쪽이 다른 쪽을 덮어쓰지 않고 합쳐집니다. MCP로
          쓰는 에이전트도 참여자 한 명일 뿐입니다.
        </p>
        <p>
          <strong>공유</strong>를 누르면 계정 없이도 누구나 열어서 읽고 내보낼 수 있는 링크가
          만들어집니다. 공유를 중지하면 그 링크도 더 이상 열리지 않습니다.
        </p>
        <p>
          워크스페이스의 <strong>멤버</strong>에서는 누가 있는지 보고, 역할(소유자, 관리자, 편집자,
          뷰어)을 바꾸고, 초대 링크를 만들 수 있습니다. 아직 이메일 기능이 없으니 링크는 직접
          보내세요.
        </p>

        <h2>7. 직접 호스팅하기</h2>
        <p>
          전체 스택이 AGPL-3.0이고, Node와 Postgres 말고는 필요한 것이 없습니다.{' '}
          <Link href="https://github.com/ridanit-ruma/schematic-planner">저장소</Link>를 클론하고,{' '}
          <code>.env.example</code>을 복사하고, Postgres를 띄우고, 마이그레이션을 적용한 다음
          실행하면 됩니다. 정확한 명령어는 README에 있습니다.
        </p>
        <p>
          모든 설정은 환경 변수로 하며, 웹 앱은 서버 주소를 빌드할 때가 아니라 실행할 때 읽습니다.
          그래서 한 번 빌드한 번들이 어느 환경에서나 그대로 돌아갑니다.
        </p>

        <h2>아직 없는 것</h2>
        <p>
          어차피 마주치게 될 테니 솔직하게 적어 둡니다. 이메일은 한 통도 보내지 않으므로 초대는 직접
          전달하는 링크이고, 이메일 주소는 바꿀 수 없습니다. 로그인은 이메일과 비밀번호로만 할 수
          있습니다. 캔버스에는 실행 취소가 없고, 큰 플랜 안을 검색하는 기능도, 버전 기록도 없습니다.
        </p>
        <p>
          이 중 하나가 걸림돌이라면 <Link href={ISSUES}>GitHub Issues</Link>에 알려 주세요. 다음에
          무엇을 만들지가 그 의견에 따라 달라집니다.
        </p>
      </Prose>
    </>
  );
}
