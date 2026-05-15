# MiMo Balance Checker 🔍

小米 MiMo 开放平台余额 & 账单查询命令行工具。

![Shell](https://img.shields.io/badge/Shell-sh-green)
![Python](https://img.shields.io/badge/Python-3.6+-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 功能

- 🎫 **Token Plan** — 套餐状态、额度用量、进度条
- 💰 **按量付费余额** — 总余额 / 现金 / 赠送
- 📊 **按量付费概览** — 累计消费 / Token 使用量
- 📅 **月度每日消费** — 按日汇总消费金额和请求次数
- 🔧 **JSON 输出** — 便于脚本集成

它解决的是一个很窄的问题：不用打开控制台，也能快速知道 MiMo 账户余额、套餐额度和本月消耗。对应 plotloop 的原则是 **Trace > Magic**：关键资源消耗要能随手查、能自动化、能被别的工具接上。

## 快速开始

### 1. 依赖

- `sh` (POSIX shell)
- `curl`
- `python3` (3.6+)

### 2. 获取 Cookie

1. 在浏览器中登录 [MiMo 开放平台](https://platform.xiaomimimo.com)
2. `F12` → **Network** → 点击任意 API 请求
3. **Headers** → **Request Headers** → 复制 `Cookie` 值

### 3. 配置

```bash
# 方式 A: 环境变量
export MIMO_COOKIE='userId=xxx; api-platform_serviceToken=xxx; ...'

# 方式 B: .env 文件
cp .env.example .env
# 编辑 .env

# 方式 C: 命令行
./mimo-checker.sh --cookie '...'
```

> 安全提示：Cookie 等同于登录凭据，不要提交 `.env`，也不建议长期把 Cookie 写进 shell history。发布到 GitHub 前建议保留 `.env.example`，并用仓库根目录的 `.gitignore` 忽略真实 `.env`。

### 4. 运行

```bash
./mimo-checker.sh              # 全部信息
./mimo-checker.sh -t           # 仅 Token Plan
./mimo-checker.sh -p           # 仅按量付费
./mimo-checker.sh -m 4         # 查询 4 月
./mimo-checker.sh -a           # 显示全部日期
./mimo-checker.sh -j           # JSON 输出
```

### 5. 手机触发

iOS Shortcuts 里可以用 **Run Script Over SSH** 调用这段脚本。推荐把 Cookie 放在远端机器的 `~/.mimo-checker.env`，Shortcut 只执行：

```bash
cd /path/to/plotloop/scripts/mimo-balance && ./mimo-checker.sh -j
```

这样手机端不需要保存 Cookie，也方便把 JSON 接到通知、备忘录或其他自动化。

## 输出示例

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 MiMo 账户信息   2026年5月
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎫 Token Plan
  套餐       Standard
  状态       🟢 生效中
  有效期至   2026-05-28 23:59:59 (UTC)
  自动续费   关闭

  本月额度   200.0M / 200.0M
  ██████████████████████████████ 100.0%
  ⚠️  本月额度已耗尽！

💰 按量付费 - 余额
  总余额     ¥      19.06
  ├ 现金     ¥       0.00
  └ 赠送     ¥      19.06

📅 按量付费 - 2026年5月 每日消费
  2026-05-13  ¥     0.80  █      3次
  2026-05-14  ¥     3.18  █████  15次
  2026-05-15  ¥    17.39  ██████████████████████████████  471次
  ───────────────────────────────────────────────────────
  本月合计  ¥     24.66
```

## 命令行参数

| 参数 | 说明 |
|------|------|
| `-y, --year YEAR` | 查询年份 |
| `-m, --month MONTH` | 查询月份 |
| `-a, --all` | 显示全部日期（含无消费日） |
| `-t, --token-plan` | 仅显示 Token Plan |
| `-p, --pay-as-you-go` | 仅显示按量付费 |
| `-j, --json` | JSON 输出 |
| `--cookie COOKIE` | 指定 Cookie |
| `-h, --help` | 帮助 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/balance` | GET | 按量付费余额 |
| `/api/v1/usage` | GET | 按量付费用量概览 |
| `/api/v1/usage/detail/list` | POST | 月度每日明细 |
| `/api/v1/tokenPlan/detail` | GET | Token Plan 套餐详情 |
| `/api/v1/tokenPlan/usage` | GET | Token Plan 额度用量 |

> ⚠️ 这些 API 未经官方文档确认，可能随时变更。

## 发布前检查

- 仓库根目录需要有 `.gitignore`，至少忽略 `.env` 和 `.DS_Store`
- `mimo-checker.sh` 需要可执行权限：`chmod +x mimo-checker.sh`
- 不要提交真实 Cookie、控制台截图里的 Cookie、或包含账号信息的输出
- 这些 API 未经官方文档确认，建议把兼容性风险写在 README 中

## License

[MIT](../../LICENSE)
