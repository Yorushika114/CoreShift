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

  it('截止类表达：剥离"之前"后标题干净', () => {
    const c = cmd('后天之前完成比赛');
    expect(c.title).toBe('完成比赛');
    const d = new Date(c.startAt!);
    expect(d.getDate()).toBe(31); // 后天 = 5-31
  });

  it('截止类表达：多字标题', () => {
    const c = cmd('后天之前完成项目报告');
    expect(c.title).toBe('完成项目报告');
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

  it('修改', () => {
    expect(cmd('把明天的会议改到下午4点').intent).toBe('modify');
  });
});

describe('创建短语不应被误路由（intent 收紧）', () => {
  it('含"安排"作动词仍是创建', () => {
    expect(cmd('安排明天下午三点开会').intent).toBe('create');
    expect(cmd('帮我加一个明天的安排').intent).toBe('create');
  });

  it('标题含"改"但非"改到/改成"不算修改', () => {
    expect(cmd('明天下午三点改稿').intent).toBe('create');
    expect(cmd('后天上午改简历').intent).toBe('create');
  });

  it('真正的查询/修改仍正确识别', () => {
    expect(cmd('明天有什么安排').intent).toBe('query');
    expect(cmd('看看下周的日程').intent).toBe('query');
    expect(cmd('把会议改到下午4点').intent).toBe('modify');
    expect(cmd('把组会推迟到5点').intent).toBe('modify');
  });
});

describe('hasDate / hasTime 透出（供 modify 字段级 patch）', () => {
  it('只说时间：hasTime 真、hasDate 假', () => {
    const c = cmd('把会议改到下午4点');
    expect(c.hasTime).toBe(true);
    expect(c.hasDate).toBe(false);
  });

  it('只说日期：hasDate 真、hasTime 假', () => {
    const c = cmd('把会议改到后天');
    expect(c.hasDate).toBe(true);
    expect(c.hasTime).toBe(false);
  });
});
