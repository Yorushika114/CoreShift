import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';

const BASE = new Date(2026, 4, 29); // 2026-05-29 周五

function cmd(text: string) {
  return parseVoiceCommand(text, BASE);
}

describe('标题剥离', () => {
  it('剥离相对月份后保留标题', () => {
    const c = cmd('下个月6号下午3点开会');
    expect(c.title).toBe('开会');
    const d = new Date(c.startAt!);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(15);
  });

  it('完整句子：明天下午3点开组会', () => {
    const c = cmd('明天下午3点开组会');
    expect(c.title).toBe('开组会');
  });
});

describe('意图识别', () => {
  it('删除', () => {
    expect(cmd('删除明天的会议').intent).toBe('delete');
  });

  it('查询', () => {
    expect(cmd('明天有什么安排').intent).toBe('query');
  });

  it('创建（默认）', () => {
    expect(cmd('下个月6号开会').intent).toBe('create');
  });
});
