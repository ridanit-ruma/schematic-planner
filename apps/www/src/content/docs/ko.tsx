import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: '문서',
  description:
    'MCP로 AI 에이전트를 Schematic Planner에 연결하는 방법과, 내보낸 파일에 무엇이 담기는지 설명합니다.',
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
  ['list_workspaces', '이 키로 작업할 수 있는 워크스페이스를 나열합니다.'],
  [
    'list_projects',
    '접근할 수 있는 프로젝트를 나열합니다. 계정 전체를 볼 수도, 워크스페이스 하나로 좁혀 볼 수도 있습니다.',
  ],
  [
    'list_plans',
    '플랜을 워크스페이스, 프로젝트, 폴더별로 묶어 나열하고, 플랜마다 열어 볼 수 있는 링크를 함께 줍니다.',
  ],
  [
    'search',
    '이 키로 접근할 수 있는 모든 플랜에서 제목, 식별자, 태그, 내용에 든 단어를 찾아 그 단어가 있는 플랜을 알려 줍니다. 새로 그리기 전에 먼저 써 보세요. 누군가 이미 그린 시스템을 두 번째 플랜으로 또 그리면 워크스페이스는 금세 어질러집니다.',
  ],
  [
    'trace',
    '플랜의 한 부분을 따라 흐름을 추적합니다. 어떤 노드가 어디에 닿는지, 또는 무엇이 그 노드에 닿는지를 한 단계씩, 각 단계를 일으키는 것과 싣고 가는 것까지 함께 보여 줍니다. 플랜은 이 도구로 읽습니다. 문서 전체가 아니라 해당 흐름만 돌려주며, 순환을 만나면 계속 따라 돌지 않고 순환이 있다고 알려 줍니다.',
  ],
  [
    'get_plan',
    '플랜 전체를 한 번에 가져옵니다. 개요, 그래프 JSON, 전체 Markdown 중에서 고를 수 있습니다. 좌표는 절대 포함하지 않습니다. 답의 끝에는 프로젝트가 쓰는 종류와 상태가 붙어 있어, 에이전트가 어떤 말을 쓸 수 있는지 알 수 있습니다.',
  ],
  [
    'read_nodes',
    '지정한 노드의 내용 전체를 Markdown으로, 각 노드가 무엇과 연결되어 있고 무엇에 담겨 있는지와 함께 돌려줍니다.',
  ],
  [
    'next_task',
    '플랜이 어디까지 왔는지와 지금 시작할 수 있는 일을 각각의 내용과 함께 알려 줍니다. 상태의 이름이 아니라 그 상태가 뜻하는 바를 기준으로, 이미 진행 중인 일, 막힌 일, 앞선 일이 모두 끝나거나 중단되어 바로 시작할 수 있는 일을 나눕니다.',
  ],
  [
    'plan_history',
    '누가 무엇을 바꿨는지 최신순으로 보여 줍니다. 사람과 에이전트를 가리지 않습니다.',
  ],
  ['create_project', '그림을 그릴 새 프로젝트를 만듭니다.'],
  [
    'create_plan',
    '빈 플랜을 엽니다. 폴더 경로를 주면 그 폴더에 넣습니다. 마지막이 아니라 가장 먼저 부르는 도구이며, id와 플랜을 볼 수 있는 주소, 프로젝트가 쓰는 종류와 상태를 돌려줍니다.',
  ],
  [
    'apply_ops',
    '그다음부터 플랜을 키워 나가는 방법이자, 쓰기가 가능한 유일한 통로입니다. 여러 변경을 묶어 원자적으로 처리하고 식별자를 기준으로 삼으므로 다시 시도해도 안전합니다. 또 각 묶음은 열려 있는 모든 캔버스에 동시에 반영되므로, 플랜을 보고 있는 사람은 완성된 그림을 건네받는 대신 플랜이 바뀌어 가는 모습을 지켜보게 됩니다. 종류와 상태는 프로젝트에 비추어 확인하며, 프로젝트에 없는 값이 있으면 있는 값의 목록과 함께 묶음 전체를 거절합니다.',
  ],
  [
    'set_plan_sources',
    '이 플랜이 어떤 플랜을 바탕으로 쓰였는지 정합니다. 플랜을 다시 읽으면 각 출처가 아직 있는지 알려 줍니다.',
  ],
  ['layout', '다시 배치합니다. 사람이 끌어다 놓은 노드는 그 자리에 그대로 둡니다.'],
  ['export_plan', 'Markdown 묶음과 zip 파일 링크를 돌려줍니다.'],
  [
    'delete_plan',
    '플랜 하나를 워크스페이스 휴지통으로 옮기며, 사람이 복원할 수 있습니다. 플랜 제목을 그대로 다시 입력해야 하므로, id를 잘못 넣어 다른 사람의 작업을 지우는 일은 생기지 않습니다.',
  ],
  [
    'list_folders',
    '프로젝트의 폴더를 Specs/Billing 같은 경로로 나열하고, 폴더마다 들어 있는 플랜 수를 알려 줍니다.',
  ],
  [
    'create_folder',
    '폴더를 만듭니다. 경로를 주면 다른 폴더 안에 만들며, 가는 길에 없는 폴더도 함께 만듭니다. 이미 있는 폴더를 요청하면 새로 만들지 않고 그 폴더를 돌려줍니다.',
  ],
  ['rename_folder', '폴더 이름을 바꿉니다. 폴더도, 그 안의 것도 제자리에 그대로 있습니다.'],
  [
    'delete_folder',
    '폴더를 안의 폴더, 플랜과 함께 휴지통으로 옮기며, 복원하면 모두 함께 돌아옵니다. 폴더 이름을 그대로 다시 입력해야 합니다.',
  ],
  [
    'move_plan',
    '플랜을 다른 폴더, 다른 프로젝트, 또는 다른 워크스페이스의 프로젝트로 옮깁니다. 워크스페이스를 넘어가면 공유 링크가 없어집니다.',
  ],
] as const;

export default function Docs() {
  return (
    <>
      <article className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">에이전트 연결하기</h1>
          <p className="mt-4 text-base leading-[1.65] text-ink-muted">
            Schematic Planner는 HTTP로 MCP를 제공합니다. 설치할 것은 없습니다. 계정 설정에서{' '}
            <strong className="font-medium text-ink">에이전트</strong>를 열고 키를 만든 다음, URL과
            키를 클라이언트에 붙여 넣으면 됩니다.
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            키는 특정 워크스페이스가 아니라 나에게 속하므로, 키 하나로 내가 멤버인 모든
            워크스페이스에 닿을 수 있습니다. 그래서 어느 워크스페이스인지 골라야 할 때는 도구가
            워크스페이스 인자를 받습니다. 이 인자 없이 무언가를 만들라는 요청을 받으면, 서버는
            짐작하지 않고 고를 수 있는 선택지를 알려 줍니다.
          </p>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {MCP_CONFIG}
          </pre>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">도구</h2>
          <dl className="mt-4 space-y-4">
            {TOOLS.map(([name, description]) => (
              <div key={name} className="border-l-2 border-rule pl-4">
                <dt className="slug text-ink">{name}</dt>
                <dd className="mt-1 text-sm leading-[1.6] text-ink-muted">{description}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            폴더는 경로로 가리킵니다
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            폴더 안에 폴더를 둘 수 있으므로, 폴더를 받는 도구는 프로젝트 맨 위에서부터의 경로를
            받습니다. 예를 들면 <code className="slug">Specs/Billing</code>입니다. 프로젝트에 그
            이름을 가진 폴더가 하나뿐이면 이름만 써도 되므로, 폴더를 중첩할 수 있기 전에 쓴
            프롬프트도 그대로 동작합니다. 두 폴더가 같은 이름을 쓰면 짐작하지 않고 두 경로를 알려
            주며 거절합니다.
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            종류와 상태는 프로젝트가 정합니다
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            프로젝트마다 자기 종류와 상태를 정하고, 그 프로젝트의 모든 플랜이 이를 씁니다.
            에이전트는 <code className="slug">get_plan</code>이나{' '}
            <code className="slug">create_plan</code>의 답에서 이를 읽고 id로 씁니다. 이름으로 써도
            됩니다. 아무도 바꾸지 않은 프로젝트에는 기본값이 있습니다.{' '}
            <code className="slug">idea</code>, <code className="slug">planned</code>,{' '}
            <code className="slug">in_progress</code>, <code className="slug">blocked</code>,{' '}
            <code className="slug">done</code>, <code className="slug">dropped</code>, 그리고{' '}
            <code className="slug">feature</code>, <code className="slug">task</code>,{' '}
            <code className="slug">decision</code>, <code className="slug">note</code>,{' '}
            <code className="slug">group</code>입니다. 프로젝트에 없는 값은 있는 값의 목록과 함께
            거절됩니다. 에이전트는 이 목록을 쓸 수만 있고 바꿀 수는 없습니다. 바꾸는 것은 프로젝트
            설정에서 합니다.
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            노드의 내용은 앱에서는 블록 편집기로 쓰고, 에이전트는 Markdown으로 읽고 씁니다. 표,
            토글, 콜아웃은 각각 Markdown 표, <code className="slug">&lt;details&gt;</code> 블록,
            Obsidian 콜아웃으로 오갑니다.
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            에이전트가 위치를 정하지 않는 이유
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            언어 모델에게 좌표를 정하게 하면 아무도 읽고 싶지 않은 다이어그램이 나오고, 그러느라
            컨텍스트까지 소모합니다. 그래서 도구에는 위치 필드가 없습니다. 에이전트는 무엇이 어디로
            흐르는지만 말하고, 배치는 서버가 하며 각 선에 붙는 글의 자리도 서버가 정합니다. 사람이
            끌어다 놓은 것은 고정되고, 자동 배치는 그것을 다시는 건드리지 않습니다.
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            내보낸 파일에 담기는 것
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            흐름은 무엇이 그 흐름을 일으키는지, 무엇을 싣고 가는지와 함께 각 노드의 frontmatter에
            기록됩니다. 포함 연결은 디렉터리 중첩이 됩니다. 의존 연결은 위상 정렬 순서가 되고, 이
            순서가 각 파일 이름 앞의 번호가 됩니다. 노드마다 자기 frontmatter를 담고 있으므로, 이
            묶음은 그래프를 그림으로 보여 주는 데 그치지 않고 그래프 자체를 빠짐없이 기술합니다.
            의존 관계에 순환이 있어도 내보내기는 막히지 않습니다. 순환은 매번 같은 방식으로 끊기고
            README에 기록됩니다.
          </p>
        </div>
      </article>
    </>
  );
}
