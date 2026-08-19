/**
 * 转账限额查询 v3.4 — 限额规则参考实现
 *
 * 仅用于测试用例验证,非生产代码。规则以接口文档为准:
 *   app      : 单笔50万 / 日100万 / 月500万
 *   mb       : 单笔20万 / 日50万  / 月累计不支持
 *   mbna     : 单笔22万 / 日55万  / 月累计不支持 (mb 上浮 10%)
 *   open_api : 单笔1万  / 日5万   / 月累计不支持
 */

export type Channel = 'app' | 'mb' | 'mbna' | 'open_api';
export type Currency = 'CNY' | 'USD' | 'HKD' | 'EUR';
export type LimitType = 'single' | 'daily' | 'monthly';

export interface LimitConfig {
  single: number;
  daily: number;
  monthly: number | null; // null 表示该渠道不支持月累计
}

const CHANNEL_LIMITS: Record<Channel, LimitConfig> = {
  app: { single: 500_000, daily: 1_000_000, monthly: 5_000_000 },
  mb: { single: 200_000, daily: 500_000, monthly: null },
  mbna: { single: 220_000, daily: 550_000, monthly: null },
  open_api: { single: 10_000, daily: 50_000, monthly: null },
};

/** 币种可用性:app 支持 CNY/USD/HKD/EUR;mb/mbna/open_api 仅支持 CNY/USD/HKD */
const CHANNEL_CURRENCIES: Record<Channel, Currency[]> = {
  app: ['CNY', 'USD', 'HKD', 'EUR'],
  mb: ['CNY', 'USD', 'HKD'],
  mbna: ['CNY', 'USD', 'HKD'],
  open_api: ['CNY', 'USD', 'HKD'],
};

export const CHANNELS: Channel[] = ['app', 'mb', 'mbna', 'open_api'];
export const LIMIT_TYPES: LimitType[] = ['single', 'daily', 'monthly'];
export const CURRENCIES: Currency[] = ['CNY', 'USD', 'HKD', 'EUR'];

export interface QueryParams {
  channel: Channel;
  customerId: string;
  currency: Currency;
  limitType?: LimitType; // 缺省时查询全部
}

export interface LimitResult {
  channel: Channel;
  customerId: string;
  currency: Currency;
  limitType: LimitType;
  limit: number | null; // null 表示该渠道不支持该限额类型
}

export interface QueryResponse {
  channel: Channel;
  customerId: string;
  currency: Currency;
  results: LimitResult[];
}

export class LimitQueryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'LimitQueryError';
  }
}

/**
 * 校验 customerId 长度(1-20 位)。
 */
export function validateCustomerId(customerId: string): void {
  if (customerId === undefined || customerId === null || customerId === '') {
    throw new LimitQueryError('customerId 不能为空', 400, 'PARAM_REQUIRED');
  }
  if (customerId.length < 1 || customerId.length > 20) {
    throw new LimitQueryError('customerId 长度须为 1-20 位', 400, 'PARAM_LENGTH');
  }
}

/**
 * 校验 channel 枚举。
 */
export function validateChannel(channel: Channel): void {
  if (!CHANNELS.includes(channel)) {
    throw new LimitQueryError('channel 取值非法', 400, 'PARAM_ENUM');
  }
}

/**
 * 校验 currency 枚举。
 */
export function validateCurrency(currency: Currency): void {
  if (!CURRENCIES.includes(currency)) {
    throw new LimitQueryError('currency 取值非法', 400, 'PARAM_ENUM');
  }
}

/**
 * 校验 limitType 枚举(可选)。
 */
export function validateLimitType(limitType?: LimitType): void {
  if (limitType !== undefined && !LIMIT_TYPES.includes(limitType)) {
    throw new LimitQueryError('limitType 取值非法', 400, 'PARAM_ENUM');
  }
}

/**
 * 查询客户在某渠道的转账限额。
 *
 * - limitType 缺省时返回该渠道全部限额类型。
 * - 某渠道不支持的限额类型(如 mb 的 monthly)返回 limit=null。
 * - 币种在渠道不可用时抛错。
 */
export function queryLimit(params: QueryParams): QueryResponse {
  validateChannel(params.channel);
  validateCurrency(params.currency);
  validateLimitType(params.limitType);
  validateCustomerId(params.customerId);

  const config = CHANNEL_LIMITS[params.channel];

  if (!CHANNEL_CURRENCIES[params.channel].includes(params.currency)) {
    throw new LimitQueryError(
      `该币种在 ${params.channel} 渠道不可用`,
      200,
      'CURRENCY_NOT_SUPPORTED',
    );
  }

  const types: LimitType[] = params.limitType ? [params.limitType] : LIMIT_TYPES;

  const results: LimitResult[] = types.map((limitType) => {
    let limit: number | null;
    switch (limitType) {
      case 'single':
        limit = config.single;
        break;
      case 'daily':
        limit = config.daily;
        break;
      case 'monthly':
        limit = config.monthly;
        break;
    }
    return { channel: params.channel, customerId: params.customerId, currency: params.currency, limitType, limit };
  });

  return {
    channel: params.channel,
    customerId: params.customerId,
    currency: params.currency,
    results,
  };
}
