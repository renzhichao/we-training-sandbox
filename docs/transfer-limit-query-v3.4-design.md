# 转账限额查询接口 v3.4 — 技术设计文档

> 本文档是分析与实现之间的契约。下游实现 agent 应严格按本设计执行,
> 不得擅自增删用例、改动列结构或偏离限额规则。

## Requirement

为银行渠道交易服务中的"转账限额查询 v3.4"接口生成一份四维黑盒测试用例表格
(正常/边界/异常/安全),每维度至少 4 条,输出到 `docs/transfer-limit-query-v3.4-test-cases.md`。

## Approach

采用纯文档交付方式(无代码改动)。在 `docs/` 目录下维护一份 Markdown 测试用例文档,
按"限额规则速查 + 四维表格 + 覆盖说明"三段式组织。四维表格统一使用
`维度/用例编号/优先级/Given/When/Then/预期结果` 七列结构,严格以 Markdown 表格输出。
限额规则以接口文档为准:app(单笔50万/日100万/月500万)、mb(单笔20万/日50万,无月累计)、
mbna(mb 上浮10%:单笔22万/日55万,无月累计)、open_api(单笔1万/日5万,无月累计)。

## Affected Files

- `docs/transfer-limit-query-v3.4-test-cases.md` — 新增/维护测试用例文档。包含:
  1. 限额规则速查表(四渠道 × 三类限额,含 mbna 上浮 10% 与"不支持"标注);
  2. 正常维度表格(≥4 条,覆盖四渠道、三类限额、CNY/USD/HKD 币种);
  3. 边界维度表格(≥4 条,覆盖金额边界 0/0.01/恰好达限/超限1分、渠道边界
     open_api/mb 查 monthly 返回不支持、币种边界 EUR 部分渠道不可用);
  4. 异常维度表格(≥4 条,覆盖必填缺失、长度/枚举非法、客户不存在、渠道无配置);
  5. 安全维度表格(≥4 条,覆盖 open_api 姓名脱敏、horizontal 越权 A 查 B、无效 token);
  6. 覆盖说明(逐维度说明覆盖点)。
- `tests/.gitkeep` — 无改动(本任务为纯文档交付,不涉及测试代码)。
- `README.md` — 无改动。

## Interface Changes

No interface changes. 本任务为测试用例文档交付,不新增/修改任何代码接口、
类型、函数签名、API 端点或数据库 schema。

## Edge Cases

- 金额边界:0、0.01、恰好达限(已用=限额)、超限 1 分(已用=限额+0.01)→ 均须在边界维度覆盖,返回已用/可用额度。
- 渠道边界:open_api 与 mb 显式查询 monthly → 返回"不支持"(HTTP 200 + 业务码标识),而非 400。
- 币种边界:EUR 在部分渠道不可用(app 可用、mb 不可用)→ 不可用渠道返回业务码标识"该币种不可用"。
- 参数缺失:channel、customerId 为必填,缺失返回 HTTP 400。
- 参数长度:customerId 须为 1-20 位,超长/空串返回 HTTP 400。
- 参数枚举:channel(非法值如 web)、currency(非法值如 JPY)、limitType(非法值如 yearly)均返回 HTTP 400。
- 越权:用 A 的 token 查 B 的 customerId → 拒绝并返回 403,不泄露 B 的任何数据(含脱敏姓名)。
- 姓名脱敏:仅 open_api 渠道返回的客户姓名需脱敏(保留姓+*),其他渠道正常返回。

## Acceptance Criteria

- [ ] `docs/transfer-limit-query-v3.4-test-cases.md` 存在且为合法 Markdown。
- [ ] 文档包含"限额规则速查"表,四渠道 × 三类限额数值与接口文档一致
      (app:50万/100万/500万;mb:20万/50万/不支持;mbna:22万/55万/不支持;
      open_api:1万/5万/不支持)。
- [ ] 文档包含四个维度表格(正常/边界/异常/安全),每维度用例数 ≥ 4。
- [ ] 每个表格列严格为:维度/用例编号/优先级/Given/When/Then/预期结果。
- [ ] 正常维度覆盖 app/mb/mbna/open_api 四渠道及 single/daily/monthly 三类限额。
- [ ] 边界维度覆盖金额边界(0、0.01、恰好达限、超限1分)、渠道边界
      (open_api/mb 查 monthly 返回不支持)、币种边界(EUR 部分渠道不可用)。
- [ ] 异常维度覆盖必填缺失、customerId 长度(1-20)、channel/currency/limitType 枚举非法、
      客户不存在、渠道无配置。
- [ ] 安全维度覆盖 open_api 姓名脱敏(仅保留姓+*)、horizontal 越权(A 的 token 查 B 返回 403)、
      无效 token 返回 401。
- [ ] 文档末尾含"覆盖说明",逐维度说明覆盖点。
