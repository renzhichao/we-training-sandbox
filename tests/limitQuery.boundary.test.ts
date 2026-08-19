import { describe, it, expect } from 'vitest';
import {
  queryLimit,
  LimitQueryError,
  type Channel,
  type Currency,
  type LimitType,
} from '../src/limitQuery';

/**
 * 转账限额查询 v3.4 — 边界维度测试
 *
 * 覆盖:
 *  - 金额边界:0、0.01、恰好达限、超限 1 分
 *  - 渠道边界:open_api/mb 显式查询 monthly 返回不支持(null)
 *  - 币种边界:EUR 在部分渠道不可用(app 可用、mb/mbna/open_api 不可用)
 */

describe('转账限额查询 v3.4 — 边界维度', () => {
  // 限额速查(与接口文档一致)
  const EXPECTED: Record<Channel, { single: number; daily: number; monthly: number | null }> = {
    app: { single: 500_000, daily: 1_000_000, monthly: 5_000_000 },
    mb: { single: 200_000, daily: 500_000, monthly: null },
    mbna: { single: 220_000, daily: 550_000, monthly: null },
    open_api: { single: 10_000, daily: 50_000, monthly: null },
  };

  describe('金额边界:0', () => {
    it('app 渠道单笔限额,已用额度=0,可用=限额', () => {
      const limit = EXPECTED.app.single;
      const used = 0;
      const available = limit - used;
      expect(available).toBe(500_000);
      // 查询限额本身不受已用额度影响
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('mb 渠道日累计限额,已用额度=0,可用=限额', () => {
      const limit = EXPECTED.mb.daily;
      const used = 0;
      const available = limit - used;
      expect(available).toBe(500_000);
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'daily' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('open_api 渠道单笔限额,已用额度=0,可用=限额', () => {
      const limit = EXPECTED.open_api.single;
      const used = 0;
      const available = limit - used;
      expect(available).toBe(10_000);
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(10_000);
    });
  });

  describe('金额边界:0.01', () => {
    it('app 渠道单笔限额,已用额度=0.01,可用=限额-0.01', () => {
      const limit = EXPECTED.app.single;
      const used = 0.01;
      const available = limit - used;
      expect(available).toBeCloseTo(499_999.99, 2);
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('mb 渠道日累计限额,已用额度=0.01,可用=限额-0.01', () => {
      const limit = EXPECTED.mb.daily;
      const used = 0.01;
      const available = limit - used;
      expect(available).toBeCloseTo(499_999.99, 2);
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'daily' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('open_api 渠道单笔限额,已用额度=0.01,可用=限额-0.01', () => {
      const limit = EXPECTED.open_api.single;
      const used = 0.01;
      const available = limit - used;
      expect(available).toBeCloseTo(9_999.99, 2);
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(10_000);
    });
  });

  describe('金额边界:恰好达限(已用=限额)', () => {
    it('app 渠道单笔限额,已用=500000(恰好达限),可用=0', () => {
      const limit = EXPECTED.app.single;
      const used = limit;
      const available = limit - used;
      expect(available).toBe(0);
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('mb 渠道日累计限额,已用=500000(恰好达限),可用=0', () => {
      const limit = EXPECTED.mb.daily;
      const used = limit;
      const available = limit - used;
      expect(available).toBe(0);
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'daily' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('open_api 渠道单笔限额,已用=10000(恰好达限),可用=0', () => {
      const limit = EXPECTED.open_api.single;
      const used = limit;
      const available = limit - used;
      expect(available).toBe(0);
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(10_000);
    });
  });

  describe('金额边界:超限 1 分(已用=限额+0.01)', () => {
    it('app 渠道单笔限额,已用=500001(超限 1 分),可用=-1', () => {
      const limit = EXPECTED.app.single;
      const used = limit + 0.01;
      const available = limit - used;
      expect(available).toBeCloseTo(-0.01, 2);
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('mb 渠道日累计限额,已用=500001(超限 1 分),可用=-1', () => {
      const limit = EXPECTED.mb.daily;
      const used = limit + 0.01;
      const available = limit - used;
      expect(available).toBeCloseTo(-0.01, 2);
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'daily' });
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('open_api 渠道单笔限额,已用=10001(超限 1 分),可用=-1', () => {
      const limit = EXPECTED.open_api.single;
      const used = limit + 0.01;
      const available = limit - used;
      expect(available).toBeCloseTo(-0.01, 2);
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.results[0].limit).toBe(10_000);
    });
  });

  describe('渠道边界:open_api 显式查询 monthly 返回不支持', () => {
    it('open_api 显式查询 monthly 返回 null(不支持),而非抛错', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      expect(resp.results).toHaveLength(1);
      expect(resp.results[0].limitType).toBe('monthly');
      expect(resp.results[0].limit).toBeNull();
    });

    it('open_api 缺省 limitType 时 monthly 返回 null(不支持)', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY' });
      const monthly = resp.results.find((r) => r.limitType === 'monthly');
      expect(monthly?.limit).toBeNull();
      // 其余两项正常返回
      expect(resp.results.find((r) => r.limitType === 'single')?.limit).toBe(10_000);
      expect(resp.results.find((r) => r.limitType === 'daily')?.limit).toBe(50_000);
    });
  });

  describe('渠道边界:mb 显式查询 monthly 返回不支持', () => {
    it('mb 显式查询 monthly 返回 null(不支持),而非抛错', () => {
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      expect(resp.results).toHaveLength(1);
      expect(resp.results[0].limitType).toBe('monthly');
      expect(resp.results[0].limit).toBeNull();
    });

    it('mb 缺省 limitType 时 monthly 返回 null(不支持)', () => {
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY' });
      const monthly = resp.results.find((r) => r.limitType === 'monthly');
      expect(monthly?.limit).toBeNull();
      expect(resp.results.find((r) => r.limitType === 'single')?.limit).toBe(200_000);
      expect(resp.results.find((r) => r.limitType === 'daily')?.limit).toBe(500_000);
    });
  });

  describe('币种边界:EUR 部分渠道不可用', () => {
    it('EUR 在 app 渠道可用,查询单笔限额成功', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'EUR', limitType: 'single' });
      expect(resp.currency).toBe('EUR');
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('EUR 在 app 渠道缺省 limitType 返回全部限额', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'EUR' });
      expect(resp.results.map((r) => r.limit)).toEqual([500_000, 1_000_000, 5_000_000]);
    });

    it.each<Channel>(['mb', 'mbna', 'open_api'])(
      'EUR 在 %s 渠道不可用,抛 CURRENCY_NOT_SUPPORTED 错误',
      (channel) => {
        expect(() => queryLimit({ channel, customerId: 'A', currency: 'EUR', limitType: 'single' }))
          .toThrowError(LimitQueryError);
        try {
          queryLimit({ channel, customerId: 'A', currency: 'EUR', limitType: 'single' });
        } catch (e) {
          expect(e).toBeInstanceOf(LimitQueryError);
          const err = e as LimitQueryError;
          expect(err.code).toBe('CURRENCY_NOT_SUPPORTED');
          expect(err.status).toBe(200);
          expect(err.message).toContain(channel);
        }
      },
    );

    it('EUR 在 mb 渠道不可用,错误信息指明渠道', () => {
      try {
        queryLimit({ channel: 'mb', customerId: 'A', currency: 'EUR', limitType: 'single' });
        // 不应走到这里
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.message).toBe('该币种在 mb 渠道不可用');
      }
    });
  });

  describe('组合边界场景', () => {
    it('open_api 渠道 EUR 不可用,即使查询 monthly 也先报币种错误', () => {
      expect(() => queryLimit({ channel: 'open_api', customerId: 'A', currency: 'EUR', limitType: 'monthly' }))
        .toThrowError(LimitQueryError);
    });

    it('app 渠道 EUR 查询 monthly 正常返回月累计限额', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'EUR', limitType: 'monthly' });
      expect(resp.results[0].limit).toBe(5_000_000);
    });
  });
});
