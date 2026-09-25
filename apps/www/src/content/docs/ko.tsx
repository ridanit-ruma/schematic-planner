import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: '문서',
  description:
    'MCP로 AI 에이전트를 Schematic Planner에 연결하는 방법과, 내보낸 파일에 무엇이 담기는지 설명합니다.',
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
  ['list_workspaces', '이 키로 작업할 수 있는 워크스페이스를 나열합니다.'],
  [
    'list_projects',
    '접근할 수 있는 프로젝트를 나열합니다. 계정 전체를 볼 수도, 워크스페이스 하나로 좁혀 볼 수도 있습니다.',
  ],
  [
    'list_plans',
    '플랜을 워크스페이스와 프로젝트별로 묶어 나열하고, 플랜마다 열어 볼 수 있는 링크를 함께 줍니다.',
  ],
  [
    'trace',
    '플랜의 한 부분을 따라 흐름을 추적합니다. 어떤 노드가 어디에 닿는지, 또는 무엇이 그 노드에 닿는지를 한 단계씩, 각 단계를 일으키는 것과 싣고 가는 것까지 함께 보여 줍니다. 플랜은 이 도구로 읽습니다. 문서 전체가 아니라 해당 흐름만 돌려주며, 순환을 만나면 계속 따라 돌지 않고 순환이 있다고 알려 줍니다.',
  ],
  [
    'get_plan',
    '플랜 전체를 한 번에 가져옵니다. 개요, 그래프 JSON, 전체 Markdown 중에서 고를 수 있습니다. 좌표는 절대 포함하지 않습니다.',
  ],
  [
    'create_plan',
    '플랜을 엽니다. 이미 아는 구조를 담아서 만들 수도, 빈 상태로 만들 수도 있습니다. 마지막이 아니라 가장 먼저 부르는 도구이며, id와 플랜을 볼 수 있는 주소를 돌려줍니다.',
  ],
  ['create_project', '그림을 그릴 새 프로젝트를 만듭니다.'],
  [
    'apply_ops',
    '그다음부터 플랜을 키워 나가는 방법이자, 쓰기가 가능한 유일한 통로입니다. 여러 변경을 묶어 원자적으로 처리하고 식별자를 기준으로 삼으므로 다시 시도해도 안전합니다. 또 각 묶음은 열려 있는 모든 캔버스에 동시에 반영되므로, 플랜을 보고 있는 사람은 완성된 그림을 건네받는 대신 플랜이 바뀌어 가는 모습을 지켜보게 됩니다.',
  ],
  ['layout', '다시 배치합니다. 사람이 끌어다 놓은 노드는 그 자리에 그대로 둡니다.'],
  ['export_plan', 'Markdown 묶음과 zip 파일 링크를 돌려줍니다.'],
  [
    'delete_plan',
    '플랜 하나를 워크스페이스 휴지통으로 옮기며, 사람이 복원할 수 있습니다. 플랜 제목을 그대로 다시 입력해야 하므로, id를 잘못 넣어 다른 사람의 작업을 지우는 일은 생기지 않습니다.',
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
