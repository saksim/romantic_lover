# V0.5 Alpha 2：Supabase 开通清单

Alpha 2 只把账号、个人资料、情侣空间和绑定关系放到云端。愿望、回忆、每日问答、纪念日和照片仍留在当前设备；它们要等 Alpha 3 的预览、校验和回滚流程完成后才迁移。

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

Alpha 测试阶段可以暂时关闭邮箱确认，方便用两个测试账号完成绑定验证。正式公开注册前，需要先配置可靠 SMTP，再开启邮箱确认。

## 3. 设置 Vercel Preview / Development

仅在 Preview 与 Development 设置下列变量：

```text
VITE_BACKEND_PROVIDER=supabase
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
```

浏览器中只能放 `sb_publishable_` key。不要添加 secret key、service role key 或数据库密码。Production 暂不设置 `VITE_BACKEND_PROVIDER`，因此线上 V0.4 继续使用本地模式。

## 4. 双设备验收

1. 普通窗口注册账号 A，创建情侣空间并生成 10 位邀请码。
2. 无痕窗口注册账号 B，输入邀请码。
3. 两个窗口刷新后都应显示两位成员。
4. 邀请码第二次使用、20 分钟后使用、第三个账号加入都应失败。
5. 账号 A 编辑资料后，账号 B 刷新应看到新的显示名字。
6. 任一账号退出情侣空间后，应失去该空间读取权限；本机愿望和回忆不得被删除。

完成以上验收后，Alpha 3 才会开始本地数据迁移和离线同步。
