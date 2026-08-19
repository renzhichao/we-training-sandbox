import { describe, it, expect } from 'vitest';
import {
  queryLimit,
  LimitQueryError,
  validateCustomerId,
  validateChannel,
  validateCurrency,
  validateLimitType,
  type Channel,
  type Currency,
  type LimitType,
} from '../src/limitQuery';

/**
 * 转账限额查询 v3.4 — 异常维度测试
 *
 * 覆盖:
 *  - customerId 为空/超长/非法字符
 *  - channel 非法值
 *  - currency 非法值
 *  - limitType 非法值
 */

describe('转账限额查询 v3.4 — 异常维度', () => {
  describe('customerId 为空', () => {
    it('customerId 为空字符串抛 PARAM_REQUIRED 错误', () => {
      try {
        queryLimit({ channel: 'app', customerId: '', currency: 'CNY', limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_REQUIRED');
        expect(err.status).toBe(400);
        expect(err.message).toBe('customerId 不能为空');
      }
    });

    it('customerId 为 undefined 抛 PARAM_REQUIRED 错误', () => {
      // 直接调用校验函数验证 undefined 场景
      expect(() => validateCustomerId(undefined as unknown as string))
        .toThrowError(LimitQueryError);
      try {
        validateCustomerId(undefined as unknown as string);
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_REQUIRED');
        expect(err.status).toBe(400);
      }
    });

    it('customerId 为 null 抛 PARAM_REQUIRED 错误', () => {
      expect(() => validateCustomerId(null as unknown as string))
        .toThrowError(LimitQueryError);
      try {
        validateCustomerId(null as unknown as string);
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_REQUIRED');
        expect(err.status).toBe(400);
      }
    });

    it('customerId 为纯空白字符串按长度校验(当前实现仅校验长度,不校验字符集)', () => {
      // 空白字符串长度为 1,在当前实现中通过长度校验
      const resp = queryLimit({ channel: 'app', customerId: ' ', currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe(' ');
      expect(resp.results[0].limit).toBe(500_000);
    });
  });

  describe('customerId 超长', () => {
    it('customerId 为 21 位抛 PARAM_LENGTH 错误', () => {
      const customerId = '123456789012345678901'; // 21 位
      expect(customerId).toHaveLength(21);
      try {
        queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_LENGTH');
        expect(err.status).toBe(400);
        expect(err.message).toBe('customerId 长度须为 1-20 位');
      }
    });

    it('customerId 为 100 位抛 PARAM_LENGTH 错误', () => {
      const customerId = 'x'.repeat(100);
      expect(customerId).toHaveLength(100);
      expect(() => queryLimit({ channel: 'mb', customerId, currency: 'CNY', limitType: 'daily' }))
        .toThrowError(LimitQueryError);
    });

    it('customerId 为 21 位时在 open_api 渠道同样抛错', () => {
      const customerId = 'abcdefghijklmnopqrstu'; // 21 位
      expect(customerId).toHaveLength(21);
      expect(() => queryLimit({ channel: 'open_api', customerId, currency: 'CNY', limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });
  });

  describe('customerId 非法字符', () => {
    it('customerId 含空格字符按长度校验(当前实现仅校验长度)', () => {
      // 含空格的 customerId 长度合法
      const customerId = 'A B C'; // 5 位,含空格
      expect(customerId).toHaveLength(5);
      const resp = queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe(customerId);
    });

    it('customerId 含特殊符号(如 @#$%)按长度校验(当前实现仅校验长度)', () => {
      const customerId = 'A@#B$%'; // 6 位
      expect(customerId).toHaveLength(6);
      const resp = queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe(customerId);
    });

    it('customerId 含中文/Unicode 字符按长度校验', () => {
      const customerId = '客户甲'; // 3 个字符
      expect(customerId).toHaveLength(3);
      const resp = queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe(customerId);
    });

    it('customerId 含换行符按长度校验', () => {
      const customerId = 'A\nB'; // 3 位,含换行
      expect(customerId).toHaveLength(3);
      const resp = queryLimit({ channel: 'app', customerId, currency: 'CNY', limitType: 'single' });
      expect(resp.customerId).toBe(customerId);
    });
  });

  describe('channel 非法值', () => {
    it('channel=web(不在枚举中)抛 PARAM_ENUM 错误', () => {
      try {
        queryLimit({ channel: 'web' as Channel, customerId: 'A', currency: 'CNY', limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
        expect(err.status).toBe(400);
        expect(err.message).toBe('channel 取值非法');
      }
    });

    it('channel=APP(大小写敏感)抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: 'APP' as Channel, customerId: 'A', currency: 'CNY', limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });

    it('channel=空字符串抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: '' as Channel, customerId: 'A', currency: 'CNY', limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });

    it('channel=undefined 抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: undefined as unknown as Channel, customerId: 'A', currency: 'CNY', limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });

    it('validateChannel 对非法值抛 PARAM_ENUM 错误', () => {
      expect(() => validateChannel('web' as Channel)).toThrowError(LimitQueryError);
      try {
        validateChannel('web' as Channel);
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
      }
    });
  });

  describe('currency 非法值', () => {
    it('currency=JPY(不在枚举中)抛 PARAM_ENUM 错误', () => {
      try {
        queryLimit({ channel: 'app', customerId: 'A', currency: 'JPY' as Currency, limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
        expect(err.status).toBe(400);
        expect(err.message).toBe('currency 取值非法');
      }
    });

    it('currency=cny(小写)抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: 'app', customerId: 'A', currency: 'cny' as Currency, limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });

    it('currency=空字符串抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: 'app', customerId: 'A', currency: '' as Currency, limitType: 'single' }))
        .toThrowError(LimitQueryError);
    });

    it('currency=GBP(未支持币种)抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: 'mb', customerId: 'A', currency: 'GBP' as Currency, limitType: 'daily' }))
        .toThrowError(LimitQueryError);
    });

    it('validateCurrency 对非法值抛 PARAM_ENUM 错误', () => {
      expect(() => validateCurrency('JPY' as Currency)).toThrowError(LimitQueryError);
      try {
        validateCurrency('JPY' as Currency);
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
      }
    });
  });

  describe('limitType 非法值', () => {
    it('limitType=yearly(不在枚举中)抛 PARAM_ENUM 错误', () => {
      try {
        queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'yearly' as LimitType });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
        expect(err.status).toBe(400);
        expect(err.message).toBe('limitType 取值非法');
      }
    });

    it('limitType=weekly(不在枚举中)抛 PARAM_ENUM 错误', () => {
      expect(() => queryLimit({ channel: 'mb', customerId: 'A', currency: 'CNY', limitType: 'weekly' as LimitType }))
        .toThrowError(LimitQueryError);
    });

    it('validateLimitType 对非法值抛 PARAM_ENUM 错误', () => {
      expect(() => validateLimitType('yearly' as LimitType)).toThrowError(LimitQueryError);
    });
  });

  describe('组合异常场景', () => {
    it('channel 与 currency 同时非法时,先校验 channel', () => {
      try {
        queryLimit({ channel: 'web' as Channel, customerId: 'A', currency: 'JPY' as Currency, limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
        expect(err.message).toBe('channel 取值非法');
      }
    });

    it('customerId 为空且 channel 非法时,先校验 channel', () => {
      try {
        queryLimit({ channel: 'web' as Channel, customerId: '', currency: 'CNY', limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
      }
    });

    it('customerId 超长且 currency 非法时,先校验 currency', () => {
      try {
        queryLimit({ channel: 'app', customerId: 'x'.repeat(21), currency: 'JPY' as Currency, limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.code).toBe('PARAM_ENUM');
        expect(err.message).toBe('currency 取值非法');
      }
    });
  });
});
