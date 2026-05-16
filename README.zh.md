<p align="center">
  <img src="./assets/logo.svg" alt="plotloop" width="575">
</p>

<p align="center">
  <strong>设计 loop，改变你进化的方式。</strong><br>
  <em>Plot your loop.</em>
</p>

一个围绕 **Agent、Skill、脚本与方法论** 的工坊——用来重写"我们工作的方式"。围绕三个信念展开：

1. **Mobile-first AI** — 下一代 AI 的入口是兜里的手机，不是工位上的电脑
2. **OPC（一人公司）** — 一个人 + 一队 Agent，是新的生产单元
3. **AI 原生组织** — 改变 loop，就改变组织

---

## 为什么叫 plotloop？

两年前的 Coze 黑客松，我做过一个叫 **storyplot** 的小项目——把故事 plot 出来。两年过去，故事还在继续 plot，但加入了一个新的认知：

> **不要努力进化，要改造进化的环境。**

那个环境，就是一个 **loop**。在 AI 时代，**设计一个 loop、把它画出来、让它自动跑起来**的成本，已经被打到地板上。

`plotloop` 就是这些 loop 被设计、被 plot、被发布的工坊。

---

## 仓库结构

| 目录 | 内容 |
|---|---|
| [`agents/`](./agents) | 完整可跑、可观测的 Agent 工作流 |
| [`skills/`](./skills) | 即插即用的 Claude Code Skill 和通用能力 |
| [`scripts/`](./scripts) | 单文件、解决一个具体问题的脚本 |
| [`workflows/`](./workflows) | 案例库：一条线性流程是怎么被改写成 loop 的 |
| [`docs/`](./docs) | 方法论、灵感来源、长文思考 |

每个子目录都有自己的 README，任何入口进入都自洽。

---

## Quickstart

仓库的第一个 artifact 是 **`scripts/mimo-balance/`**——小米 MiMo 开放平台余额 & 账单查询工具（POSIX shell + curl + python3）。刻意做得很小，把仓库所有原则压进一个目录里。

```bash
cd scripts/mimo-balance
cp .env.example .env       # 填入 MIMO_COOKIE
./mimo-checker.sh          # 全量报告
```

想在手机上跑？看子目录 README，里面有一份 iOS Shortcut 一键配方。

---

## 核心原则

详见 [`PRINCIPLES.md`](./PRINCIPLES.md)。精简版：

1. **Loop over Linear** — 能做成 loop 的事，不做成线性脚本
2. **Mobile-first** — 每个 artifact 都应该能在手机上触达
3. **Cheap & Composable** — 小、便宜、可组合 > 大而全
4. **OPC-Ready** — 一人跑不通的复杂度，就是错的复杂度
5. **Show, Don't Tell** — 每个 artifact 必须有真实运行案例
6. **Trace > Magic** — 可观测 > 所谓"智能"

---

## 灵感来源

- **Boris Cherny** 关于 Agentic Loop 的演讲（给我正在做的事命了名）

完整 running list 见 [`docs/inspirations/`](./docs/inspirations)。

---

## License

MIT。拿走有用的，改掉没用的。

---

> Maintained by [@rk](https://github.com/)
> English: [README.md](./README.md)
