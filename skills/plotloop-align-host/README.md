# plotloop 对齐会主持人

`plotloop-align-host`

> 让一段视频主持需求对齐会：一个分歧一屏，讲完自动暂停，会后录音交给 AI 回填。

AI 写代码越来越快，返工的原因变成了"写的不是同一件事"。这个 skill 把"需求方 vs 研发"的分歧清单做成一段会议主持视频和一个网页播放器，配一份会后 AI 处理指令。

**状态：v0.2。** 两个示例都已端到端跑通：打车示例（火山配音）约 4 分钟，订餐示例（自带音频）约 3 分 48 秒，各产出主持视频 + 播放器 + 会后指令。v0.2 新增：排版自动检查（`layout`）、干净静帧导出（`still`）、4K 输出（`scenes --4k`）、英文名字幕计时更准。

**在线演示：** https://plotloop-align-host.pages.dev （打车示例的主持视频 + 播放器，点小节跳转，到暂停点自动停）

## 产出

- 🎬 主持视频：分节、每个分歧一屏、"请暂停视频"、分节进度条 + 暂停点、MP4 章节
- 🖥 网页播放器：点小节跳转、到暂停点自动停、键盘控制
- 📝 会后 AI 处理指令：转写 → 按编号抽结论 → 待确认回填表 → 人确认后回写
- 📣 可选：对外分享物料（20 秒演示、3:4 图文、9:16 竖版）

## 实战

一场 20 个分歧、5 节的对齐会：视频 11 分 42 秒、23 个暂停点；计划 60 分钟，实际 98 分钟，一项没漏。详见 [references/method.md](references/method.md)。

## 快速开始

```bash
node scripts/validate_agenda.js examples/quickstart.food-order.json
```

端到端跑打车示例（需要 qiaomu-cut 和一个配音服务）：

```bash
S=path/to/plotloop-align-host; P=./ride-hailing-demo
node $S/scripts/build.js init --project $P --agenda $S/examples/showcase.ride-hailing.json
cp $S/examples/showcase.ride-hailing.lines.tsv $P/script/lines.tsv
for step in check tts analyze scenes draft timeline chapters player prompt; do node $S/scripts/build.js $step --project $P || break; done
node $S/scripts/build.js final --project $P     # 后台渲染，完成后写 $P/out/.final.done
node $S/scripts/build.js verify --project $P
```

要发 B 站等平台的高清版：`scenes --4k` 之后照常 `timeline` → `final`，出 3840×2160。改过排版先跑 `layout` 自动检查，再看 `draft` 拼图。

没有配音账号也能先跑通：订餐示例用 macOS 自带的中文语音生成音频，再用 `--tts file` 导入（音质一般，只用来试流程）：

```bash
S=path/to/plotloop-align-host; P=./food-order-demo
node $S/scripts/build.js init --project $P --agenda $S/examples/quickstart.food-order.json
cp $S/examples/quickstart.food-order.lines.tsv $P/script/lines.tsv
mkdir -p $P/script/audio
while IFS= read -r line; do   # 按列取，空列不会错位
  id=$(printf '%s' "$line" | cut -f1); text=$(printf '%s' "$line" | cut -f5)
  say -v Tingting --file-format=m4af -o "$P/script/audio/$id.m4a" "$text"
done < $P/script/lines.tsv
node $S/scripts/build.js check --project $P && node $S/scripts/build.js tts --tts file --project $P
for step in analyze scenes draft timeline chapters player prompt; do node $S/scripts/build.js $step --project $P || break; done
node $S/scripts/build.js final --project $P
```

或者直接在 Claude Code 里说："用 plotloop-align-host 把这份分歧清单做成主持视频"。

## 什么时候别用（When this skill is wrong for the job）

- **分歧只有一两条**：直接开个短会更快，做视频不划算。
- **还没有需求文档和研发复述稿**：这个技能比对的是两份已有材料，不负责写需求。
- **要现场即兴讨论、不按议程走**：视频的节奏是固定的，适合按清单过分歧，不适合头脑风暴。
- **分歧涉及敏感信息**：旁白会发给云端配音服务，敏感内容请用 `--tts file` 在本地配音。

## 依赖

- [qiaomu-cut](https://github.com/joeseesun/qiaomu-cut-skill)（向阳乔木，MIT）——渲染与配音
- ffmpeg、Node ≥ 18
- 配音三选一：火山（`--tts volc`）、ListenHub（`--tts listenhub`，尚未实测）、自带音频（`--tts file`，放 `script/audio/<id>.mp3|wav|m4a`）。密钥只放环境变量

## 目录

```
SKILL.md                    Agent 工作流
references/
  method.md                 方法与实战数据
  agenda-format.md          清单格式
  narration-guide.md        旁白写法
  post-meeting-prompt.md    会后 AI 处理模板
  share-kit.md              对外分享物料
examples/
  quickstart.food-order.json  入门示例：订餐 App，4 个分歧 + 1 道挑战题
  quickstart.food-order.lines.tsv  入门示例的旁白
  showcase.ride-hailing.json 展示示例：打车 App，5 个分歧 + 1 道挑战题
  showcase.ride-hailing.lines.tsv  展示示例的旁白
scripts/
  validate_agenda.js        清单校验 ✅
  inspect.js                排版检查 + 静帧导出 ✅
  build.js                  构建流水线 ✅
  analyze.js                旁白停顿测量 ✅
  lib.js                    共用：路径、工具、分段计划
scenes/                     场景渲染器 ✅
templates/
  player.html               网页播放器 ✅
  pages-range-middleware.js Cloudflare Pages 视频 Range 补丁 ✅
```

Part of [plotloop](https://github.com/granken/plotloop). MIT License.
