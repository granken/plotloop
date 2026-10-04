---
name: plotloop-align-host
description: plotloop 对齐会主持人。把一份"需求方 vs 研发"的分歧清单做成会议主持视频：一个分歧一屏、讲完自动暂停、分节进度条可跳转，配网页播放控制台和会后录音回填提示词。用户说"做个主持视频/让视频主持对齐会/把讨论包做成视频/对抗对齐会"时使用。依赖 qiaomu-cut 渲染与配音。
---

# plotloop 对齐会主持人 · plotloop-align-host

让一段视频主持需求对齐会。视频负责节奏和不漏项，人负责做决定，录音负责留证据。

> 方法背景、为什么这样做、实战数据：见 `references/method.md`。第一次用先读它。

## 什么时候用

- 手上有一份分歧清单（问题包 / 讨论包 / 对抗审计稿），要开会逐项定结论；
- 条目 ≥ 5 项，或者参会方 ≥ 3 个角色，靠人主持容易跑题漏项；
- 会后要把结论回写进需求文档、开发计划或测试用例。

不适合：只有一两个问题的短会；需要发散讨论、没有清单的会。

## 依赖

| 依赖 | 用途 | 检查 |
|---|---|---|
| [qiaomu-cut](https://github.com/joeseesun/qiaomu-cut-skill) | HTML 场景渲染、配音、合成 | `node ~/.claude/skills/qiaomu-cut/scripts/qcut.js doctor` |
| ffmpeg | 静音检测、混音、章节写入 | `command -v ffmpeg` |
| 一个 TTS 服务 | 旁白配音（qiaomu-cut 支持的任一 provider） | 见 qiaomu-cut 文档；**密钥只放环境变量** |
| Node ≥ 18 | 构建脚本 | `node -v` |

## 工作流

每一步都有产物，失败了只重做那一步。

### 0. 收清单，定口径（先问清楚，别猜）

向用户确认：
1. 分歧清单在哪（md / csv / json 都行）；
2. 会议时长上限、分几节；
3. **哪些事项已经定过、本次不再投票**（写进开场规则）；
4. 结论口令用什么编号体系（默认 `A07`）；
5. 是否已有上一版视频——有就走"增量模式"（第 8 节）。

### 1. 规整成 agenda.json

把清单整理成 `agenda.json`，格式见 `references/agenda-format.md`，入门示例 `examples/quickstart.food-order.json`，展示示例 `examples/showcase.ride-hailing.json`。

```bash
node scripts/build.js init --project DIR --agenda agenda.json   # 建工程（qiaomu-cut scaffold）
node scripts/validate_agenda.js DIR/agenda.json
```

校验器会检查：编号唯一、节存在、挑战题挂到存在的条目、五要素齐全、单屏字数过长、各节分钟数合计与会议时长是否吻合。**有 error 不往下走。**

🔴 `fix`（建议修法）只能是建议。屏幕上会标"建议，非共识"，旁白也不能说成"决定"。

### 2. 写旁白 → `script/lines.tsv`

按 `references/narration-guide.md` 写，一行一段：`id<TAB>kind<TAB>section<TAB>minutes<TAB>text`。要点：

- 编号写口语（"A零七"），字幕自动换回 `A07`；
- 每个条目以"请暂停，……"结尾，说清本次要定什么；
- 按每秒约 6 个字估时长，20 项的会大约 11–12 分钟视频。

写完给用户过目再配音——旁白是会上所有人听到的"主持人原话"。然后：

```bash
node scripts/build.js check --project DIR    # 清单校验 + 旁白和清单对不对得上；不通过不配音
```

### 3. 配音

```bash
node scripts/build.js tts --project DIR [--tts volc|listenhub|file] [--voice 音色]
# 逐行合成，文本没变的跳过。file = 自带音频，放 script/audio/<id>.mp3
```

### 4. 测停顿，卡时间轴

```bash
node scripts/build.js analyze --project DIR   # silencedetect → script/timing.json
```

字幕和画面动作卡在句间停顿上，声画就不会错位。

### 5. 生成场景与时间轴

```bash
node scripts/build.js scenes --project DIR     # 每段一个 HTML 场景（scenes/host.js 渲染）
node scripts/build.js timeline --project DIR   # 旁白混音 + 时间轴
node scripts/build.js chapters --project DIR   # MP4 章节 + 播放器用的 out/chapters.json
```

### 6. 草稿 → 终版

```bash
node scripts/build.js draft --project DIR      # 低帧率半分辨率，每段三帧拼成 review/<id>.png
```

看拼图检查排版（溢出、遮挡、字太小），修好再：

```bash
node scripts/build.js final --project DIR      # 后台独立进程全量渲染，完成写 out/.final.done
node scripts/build.js verify --project DIR     # 时长、各段旁白起点、章节数
```

全量渲染按片长计（4 分钟片约 5 分钟，12 分钟片 10 分钟以上），**放后台独立进程跑**，轮询 `out/.final.done`，别挂在前台等超时。

### 7. 播放器 + 会后提示词

```bash
node scripts/build.js player --project DIR     # → out/player.html
node scripts/build.js prompt --project DIR     # → out/post-meeting.md
```

播放器：点小节跳转、到暂停点自动停（可关）、空格 / 方向键。
会后提示词：转写 → 按编号抽口令 → 生成**待确认**回填表 → 人确认后才回写文档。

### 8. 增量模式（清单更新了）

不要重做整片：
- 对比新旧 agenda.json，列出关闭 / 新增 / 改动的条目；
- 开头加一屏"本轮变化"；
- 只重新合成改动的旁白行（`build.js tts` 按文本哈希自动跳过未变的）；
- 重跑 4–7。

### 9. 可选：对外分享物料

脱敏后做 20 秒演示、3:4 图文、9:16 竖版、公开部署。见 `references/share-kit.md`。

## 交付清单

| 文件 | 给谁 |
|---|---|
| `out/align-host.mp4`（带章节） | 会上投屏 |
| `out/player.html` + 视频（同一文件夹） | 会上投屏（推荐，到点自动停） |
| `out/post-meeting.md` | 会后交给 AI |
| `agenda.json` | 存档，下一版增量的基线 |

## 红线

1. **建议 ≠ 决定。** 会上没人明确说同意的，回填表里不能写成决定。
2. **说话人没核对，不写人名。** 宁可写"待确认"。
3. **只回写已确认的。** 没定的保留为阻塞项，不悄悄删；旧口径标"已被 Axx 取代"，不直接删。
4. **视频旁白会被录进会议录音。** 会后整理时先把"主持人提的问题"和"大家定下的结论"分开。
5. 视频和播放器是会议材料，不代表任何条目已实现或已验收。
