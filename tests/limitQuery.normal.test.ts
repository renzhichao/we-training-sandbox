import { describe, it, expect } from 'vitest';
import {
  queryLimit,
  LimitQueryError,
  type Channel,
  type Currency,
  type LimitType,
} from '../src/limitQuery';

/**
 * 转账限额查询 v3.4 — 正常维度测试
 *
 * 覆盖:
 *  - 四渠道 app/mb/mbna/open_api 的 single/daily/monthly 限额查询
 *  - limitType 缺省时查询全部限额
 *  - customerId 边界长度(1 位与 20 位)
 *  - CNY/USD/HKD 三种币种
 */

describe('转账限额查询 v3.4 — 正常维度', () => {
  // 渠道 × 限额数值速查(与接口文档一致)
  const EXPECTED: Record<Channel, { single: number; daily: number; monthly: number | null }> = {
    app: { single: 500_000, daily: 1_000_000, monthly: 5_000_000 },
    mb: { single: 200_000, daily: 500_000, monthly: null },
    mbna: { single: 220_000, daily: 550_000, monthly: null },
    open_api: { single: 10_000, daily: 50_000, monthly: null },
  };

  describe('各渠道单笔/日累计/月累计限额查询', () => {
    it.each<[Channel, LimitType, number | null]>([
      ['app', 'single', 500_000],
      ['app', 'daily', 1_000_000],
      ['app', 'monthly', 5_000_000],
      ['mb', 'single', 200_000],
      ['mb', 'daily', 500_000],
      ['mbna', 'single', 220_000],
      ['mbna', 'daily', 550_000],
      ['open_api', 'single', 10_000],
      ['open_api', 'daily', 50_000],
    ])('channel=%s limitType=%s 返回正确限额', (channel, limitType, expected) => {
      const resp = queryLimit({ channel, customerId: 'A', currency: 'CNY', limitType });
      expect(resp.channel).toBe(channel);
      expect(resp.results).toHaveLength(1);
      expect(resp.results[0]).toMatchObject({ channel, limitType, limit: expected });
    });

    it('app 渠道查询 monthly 返回月累计限额', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      expect(resp.results[0].limit).toBe(5_000_000);
    });

    it('mb 渠道查询 monthly 返回不支持(null)', () => {
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      expect(resp.results[0].limit).toBeNull();
    });

    it('mbna 渠道查询 monthly 返回不支持(null)', () => {
      const resp = queryLimit({ channel: 'mbna', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      expect(resp.results[0].limit).toBeNull();
    });

    it('open_api 渠道查询 monthly 返回不支持(null)', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      expect(resp.results[0].limit).toBeNull();
    });
  });

  describe('limitType 缺省时查询全部限额', () => {
    it.each<Channel>(['app', 'mb', 'mbna', 'open_api'])(
      'channel=%s 缺省 limitType 返回全部限额类型',
      (channel) => {
        const resp = queryLimit({ channel, customerId: 'A', currency: 'CNY' });
        // 缺省返回 single/daily/monthly 三种类型
        expect(resp.results.map((r) => r.limitType)).toEqual(['single', 'daily', 'monthly']);
        // 各类型限额与速查表一致
        for (const r of resp.results) {
          expect(r.limit).toBe(EXPECTED[channel][r.limitType]);
        }
      },
    );

    it('app 缺省 limitType 返回全部三项限额(含月累计)', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY' });
      expect(resp.results).toEqual([
        { channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single', limit: 500_000 },
        { channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'daily', limit: 1_000_000 },
        { channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'monthly', limit: 5_000_000 },
      ]);
    });

    it('mb 缺省 limitType 时 monthly 返回 null(不支持)', () => {
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY' });
      const monthly = resp.results.find((r) => r.limitType === 'monthly');
      expect(monthly?.limit).toBeNull();
    });
  });

  describe('customerId 边界长度', () => {
    it('customerId 为 1 位时查询成功', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe('A');
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('customerId 为 20 位时查询成功', () => {
      const customerId = '12345678901234567890'; // 恰好 20 位
      expect(customerId).toHaveLength(20);
      const resp = queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe(customerId);
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('customerId 为 20 位时在 mb 渠道查询成功', () => {
      const customerId = 'abcdefghijklmnopqrst'; // 恰好 20 位
      expect(customerId).toHaveLength(20);
      const resp = queryLimit({ channel: 'mb', customerId, currency: 'CNY', limitType: 'daily' });
      expect(resp.customerId).toBe(customerId);
      expect(resp.results[0].limit).toBe(500_000);
    });

    it('customerId 为 1 位时在 open_api 渠道查询成功', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: '1', currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe('1');
      expect(resp.results[0].limit).toBe(10_000);
    });
  });

  describe('币种 CNY/USD/HKD', () => {
    it.each<Currency>(['CNY', 'USD', 'HKD'])('app 渠道 currency=%s 查询单笔限额', (currency) => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency, limitType: 'single' });
      expect(resp.currency).toBe(currency);
      expect(resp.results[0].limit).toBe(500_000);
    });

    it.each<Currency>(['CNY', 'USD', 'HKD'])('mb 渠道 currency=%s 查询日累计限额', (currency) => {
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency, limitType: 'daily' });
      expect(resp.currency).toBe(currency);
      expect(resp.results[0].limit).toBe(500_000);
    });

    it.each<Currency>(['CNY', 'USD', 'HKD'])('mbna 渠道 currency=%s 查询单笔限额', (currency) => {
      const resp = queryLimit({ channel: 'mbna', customerId: 'A', currency, limitType: 'single' });
      expect(resp.currency).toBe(currency);
      expect(resp.results[0].limit).toBe(220_000);
    });

    it.each<Currency>(['CNY', 'USD', 'HKD'])('open_api 渠道 currency=%s 查询单笔限额', (currency) => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency, limitType: 'single' });
      expect(resp.currency).toBe(currency);
      expect(resp.results[0].limit).toBe(10_000);
    });

    it('USD 币种下 app 渠道查询月累计限额', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'USD', limitType: 'monthly' });
      expect(resp.results[0].limit).toBe(5_000_000);
    });

    it('HKD 币种下 app 渠道缺省 limitType 返回全部限额', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'HKD' });
      expect(resp.currency).toBe('HKD');
      expect(resp.results).toHaveLength(3);
      expect(resp.results.map((r) => r.limit)).toEqual([500_000, 1_000_000, 5_000_000]);
    });
  });

  describe('组合场景(渠道 × 币种 × 限额类型)', () => {
    it('mbna 渠道 USD 币种查询日累计限额(上浮 10%)', () => {
      const resp = queryLimit({ channel: 'mbna', customerId: 'A', currency: 'USD', limitType: 'daily' });
      expect(resp.results[0].limit).toBe(550_000);
    });

    it('open_api 渠道 HKD 币种缺省 limitType 返回全部限额', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'HKD' });
      expect(resp.results.map((r) => r.limit)).toEqual([10_000, 50_000, null]);
    });

    it('mb 渠道 USD 币种缺省 limitType 返回全部限额', () => {
      const resp = queryLimit({ channel: 'mb', customerId: 'A', currency: 'USD' });
      expect(resp.results.map((r) => r.limit)).toEqual([200_000, 500_000, null]);
    });
  });

  describe('错误处理(正常维度下的防御性校验)', () => {
    it('customerId 为 0 位(空串)抛参数错误', () => {
      expect(() => queryLimit({ channel: 'app', customerId: '', currency: 'CNY', limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });

    it('customerId 为 21 位抛参数错误', () => {
      const customerId = '123456789012345678901'; // 21 位
      expect(customerId).toHaveLength(21);
      expect(() => queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });
  });
});
