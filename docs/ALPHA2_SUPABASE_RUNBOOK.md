# V0.5 Alpha 2：Supabase 开通清单

Alpha 2 只把账号、个人资料、情侣空间和绑定关系放到云端。愿望、回忆、每日问答、纪念日和照片仍留在当前设备；大陆账号链路由 Alpha 3 验证，私人故事要等 Alpha 4 的预览、校验和回滚流程完成后才迁移。

## 1. 执行数据库迁移

1. 打开 Supabase 项目 `hpzuseujkflzdaoadmvx` 的 SQL Editor。
2. 新建查询，粘贴并执行：
   `supabase/migrations/20260819180000_alpha2_auth_couples.sql`
3. 在 Table Editor 中确认出现：
   `profiles`、`couples`、`couple_members`、`couple_invites`。

迁移在一个事务中执行；任一语句失败时整次迁移都会回滚。不要把报错后的半段 SQL 单独重跑。

## 2. 设置 Auth

在 Authentication → URL Configuration 设置：

- Site URL：`https://27qqjlover.vercel.app`
- Redirect URLs：
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`
  - `https://27qqjlover.vercel.app/**`
  - `https://*-romantic-lover.vercel.app/**`

在 Authentication → Sign In / Password policy 中把最短密码设为 8 位。

本项目 Alpha 2 当前采用“关闭 Confirm email”的验收策略，注册成功后直接建立登录态，方便用两个测试账号完成绑定验证。正式公开注册前，需要先配置可靠 SMTP，再开启邮箱确认。

### 注册错误排查

- `email_address_not_authorized`：仍在使用 Supabase 默认邮件服务，而注册邮箱不是项目组织成员。Alpha 验收时，在 Authentication → Providers → Email 关闭 `Confirm email`；正式发布前配置自定义 SMTP 后再开启。
- `over_email_send_rate_limit`：默认邮件额度已用完。等待限额恢复，或配置自定义 SMTP。
- `unexpected_failure`：通常是 `auth.users` 触发器或数据库约束失败。到 Authentication → Logs 查看同一时间的错误，并核对 `future_with_you_profile_on_auth_user_created` 触发器。

### CAPTCHA 人机验证

Supabase 只负责校验 CAPTCHA token，不会自动在 React 页面生成验证码。后台与前端必须使用同一个供应商：`hcaptcha` 或 `turnstile`。

1. 在 Supabase Authentication → Bot and Abuse Protection 中启用 CAPTCHA，选择供应商并保存该供应商的 **Secret Key**。
2. 在 CAPTCHA 供应商后台，把 Vercel Preview 域名和正式域名加入允许列表。
3. 在 Vercel Preview / Development 添加同一供应商名称和对应的公开 **Site Key**。
4. Secret Key 只能留在 Supabase；不要放进 Git、`.env.local` 或任何 `VITE_*` 变量。

`captcha_failed` 表示前端没有提交 token、token 已过期、域名不在供应商允许列表，或者 Supabase Secret Key 与前端 Site Key 不属于同一个 CAPTCHA 站点。

不要为了绕过邮件问题把 `service_role` 或 SMTP 密码放进 Vercel 的 `VITE_*` 变量；所有 `VITE_*` 内容都会进入浏览器包。

## 3. 设置 Vercel Preview / Development

仅在 Preview 与 Development 设置下列变量：

```text
VITE_BACKEND_PROVIDER=supabase
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
VITE_SUPABASE_CAPTCHA_PROVIDER=<hcaptcha 或 turnstile>
VITE_SUPABASE_CAPTCHA_SITE_KEY=<公开 Site Key>
```

浏览器中只能放 `sb_publishable_` key。不要添加 secret key、service role key 或数据库密码。Production 暂不设置 `VITE_BACKEND_PROVIDER`，因此线上 V0.4 继续使用本地模式。

## 4. 双设备验收

1. 普通窗口注册账号 A，创建情侣空间并生成 10 位邀请码。
2. 无痕窗口注册账号 B，输入邀请码。
3. 两个窗口刷新后都应显示两位成员。
4. 邀请码第二次使用、20 分钟后使用、第三个账号加入都应失败。
5. 账号 A 编辑资料后，账号 B 刷新应看到新的显示名字。
6. 任一账号退出情侣空间后，应失去该空间读取权限；本机愿望和回忆不得被删除。

完成海外 Alpha 2 与大陆 Alpha 3 验收后，Alpha 4 才会开始本地数据迁移和核心同步。
