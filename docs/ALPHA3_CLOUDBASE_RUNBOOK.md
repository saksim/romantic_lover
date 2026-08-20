# V0.5 Alpha 3：CloudBase 中国大陆验收与部署清单

Alpha 3 的目标是验证中国大陆链路，不是立刻搬运私人故事。当前只把账号、个人资料、情侣空间和一次性邀请码接入 CloudBase；愿望、回忆、照片等仍保存在各自设备，绝不会静默上传、覆盖或跨云双写。

## 1. 数据真相与环境边界

一个情侣空间只能选择一个权威后端。进入正式使用后，两个人访问的 Vercel 与 CloudBase 前端必须指向同一个 CloudBase PG 环境；不得让一方写 Supabase、另一方写 CloudBase，也不得跨云双写。

建议准备两个 CloudBase PG 环境：

- `dev` → 测试环境与测试域名，只放测试账号和测试情侣空间。
- `main` → 正式环境与正式域名，只在 PR 评审、双设备验收及人工批准后发布。

现有 Supabase 保留为海外基线和回滚路径。切换正式情侣空间前先导出本地备份，并约定切换窗口。

## 2. 创建 CloudBase PG 能力

1. 在腾讯云 CloudBase 创建或选择 PostgreSQL 模式环境。
2. 在数据库管理界面按顺序执行：
   - `backend/cloudbase-pg/migrations/0001_v050_foundation.sql`
   - `backend/cloudbase-pg/migrations/0002_alpha3_mainland_auth_hardening.sql`
3. 在身份认证中启用邮箱密码注册与登录。CloudBase 注册会向邮箱发送一次性验证码，网页再调用 `verifyOtp` 完成账号创建。
4. 创建浏览器可用的 **Publishable Key**。Secret Key、管理员密钥和服务端密钥不得进入 Git、CloudBase 构建变量或任何 `VITE_*` 变量。
5. 把 CloudBase 测试域名、未来正式域名和需要验收的 Vercel 域名加入 Web 安全域名。

`0002` 不能省略：CloudBase PostgREST 的 RPC 暴露不能只依赖 `GRANT EXECUTE`，所以四个高权限情侣操作都会在函数内部再次检查已验证 JWT 的 `authenticated` 角色。

## 3. 配置前端构建变量

测试部署只设置以下公开变量：

```text
VITE_BACKEND_PROVIDER=cloudbase-pg
VITE_CLOUDBASE_ENV_ID=<测试环境 ID>
VITE_CLOUDBASE_PUBLISHABLE_KEY=<Publishable Key>
VITE_CLOUDBASE_REGION=ap-shanghai
```

不要同时填写 Supabase 作为第二个可写后端。代码会按 `VITE_BACKEND_PROVIDER` 只加载一个账号网关。

CloudBase 的风险验证码由 SDK 在登录失败、频率过高或风控命中时触发。前端会在原弹窗内显示图片验证码，不依赖 Cloudflare Turnstile，也不需要另配 Site Key。

## 4. CloudBase Git / 静态托管参数

使用仓库 `saksim/romantic_lover`，测试目标追踪 `dev`：

```text
安装命令：npm ci
构建命令：npm run build
输出目录：dist
Node.js：20 或 22
```

把第 3 节变量配置在测试部署目标。不要把环境 ID 或 Key 直接写进构建命令、源码或 PR 描述。

正式目标追踪 `main`，但不要启用“未评审即自动发布正式环境”。推荐流程是：

1. `dev` 推送触发测试构建。
2. CI、CloudBase 测试域名和两台设备验收通过。
3. 创建并评审 `dev → main` PR。
4. 人工合并。
5. `main` 构建正式产物，再由负责人批准上线。

Deploy Hook 不是当前必需项。Git 分支触发已经覆盖测试流程；只有未来需要外部系统在审核后主动触发部署时再创建，并将 Hook 当作密钥管理。

## 5. 双设备验收

在两台真实设备或两个完全隔离的浏览器配置中执行：

1. A 用邮箱注册，收到验证码后在弹窗中完成验证；刷新后仍保持登录。
2. A 创建情侣空间并生成一次性邀请码。
3. B 注册并登录，使用邀请码加入。
4. A、B 刷新页面，均能看到相同空间和两位成员资料。
5. A 修改自己的昵称，B 刷新后能看到；B 不能修改 A 的资料。
6. 旧邀请码再次兑换必须失败；第三个账号加入必须失败。
7. 退出空间、重新创建或重新绑定时，另一个空间的数据不可见。
8. 触发错误登录或频控后，图片验证码必须在手机弹窗内可见、可刷新、可提交。
9. 整个过程中，本机愿望、回忆和照片数量保持不变；JSON 导出仍可用。

验收记录至少包含：提交 SHA、两个设备/网络、测试域名、步骤结果、控制台错误和回滚结论。不要在截图或 PR 中暴露邮箱、邀请码、JWT 或 Key。

## 6. Vercel 与正式切换

Alpha 3 验收期间，Vercel 正式站可以继续使用已通过的 Supabase 配置。准备让两个人正式共享账号时：

1. 先备份两台设备的本地 JSON。
2. 在 Vercel Preview 用同一个 CloudBase **测试**环境复验。
3. 将 Vercel Production 的 provider、环境 ID、Publishable Key 和安全域名切换到正式 CloudBase 环境。
4. 从已评审的 `main` 重新部署。
5. 确认 Vercel 正式域名与 CloudBase 正式域名登录的是同一个情侣空间。
6. 在确认窗口内保留上一个 Vercel Deployment 和 Supabase 配置用于回滚，但不要继续向旧空间写新数据。

## 7. 回滚

前端异常时回滚到上一份已验证的静态部署；数据库迁移只向前修复，不直接删除情侣数据。若 CloudBase 链路验收失败，正式站继续使用 Supabase，本地数据不会受影响。只有在同一权威后端、双设备认证和导出恢复都验证完成后，才进入下一阶段的故事迁移与同步。

官方参考：

- [CloudBase Web v3 身份认证](https://docs.cloudbase.net/en/api-reference/webv3/authentication)
- [CloudBase 验证码](https://docs.cloudbase.net/authentication-v2/method/captcha)
- [CloudBase PostgreSQL 快速开始](https://docs.cloudbase.net/en/database/postgresql/quickstart)
- [CloudBase PostgreSQL RPC](https://docs.cloudbase.net/database/postgresql/rpc)
- [CloudBase 静态网站托管](https://docs.cloudbase.net/en/hosting/quick-start)
