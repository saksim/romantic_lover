# V0.5.0-dev.9 — Alpha 3 中国大陆候选

状态：Draft / `dev → main` PR 候选
范围：账号、个人资料、情侣空间、一次性邀请码和大陆部署链路
不在范围：愿望、回忆、每日问答、纪念日、照片迁移与实时同步

## 本轮结果

- 同一份 React PWA 可在构建时选择 `local`、`supabase` 或 `cloudbase-pg`。
- CloudBase Web SDK v3 支持邮箱密码注册、邮箱 OTP 确认、密码登录、会话保持与退出。
- CloudBase 风控要求验证码时，会在现有手机弹窗内呈现图片验证码，可刷新并完成验证。
- CloudBase 自定义验证码适配器现在同时保留有界 Web 请求、浏览器存储和 WebSocket 能力；Auth 请求不会再无限等待。
- 云端动态模块未加载成功时，注册入口会被阻止并提供重新连接；邮箱验证码请求会显示明确进度和超时错误。
- 情侣空间创建现在具备服务端幂等锁；超时、丢失响应或连续点击后重试会返回已创建空间，不再误报“已经加入”。
- 客户端会恢复旧 RPC 已成功写入的空间，并以同步操作锁阻止同一设备重复提交。
- 个人资料、创建情侣空间、生成一次性邀请码、加入和退出均由 CloudBase PG 网关实现。
- 高权限情侣 RPC 在函数内部验证 JWT `authenticated` 角色，避免 CloudBase PostgREST RPC 绕过 `GRANT EXECUTE` 的风险。
- `dev` 只对应测试部署，`main` 只在 PR 评审与人工批准后进入正式发布。
- GitHub Actions 对 `dev` push 和指向 `main` 的 PR 执行基础、Alpha 2、Alpha 3 与生产构建门禁。

## 数据安全边界

- 一个情侣空间只能选择一个权威后端，不进行 Supabase / CloudBase 跨云双写。
- 本机愿望、回忆与照片不会在 Alpha 3 静默上传、覆盖或删除。
- 浏览器只使用 Publishable Key；Secret Key、管理员密钥和服务端密钥不得进入 Git 或 `VITE_*`。
- `dist/` 仍只包含前端代码，不保存用户数据。

## 性能边界

CloudBase SDK 仅在 `VITE_BACKEND_PROVIDER=cloudbase-pg` 时动态下载。默认应用入口约 275 kB（gzip 约 88 kB）；CloudBase 独立动态块约 755 kB（gzip 约 192 kB）。当前保留大块告警，后续如 SDK 提供稳定的模块化 PG/Auth 入口再继续拆分，不提高阈值掩盖成本。

## 自动验证

- `npm run test:v050`
- `npm run test:alpha2`
- `npm run test:alpha3`
- `npm run build`
- `npm run test:alpha2:mobile`（使用隔离的 Preview / 本地预览，不执行注册写入）

真实 CloudBase 双设备验收需要先按 [CloudBase 开通清单](ALPHA3_CLOUDBASE_RUNBOOK.md)配置测试环境、Publishable Key、安全域名并执行三份 SQL 迁移。

## 回滚

Alpha 3 验收失败时，Vercel 正式站继续使用 Alpha 2 的 Supabase 配置；CloudBase 测试部署回滚到上一份静态产物。数据库只做向前修复，不通过回滚脚本删除情侣数据。本地 JSON 备份与 V0.4 数据始终保留。
