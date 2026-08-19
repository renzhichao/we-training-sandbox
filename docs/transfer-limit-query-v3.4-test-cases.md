# 转账限额查询接口 v3.4 — 黑盒测试用例

> 接口:转账限额查询 v3.4
> 功能:查询客户在各渠道的转账限额,支持单笔/日累计/月累计三类限额。
> 测试维度:正常 / 边界 / 异常 / 安全(每维度至少 4 条)。

## 限额规则速查

| 渠道 | 单笔 | 日累计 | 月累计 |
|------|------|--------|--------|
| app | 50万 | 100万 | 500万 |
| mb | 20万 | 50万 | 不支持(缺省查全部时仅返回单笔+日累计) |
| mbna | 22万(20万×1.1) | 55万(50万×1.1) | 不支持 |
| open_api | 1万 | 5万 | 不支持(显式查 monthly 返回"不支持") |

> 注:mbna 在 mb 基础上全部上浮 10%(单笔 20万→22万,日累计 50万→55万)。
> 币种边界:EUR 在部分渠道不可用。

---

## 一、正常维度

| 维度 | 用例编号 | 优先级 | Given | When | Then | 预期结果 |
|------|----------|--------|-------|------|------|----------|
| 正常 | N-01 | P0 | 客户 A 在 app 渠道有有效限额配置,currency=CNY | 调用查询接口,channel=app,customerId=A,currency=CNY,limitType 缺省 | 返回 app 渠道全部限额 | 返回单笔=500000、日累计=1000000、月累计=5000000,HTTP 200 |
| 正常 | N-02 | P0 | 客户 A 在 mb 渠道有有效限额配置,currency=CNY | 调用查询接口,channel=mb,customerId=A,currency=CNY,limitType=daily | 返回 mb 渠道日累计限额 | 返回日累计=500000,HTTP 200 |
| 正常 | N-03 | P1 | 客户 A 在 mbna 渠道有有效限额配置,currency=CNY | 调用查询接口,channel=mbna,customerId=A,currency=CNY,limitType=single | 返回 mbna 渠道单笔限额 | 返回单笔=220000(mb 20万上浮 10%),HTTP 200 |
| 正常 | N-04 | P1 | 客户 A 在 open_api 渠道有有效限额配置,currency=CNY | 调用查询接口,channel=open_api,customerId=A,currency=CNY,limitType=single | 返回 open_api 渠道单笔限额 | 返回单笔=10000,HTTP 200 |
| 正常 | N-05 | P1 | 客户 A 在 app 渠道,currency=USD | 调用查询接口,channel=app,customerId=A,currency=USD,limitType=monthly | 返回 app 渠道月累计限额 | 返回月累计=5000000(USD),HTTP 200 |
| 正常 | N-06 | P2 | 客户 A 在 app 渠道,currency=HKD | 调用查询接口,channel=app,customerId=A,currency=HKD,limitType=single | 返回 app 渠道单笔限额 | 返回单笔=500000(HKD),HTTP 200 |

---

## 二、边界维度

| 维度 | 用例编号 | 优先级 | Given | When | Then | 预期结果 |
|------|----------|--------|-------|------|------|----------|
| 边界 | B-01 | P1 | 客户 A 在 app 渠道,currency=CNY | 查询 app 渠道单笔限额,当前单笔已用额度=500000(恰好达限) | 返回限额及已用额度 | 返回单笔限额=500000、已用=500000、可用=0,HTTP 200 |
| 边界 | B-02 | P1 | 客户 A 在 app 渠道,currency=CNY | 查询 app 渠道单笔限额,当前单笔已用额度=500001(超限 1 分) | 返回限额及已用额度 | 返回单笔限额=500000、已用=500001、可用=-1(超限),HTTP 200 |
| 边界 | B-03 | P2 | 客户 A 在 mb 渠道,currency=CNY | 查询 mb 渠道日累计限额,当前已用=0 | 返回日累计限额 | 返回日累计=500000、已用=0、可用=500000,HTTP 200 |
| 边界 | B-04 | P2 | 客户 A 在 mb 渠道,currency=CNY | 查询 mb 渠道日累计限额,当前已用=0.01 | 返回日累计限额 | 返回日累计=500000、已用=0.01、可用=499999.99,HTTP 200 |
| 边界 | B-05 | P1 | 客户 A 在 open_api 渠道,currency=CNY | 调用查询接口,channel=open_api,limitType=monthly | 返回月累计限额 | 返回"不支持"(该渠道不支持月累计限额),HTTP 200(业务码标识不支持) |
| 边界 | B-06 | P2 | 客户 A 在 mb 渠道,currency=CNY | 调用查询接口,channel=mb,limitType=monthly | 返回月累计限额 | 返回"不支持"(mb 渠道不支持月累计),HTTP 200(业务码标识不支持) |
| 边界 | B-07 | P2 | 客户 A 在 app 渠道,currency=EUR | 调用查询接口,channel=app,customerId=A,currency=EUR,limitType=single | 返回 app 渠道 EUR 单笔限额 | 返回单笔限额(EUR 在 app 渠道可用),HTTP 200 |
| 边界 | B-08 | P2 | 客户 A 在 mb 渠道,currency=EUR | 调用查询接口,channel=mb,customerId=A,currency=EUR,limitType=single | 返回 mb 渠道 EUR 单笔限额 | 返回"该币种在 mb 渠道不可用"(EUR 在部分渠道不可用),HTTP 200(业务码标识不可用) |

---

## 三、异常维度

| 维度 | 用例编号 | 优先级 | Given | When | Then | 预期结果 |
|------|----------|--------|-------|------|------|----------|
| 异常 | E-01 | P0 | 请求缺少 channel 参数 | 调用查询接口,不传 channel | 校验必填参数 | 返回参数错误:channel 必填,HTTP 400 |
| 异常 | E-02 | P0 | 请求缺少 customerId 参数 | 调用查询接口,不传 customerId | 校验必填参数 | 返回参数错误:customerId 必填,HTTP 400 |
| 异常 | E-03 | P1 | customerId 长度超过 20 位 | 调用查询接口,customerId=21 位字符串 | 校验 customerId 长度 | 返回参数错误:customerId 长度须为 1-20 位,HTTP 400 |
| 异常 | E-04 | P1 | customerId 为空字符串 | 调用查询接口,customerId="" | 校验 customerId 非空 | 返回参数错误:customerId 不能为空,HTTP 400 |
| 异常 | E-05 | P1 | channel 取值非法 | 调用查询接口,channel=web(不在 app/mb/mbna/open_api 中) | 校验 channel 枚举 | 返回参数错误:channel 取值非法,HTTP 400 |
| 异常 | E-06 | P1 | currency 取值非法 | 调用查询接口,currency=JPY(不在 CNY/USD/EUR/HKD 中) | 校验 currency 枚举 | 返回参数错误:currency 取值非法,HTTP 400 |
| 异常 | E-07 | P2 | limitType 取值非法 | 调用查询接口,limitType=yearly(不在 single/daily/monthly 中) | 校验 limitType 枚举 | 返回参数错误:limitType 取值非法,HTTP 400 |
| 异常 | E-08 | P2 | 客户 A 在系统中不存在 | 调用查询接口,channel=app,customerId=不存在的客户 | 查询客户限额 | 返回"客户不存在",HTTP 404 |
| 异常 | E-09 | P2 | 客户 A 在 app 渠道无任何限额配置 | 调用查询接口,channel=app,customerId=A,limitType 缺省 | 查询该渠道限额 | 返回"该渠道无限额配置",HTTP 200(业务码标识无配置) |

---

## 四、安全维度

| 维度 | 用例编号 | 优先级 | Given | When | Then | 预期结果 |
|------|----------|--------|-------|------|------|----------|
| 安全 | S-01 | P0 | 客户 A 持有有效 token | 调用查询接口,channel=open_api,customerId=A | 返回 open_api 渠道限额及客户姓名 | 返回客户姓名脱敏(仅保留姓+*,如"张*"),不返回完整姓名 |
| 安全 | S-02 | P0 | 客户 A 持有有效 token | 调用查询接口,channel=app,customerId=B(客户 B 的 ID) | 校验 horizontal 越权 | 拒绝访问,返回 403 越权错误,不返回 B 的任何限额数据 |
| 安全 | S-03 | P0 | 客户 A 持有有效 token | 调用查询接口,channel=mb,customerId=B(客户 B 的 ID) | 校验 horizontal 越权 | 拒绝访问,返回 403 越权错误 |
| 安全 | S-04 | P1 | 客户 A 持有有效 token | 调用查询接口,channel=open_api,customerId=B(客户 B 的 ID) | 校验 horizontal 越权 | 拒绝访问,返回 403 越权错误,且不泄露 B 的脱敏姓名 |
| 安全 | S-05 | P1 | 客户 A 持有有效 token | 调用查询接口,channel=app,customerId=A,limitType 缺省 | 返回 app 渠道全部限额 | 返回限额数据,且客户姓名(如有)在 app 渠道正常返回(非 open_api 不脱敏) |
| 安全 | S-06 | P2 | 请求携带过期/无效 token | 调用查询接口,channel=app,customerId=A | 校验 token 有效性 | 返回 401 未认证,不返回任何限额数据 |
| 安全 | S-07 | P2 | 客户 A 持有有效 token | 调用查询接口,channel=open_api,customerId=A,limitType=monthly | 返回 open_api 渠道月累计限额 | 返回"不支持",且不泄露任何客户敏感信息 |

---

## 覆盖说明

- **正常维度**:覆盖 app/mb/mbna/open_api 四渠道、三类限额(single/daily/monthly)及 CNY/USD/HKD 币种。
- **边界维度**:覆盖金额边界(0、0.01、恰好达限、超限 1 分)、渠道边界(open_api/mb 查 monthly 不支持)、币种边界(EUR 部分渠道不可用)。
- **异常维度**:覆盖必填参数缺失、参数长度/枚举非法、客户不存在、渠道无配置。
- **安全维度**:覆盖 open_api 姓名脱敏、horizontal 越权(A 查 B)、无效 token。
