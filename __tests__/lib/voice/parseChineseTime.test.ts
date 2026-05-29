import { parseChineseTime } from '@/lib/voice/parseChineseTime';

// 固定基准日期：2026-05-29 周五
const BASE = new Date(2026, 4, 29, 0, 0, 0, 0);

function parse(text: string) {
  return parseChineseTime(text, BASE);
}

describe('相对日期', () => {
  it('今天', () => {
    const { date, hasDate } = parse('今天开会');
    expect(hasDate).toBe(true);
    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(4);
  });

  it('明天', () => {
    const { date } = parse('明天下午开会');
    expect(date.getDate()).toBe(30);
  });

  it('后天', () => {
    const { date } = parse('后天');
    expect(date.getDate()).toBe(31);
  });

  it('大后天', () => {
    const { date } = parse('大后天');
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(5); // June
  });

  it('3天后', () => {
    const { date } = parse('3天后');
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(5);
  });

  it('三天后', () => {
    const { date } = parse('三天后');
    expect(date.getDate()).toBe(1);
  });
});

describe('下周 / 这周', () => {
  // BASE = 2026-05-29 (周五)

  it('下周一', () => {
    const { date } = parse('下周一上午开会');
    expect(date.getDay()).toBe(1);
    expect(date.getDate()).toBe(1); // 2026-06-01
    expect(date.getMonth()).toBe(5);
  });

  it('下周五', () => {
    const { date } = parse('下周五');
    // 下周五 = 2026-06-05
    expect(date.getDay()).toBe(5);
    expect(date.getDate()).toBe(5);
  });

  it('这周六', () => {
    const { date } = parse('这周六');
    // 这周六 = 2026-05-30
    expect(date.getDay()).toBe(6);
    expect(date.getDate()).toBe(30);
  });

  it('下下周一', () => {
    const { date } = parse('下下周一');
    // 下下周一 = 2026-06-08
    expect(date.getDay()).toBe(1);
    expect(date.getDate()).toBe(8);
  });
});

describe('绝对日期', () => {
  it('6月15日', () => {
    const { date, hasDate } = parse('6月15日下午开会');
    expect(hasDate).toBe(true);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
  });

  it('六月一日', () => {
    const { date } = parse('六月一日');
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(1);
  });

  it('跨年：1月5日（当前月份后）', () => {
    const { date } = parse('1月5日');
    expect(date.getFullYear()).toBe(2027);
  });
});

describe('相对月份', () => {
  // BASE = 2026-05-29

  it('下个月6号', () => {
    const { date, hasDate } = parse('下个月6号');
    expect(hasDate).toBe(true);
    expect(date.getMonth()).toBe(5); // June
    expect(date.getDate()).toBe(6);
  });

  it('下个月6日（日字）', () => {
    const { date } = parse('下个月6日下午3点');
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(6);
    expect(date.getHours()).toBe(15);
  });

  it('这个月15号', () => {
    const { date } = parse('这个月15号');
    expect(date.getMonth()).toBe(4); // May
    expect(date.getDate()).toBe(15);
  });

  it('下下个月3号', () => {
    const { date } = parse('下下个月3号');
    expect(date.getMonth()).toBe(6); // July
    expect(date.getDate()).toBe(3);
  });

  it('跨年：12月基准下个月进入次年1月', () => {
    const dec = new Date(2026, 11, 10); // 2026-12-10
    const { date } = parseChineseTime('下个月5号', dec);
    expect(date.getFullYear()).toBe(2027);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(5);
  });
});

describe('时间点', () => {
  it('下午3点', () => {
    const { date, hasTime } = parse('明天下午3点开会');
    expect(hasTime).toBe(true);
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(0);
  });

  it('上午10点半', () => {
    const { date } = parse('上午10点半');
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(30);
  });

  it('下午两点三十分', () => {
    const { date } = parse('下午两点三十分');
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  it('晚上8点', () => {
    const { date } = parse('晚上8点');
    expect(date.getHours()).toBe(20);
  });

  it('中午12点', () => {
    const { date } = parse('中午12点');
    expect(date.getHours()).toBe(12);
  });

  it('无时间时 hasTime 为 false', () => {
    const { hasTime } = parse('明天开会');
    expect(hasTime).toBe(false);
  });
});

describe('完整句子', () => {
  it('明天下午3点开组会', () => {
    const { date } = parse('明天下午3点开组会');
    expect(date.getDate()).toBe(30);
    expect(date.getHours()).toBe(15);
  });

  it('下周一上午9点到10点算法课', () => {
    const { date } = parse('下周一上午9点到10点算法课');
    expect(date.getDay()).toBe(1);
    expect(date.getHours()).toBe(9);
  });

  it('无日期无时间：hasDate/hasTime 均为 false', () => {
    const { hasDate, hasTime } = parse('开会');
    expect(hasDate).toBe(false);
    expect(hasTime).toBe(false);
  });
});

describe('相对时间偏移（N小时后/分钟后，从当前时刻算）', () => {
  // 带具体时刻的基准：2026-05-29 14:30
  const TIMED = new Date(2026, 4, 29, 14, 30, 0, 0);
  const p = (t: string) => parseChineseTime(t, TIMED);

  it('一小时后 → +1 小时，保留分钟', () => {
    const { date, hasDate, hasTime } = p('一小时后上课');
    expect(hasDate).toBe(true);
    expect(hasTime).toBe(true);
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(30);
    expect(date.getDate()).toBe(29);
  });

  it('两个小时后 → +2 小时', () => {
    const { date } = p('两个小时后开会');
    expect(date.getHours()).toBe(16);
    expect(date.getMinutes()).toBe(30);
  });

  it('半小时后 → +30 分钟', () => {
    const { date } = p('半小时后开会');
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(0);
  });

  it('30分钟后 → +30 分钟', () => {
    const { date } = p('30分钟后取快递');
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(0);
  });

  it('跨天：晚上23点 + 两小时 → 次日 1 点', () => {
    const late = new Date(2026, 4, 29, 23, 0, 0, 0);
    const { date } = parseChineseTime('两小时后', late);
    expect(date.getDate()).toBe(30);
    expect(date.getHours()).toBe(1);
  });
});
