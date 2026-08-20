# Future With You

Future With You 是一份可以装进手机里的情侣礼物。V0.4.0 把原有的愿望、约会灵感、每日问答和时间胶囊，扩展成一套会持续生长的“共同故事宇宙”。

> `main` 当前包含已验证的 `0.5.0-dev.6`（Alpha 2 海外基线）；`dev` 已进入 `0.5.0-dev.7`（Alpha 3 中国大陆链路）。Alpha 3 为同一套账号、资料、情侣空间和一次性邀请码增加 CloudBase PG 适配；本地故事不会在本阶段上传。完整设计见 [V0.5.0 双人云端版架构](docs/V0.5.0_ARCHITECTURE.md)。

V0.5 使用同一份 React PWA 支持两个部署入口：Vercel + Supabase 是海外基线，CloudBase 静态托管 + CloudBase PG 是大陆候选。每个构建只能选择一个权威后端，绝不跨云双写。

海外配置见 [Supabase 开通清单](docs/ALPHA2_SUPABASE_RUNBOOK.md)；大陆测试环境、Git 发布、验证码与双设备验收见 [CloudBase 开通清单](docs/ALPHA3_CLOUDBASE_RUNBOOK.md)，本轮范围与回滚边界见 [Alpha 3 Release Notes](docs/ALPHA3_RELEASE_NOTES.md)。

## 怎么交给她

她不需要安装 Node.js、npm、Python，也不需要拿到源代码。

1. 开发者把通过评审的 `main` 分支发布到 HTTPS 网站（当前仓库已关联 Vercel 项目）。
2. 把正式网站链接发给她。
3. 她直接用手机浏览器打开；Android 可选择“安装应用”，iPhone Safari 可选择“分享 → 添加到主屏幕”。

`dist/` 是浏览器可以直接运行的静态网站产物。开发环境只用于写代码和打包，不会成为她使用 App 的前置条件。

## V0.4.0 的核心体验

### 我们的故事

同一段回忆只保存一次，但可以用三种方式重新遇见：

- 爱情时间轴：从纪念日起点、共同回忆和“此刻”，一路延伸到写给未来的时间胶囊。
- 我们的宇宙：每段回忆是一颗位置稳定的星；珍藏回忆会成为更明亮的大星星。
- 恋爱博物馆：照片、聊天截图、礼物和故事成为只为两个人开放的私人展品。
- 那年今日：首页会在相同月日唤起往年的一段回忆。

### 回忆如何产生

- 手动点击故事页的“＋”，录入日期、地点、类型、文字、标签和一张封面。
- 在愿望页把一件事标记为完成时，会自动生成一段与该愿望关联的回忆。
- 编辑关联回忆后，收藏页、时间轴、星空和博物馆会一起更新。
- 手动回忆可以删除；愿望生成的回忆需先在收藏页“恢复待做”，避免完成状态与故事互相矛盾。
- 可将最重要的回忆设为“珍藏展品”，优先出现在博物馆并成为更醒目的星。

### 已有功能

- 30 条内置愿望，覆盖日常、冒险、心动、成长和我们的家。
- 她来指定 / 我来指定：新增自定义愿望、计划日期、地点偏好和时长。
- 约会灵感机：结合 30+ 约会点子与尚未完成的自定义愿望随机决定今晚做什么。
- 收藏、完成状态、完成日期、回忆文字与照片。
- 每日问题与两个人分别作答。
- 情侣昵称、纪念日、首页情话和共同天数。
- 写给未来的时间胶囊，到期后才可打开。
- #∞ 隐藏愿望、浪漫粒子、花瓣、柔光和庆祝动画。
- 完整 JSON 备份与恢复。
- PWA manifest、离线 App Shell 与主屏幕安装入口。

## 数据、迁移与隐私

V0.4.0 仍是 local-first 单设备版本：

- 数据保存在当前浏览器的 `localStorage`，不会自动上传。
- V0.2 / V0.3 的已完成愿望会自动迁移成 V0.4 的统一回忆，不需要重新录入。
- 迁移后照片与文字只在回忆实体中保存一份，避免重复占用浏览器空间。
- 换浏览器、清理网站数据、卸载 PWA 或更换域名前，请先在“我们 → 数据保险箱”下载完整备份。
- 备份文件含私人文字与照片，只应保存在自己的设备或可信云盘。

两台手机实时同步、共同账号、推送和云端相册不在 V0.4.0 中。它们需要一个真实的后端项目、数据库、鉴权策略和部署密钥；本仓库当前没有这些外部凭据，因此不会用“看似同步”的本地功能冒充云服务。

## 本地开发

项目绝对路径：

```text
D:\Download\gaming\new_program\data_helper\27_qqj_lover
```

需要 Node.js 18 或更高版本：

```powershell
cd D:\Download\gaming\new_program\data_helper\27_qqj_lover
npm ci
npm run dev
```

开发地址通常为 <http://localhost:5173>。

## 构建与回归

```powershell
npm run test:v050
npm run test:alpha2
npm run test:alpha3
npm run build
npm run preview
```

另开一个终端执行移动端回归：

```powershell
npm run test:mobile -- http://127.0.0.1:4173
```

该回归覆盖：

- V0.3 状态迁移到 V0.4。
- 已完成愿望生成统一回忆。
- 时间轴、星空和博物馆均能展示同一回忆。
- 真实表单可新增珍藏回忆，并在博物馆中优先展示。
- 完整备份为状态版本 3 且 SHA-256 校验正确。
- 390px 手机视口与低高度软键盘场景下，弹窗可滚动且提交按钮可达。

## 发布流程

1. 所有 V0.5 修改提交到 `dev` 并推送，测试部署不得代替正式发布。
2. 创建 `dev → main` Pull Request。
3. 由代码审查者检查 Release Note、变更和回归结果。
4. 审查者手动合并；只有 `main` 才进入 Vercel / CloudBase 正式发布流程。
5. 将 HTTPS 正式链接发给她安装。

本流程不会由开发代理自动合并 `main` 或点击生产发布。

## 项目结构

- `src/app`：应用入口、页面编排和跨功能联动。
- `src/cloud`：Supabase / CloudBase 账号与情侣空间适配器、风险验证码桥接。
- `backend/cloudbase-pg`：CloudBase PG 基础 schema 与 RPC 安全加固迁移。
- `scripts/alpha3-mainland-check.mjs`：大陆后端、密钥边界、分支门禁与版本回归。
- `src/features/story`：时间轴、回忆星空和恋爱博物馆。
- `src/features/today`：首页、那年今日、约会灵感和每日问题。
- `src/features/wishes`：愿望浏览与共同创造。
- `src/features/collection`：待做愿望和已经实现的愿望。
- `src/features/together`：情侣资料、时间胶囊、备份、安装与设置。
- `src/domain`：愿望、进度、回忆和应用状态模型。
- `src/storage`：localStorage 适配、校验和版本迁移。
- `src/styles/story.css`：V0.4 故事宇宙的移动端视觉与动效。
- `scripts/mobile-modal-regression.mjs`：真实 Chromium 移动端回归。
- `public`：PWA manifest、图标和离线缓存。
