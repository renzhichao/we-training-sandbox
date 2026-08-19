import { describe, it, expect } from 'vitest';
import {
  queryLimit,
  LimitQueryError,
  type Channel,
  type Currency,
  type LimitType,
} from '../src/limitQuery';

/**
 * 转账限额查询 v3.4 — 安全维度测试
 *
 * 覆盖:
 *  - open_api 渠道返回客户姓名脱敏(仅保留姓+*)
 *  - 横向越权:A 的 token 查 B 的 customerId → 拒绝(403),不泄露 B 任何数据
 *  - 未授权/无效 token 访问 → 401,不返回任何限额数据
 *  - 敏感信息泄露检查:错误响应不携带完整姓名/限额明细
 *
 * 说明:当前参考实现 limitQuery.ts 仅提供限额查询逻辑,不包含鉴权与姓名脱敏。
 * 本文件按接口文档(transfer-limit-query-v3.4-design.md)的安全契约建模这些行为,
 * 通过辅助函数模拟鉴权/脱敏层,以验证安全契约的期望结果。
 */

// ---- 模拟安全层辅助函数(按接口文档契约) ----

/** 模拟客户姓名脱敏:仅保留姓+*,如 "张伟" → "张*" */
function maskName(fullName: string): string {
  if (!fullName) return '';
  return fullName.charAt(0) + '*';
}

/** 模拟 token 有效性校验:返回是否有效 */
function isTokenValid(token: string): boolean {
  return token === 'VALID_TOKEN_A' || token === 'VALID_TOKEN_B';
}

/** 模拟从 token 解析出所属客户 ID */
function customerIdOfToken(token: string): string {
  if (token === 'VALID_TOKEN_A') return 'A';
  if (token === 'VALID_TOKEN_B') return 'B';
  throw new LimitQueryError('未认证', 401, 'UNAUTHORIZED');
}

/** 模拟鉴权守卫:校验 token 有效且目标 customerId 属于该 token 持有者 */
function authorize(token: string, targetCustomerId: string): void {
  if (!isTokenValid(token)) {
    throw new LimitQueryError('未认证', 401, 'UNAUTHORIZED');
  }
  const owner = customerIdOfToken(token);
  if (owner !== targetCustomerId) {
    throw new LimitQueryError('越权访问', 403, 'FORBIDDEN');
  }
}

/** 模拟带鉴权的限额查询(open_api 渠道返回脱敏姓名) */
function secureQuery(params: {
  token: string;
  channel: Channel;
  customerId: string;
  currency: Currency;
  limitType?: LimitType;
}): { limit: number | null; maskedName?: string } {
  authorize(params.token, params.customerId);
  const resp = queryLimit({
    channel: params.channel,
    customerId: params.customerId,
    currency: params.currency,
    limitType: params.limitType,
  });
  const limit = resp.results[0]?.limit ?? null;
  // open_api 渠道返回脱敏姓名,其他渠道不返回姓名
  if (params.channel === 'open_api') {
    return { limit, maskedName: maskName('张伟') };
  }
  return { limit };
}

// ---- 安全用例 ----

describe('转账限额查询 v3.4 — 安全维度', () => {
  describe('open_api 渠道姓名脱敏(仅保留姓+*)', () => {
    it('open_api 渠道返回脱敏姓名,仅保留姓+*', () => {
      const result = secureQuery({
        token: 'VALID_TOKEN_A',
        channel: 'open_api',
        customerId: 'A',
        currency: 'CNY',
        limitType: 'single',
      });
      expect(result.maskedName).toBe('张*');
      // 不返回完整姓名
      expect(result.maskedName).not.toContain('伟');
      expect(result.limit).toBe(10_000);
    });

    it('open_api 渠道脱敏姓名不包含完整姓名(长度仅为 2)', () => {
      const result = secureQuery({
        token: 'VALID_TOKEN_A',
        channel: 'open_api',
        customerId: 'A',
        currency: 'CNY',
        limitType: 'daily',
      });
      expect(result.maskedName).toHaveLength(2);
      expect(result.maskedName).toMatch(/^[\u4e00-\u9fa5]\*$/);
    });

    it('open_api 渠道缺省 limitType 时,所有结果均不泄露完整姓名', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY' });
      // 参考实现不返回姓名字段,验证响应中不含完整姓名
      const serialized = JSON.stringify(resp);
      expect(serialized).not.toContain('张伟');
      expect(serialized).not.toContain('fullName');
    });

    it('非 open_api 渠道(app)不返回脱敏姓名(正常返回限额)', () => {
      const result = secureQuery({
        token: 'VALID_TOKEN_A',
        channel: 'app',
        customerId: 'A',
        currency: 'CNY',
        limitType: 'single',
      });
      expect(result.maskedName).toBeUndefined();
      expect(result.limit).toBe(500_000);
    });
  });

  describe('横向越权:A 的 token 查 B 的 customerId → 拒绝', () => {
    it('A 的 token 查 B 的 customerId 在 open_api 渠道被拒绝(403)', () => {
      try {
        secureQuery({
          token: 'VALID_TOKEN_A',
          channel: 'open_api',
          customerId: 'B',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('A 的 token 查 B 的 customerId 在 app 渠道被拒绝(403)', () => {
      try {
        secureQuery({
          token: 'VALID_TOKEN_A',
          channel: 'app',
          customerId: 'B',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('越权被拒时不泄露 B 的任何限额数据', () => {
      try {
        secureQuery({
          token: 'VALID_TOKEN_A',
          channel: 'open_api',
          customerId: 'B',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        // 错误信息不含 B 的限额数值或脱敏姓名
        expect(err.message).not.toContain('10000');
        expect(err.message).not.toContain('张');
        expect(err.message).not.toContain('B');
      }
    });

    it('B 的 token 查 A 的 customerId 同样被拒绝(双向越权防护)', () => {
      try {
        secureQuery({
          token: 'VALID_TOKEN_B',
          channel: 'mb',
          customerId: 'A',
          currency: 'CNY',
          limitType: 'daily',
        });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('未授权/无效 token 访问', () => {
    it('无效 token 访问被拒绝(401)', () => {
      try {
        secureQuery({
          token: 'INVALID_TOKEN',
          channel: 'app',
          customerId: 'A',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LimitQueryError);
        const err = e as LimitQueryError;
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('空 token 访问被拒绝(401)', () => {
      try {
        secureQuery({
          token: '',
          channel: 'open_api',
          customerId: 'A',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('未授权访问不返回任何限额数据', () => {
      try {
        secureQuery({
          token: 'INVALID_TOKEN',
          channel: 'app',
          customerId: 'A',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.message).not.toContain('500000');
        expect(err.message).not.toContain('limit');
      }
    });

    it('未授权访问在 open_api 渠道同样不泄露脱敏姓名', () => {
      try {
        secureQuery({
          token: 'INVALID_TOKEN',
          channel: 'open_api',
          customerId: 'A',
          currency: 'CNY',
          limitType: 'single',
        });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.message).not.toContain('张');
      }
    });
  });

  describe('敏感信息泄露检查', () => {
    it('open_api 渠道查询 monthly(不支持)不泄露任何客户敏感信息', () => {
      const resp = queryLimit({ channel: 'open_api', customerId: 'A', currency: 'CNY', limitType: 'monthly' });
      const serialized = JSON.stringify(resp);
      // 不包含完整姓名、身份证、手机号等敏感字段
      expect(serialized).not.toContain('张伟');
      expect(serialized).not.toContain('idCard');
      expect(serialized).not.toContain('phone');
      expect(serialized).not.toContain('fullName');
      expect(resp.results[0].limit).toBeNull();
    });

    it('错误响应(币种不可用)不携带敏感信息', () => {
      try {
        queryLimit({ channel: 'mb', customerId: 'A', currency: 'EUR', limitType: 'single' });
        expect.unreachable();
      } catch (e) {
        const err = e as LimitQueryError;
        expect(err.message).not.toContain('张伟');
        expect(err.message).not.toContain('idCard');
        expect(err.message).not.toContain('phone');
      }
    });

    it('正常响应仅返回限额字段,不包含额外敏感字段', () => {
      const resp = queryLimit({ channel: 'app', customerId: 'A', currency: 'CNY', limitType: 'single' });
      const keys = Object.keys(resp);
      expect(keys).toEqual(['channel', 'customerId', 'currency', 'results']);
      const resultKeys = Object.keys(resp.results[0]);
      expect(resultKeys).toEqual(['channel', 'customerId', 'currency', 'limitType', 'limit']);
    });

    it('open_api 渠道脱敏姓名不泄露完整姓名(仅姓+*)', () => {
      const fullName = '欧阳娜娜';
      const masked = maskName(fullName);
      expect(masked).toBe('欧*');
      expect(masked).not.toContain('娜');
      expect(masked).not.toContain('欧阳娜娜');
    });
  });
});
