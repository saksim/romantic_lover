# V0.5 Alpha 3：CloudBase 控制台逐屏交接手册

这份手册写给负责操作腾讯云控制台的人。执行者只需要浏览器、CloudBase 环境权限和待部署的代码来源；她的电脑不需要安装 Node.js、NPM、Python、Git 或任何开发工具。

本轮只发布 `dev` 测试版，用来验证中国大陆的账号、邮箱验证码、情侣空间和邀请码链路。不要把 `main` 当测试分支，也不要在本轮迁移愿望、回忆、照片等私人本地数据。

## 先看结论

1. 女方打开最终 CloudBase 网址时，不会访问 Vercel、Supabase、Cloudflare 或美国服务器。
2. CloudBase 从 GitHub 拉代码属于“构建阶段”，可能受跨境网络影响；失败时改用本手册的“上传源码 ZIP”路径。
3. 当前网页只需要一个浏览器可公开的 **Publishable Key**。
4. 服务端 **API Key** 拥有管理员权限，当前部署完全不需要它，绝不能填写到 `VITE_*`、源码、GitHub、聊天或截图中。
5. CloudBase 默认静态托管网址先用于验收；备案域名和正式发布放到后续阶段。

## 本项目填值总表

先对照此表，不要凭感觉填写。

| 控制台字段 | 本轮应填值 | 说明 |
| --- | --- | --- |
| 环境 ID | `romantic-lover-d2gm91y2511244d02` | 环境标识，不是密钥；若控制台当前环境显示不同值，立即停止，先确认是否选错环境 |
| 地域 | `ap-shanghai` / 上海 | 必须与环境所在地域一致 |
| Git 仓库 | `saksim/romantic_lover` | Git 路径可用时使用 |
| 测试分支 | `dev` | 本轮禁止选择 `main` |
| 项目框架 | `Vite` | 若列表没有 Vite，可选 React 后手工覆盖下面的构建参数 |
| Node.js | `20` | 不选 16；22 也可，但本轮统一用 20 |
| 代码目录 | 仓库根目录，通常留空或 `.` | 该目录中必须能看到 `package.json` |
| 安装命令 | `npm ci` | 不改成其他命令 |
| 构建命令 | `npm run build` | 不把密钥拼进命令 |
| 构建产物目录 | `./dist` | 不是项目根目录，也不是 `public` |
| 部署路径 | `/` | 测试站独占根路径 |
| Publishable Key | 从当前环境的 Publishable Key 项复制 | 只放入指定的前端构建变量，不写进文档 |
| API Key / Secret Key | **留空，不使用** | 当前前端发布不需要任何管理员密钥 |

前端构建变量只有四项：

```text
VITE_BACKEND_PROVIDER=cloudbase-pg
VITE_CLOUDBASE_ENV_ID=romantic-lover-d2gm91y2511244d02
VITE_CLOUDBASE_PUBLISHABLE_KEY=<只粘贴 Publishable Key>
VITE_CLOUDBASE_REGION=ap-shanghai
```

不要再添加 `VITE_SUPABASE_*`，也不要创建 `VITE_CLOUDBASE_API_KEY`、`VITE_CLOUDBASE_SECRET_KEY`、`TCB_SECRET_KEY` 等变量。

## 第 0 步：先吊销已经暴露的服务端 API Key

如果服务端 API Key 曾经出现在聊天、截图、Git、文档或前端变量中，必须先处理这一项。Publishable Key 可以出现在浏览器中；服务端 API Key 不可以。

1. 登录 [CloudBase 控制台](https://tcb.cloud.tencent.com/dev)。
2. 进入环境 `romantic-lover-d2gm91y2511244d02`。
3. 左侧进入“环境配置”。不同版本界面可能叫“环境设置”或“安全配置”。
4. 打开“API Key 配置”或“API Key 管理”。
5. 找到类型为 **API Key** 的那一项。不要误删类型为 **Publishable Key** 的项。
6. 对已经暴露的 API Key 点击“删除”“吊销”或“禁用”，按控制台实际按钮完成确认。
7. 刷新列表，确认旧 Key 已不存在或状态为禁用。

当前网页不需要服务端 API Key，所以吊销后不必为本轮重新创建一个。若控制台不允许删除，先禁用旧 Key；仍无法处理时停止部署，只反馈“API Key 无法吊销”的界面位置，截图必须遮住所有 Key 内容。

通过标准：列表中保留 Publishable Key；已暴露的服务端 API Key 已删除或禁用。

## 第 1 步：确认选中了正确环境

1. 看页面顶部或环境总览中的“环境 ID”。
2. 必须是 `romantic-lover-d2gm91y2511244d02`。
3. 地域必须是上海，对应前端变量 `ap-shanghai`。
4. 如果环境 ID 不一致，不要把另一个环境的 Key、数据库和网址混在一起；先切换环境。

通过标准：环境 ID、数据库、身份认证、Publishable Key 和静态托管都属于同一个上海环境。

## 第 2 步：只读确认两份 SQL 已经执行成功

进入“PostgreSQL 数据库”或“数据库管理”，打开 SQL 编辑器。先运行下面这段只读检查，它不会修改或删除数据：

```sql
select
  to_regclass('public.profiles') is not null as profiles_ok,
  to_regclass('public.couples') is not null as couples_ok,
  to_regclass('public.couple_members') is not null as couple_members_ok,
  to_regprocedure('public.is_authenticated_request()') is not null as auth_guard_ok,
  to_regprocedure('public.create_couple_space(text,text)') is not null as create_space_ok,
  to_regprocedure('public.create_couple_invite(uuid)') is not null as create_invite_ok,
  to_regprocedure('public.join_couple_by_code(text)') is not null as join_invite_ok,
  to_regprocedure('public.leave_couple_space(uuid)') is not null as leave_space_ok;
```

期望结果：一行结果中的八列全部为 `true`。

- 全部为 `true`：继续第 3 步，不要重复执行迁移。
- 任一列为 `false`：按顺序执行仓库中的两份完整 SQL 文件：
  1. `backend/cloudbase-pg/migrations/0001_v050_foundation.sql`
  2. `backend/cloudbase-pg/migrations/0002_alpha3_mainland_auth_hardening.sql`
- 出现红色错误：停止，不要执行 `DROP TABLE`、`TRUNCATE` 或删除环境；只记录错误码、错误文字和失败行号。

若执行者无法打开 GitHub，由项目维护者把这两个 `.sql` 文件单独发给她。不要通过截图复制 SQL，也不要只复制文件的一部分。

通过标准：八个检查项全部为 `true`。

## 第 3 步：确认邮箱注册与登录已启用

1. 左侧进入“身份认证”。旧版界面可能叫“登录授权”。
2. 找到登录方式列表。
3. 开启“邮箱登录”“邮箱 + 密码”或界面中等价的邮箱注册登录能力。
4. 保存配置，刷新页面后确认开关仍为开启。
5. 不要用“匿名登录”代替邮箱登录；匿名用户不能完成本项目的情侣账号验收。

本项目注册流程是：用户填写昵称、邮箱和密码 → CloudBase 发送一次性验证码 → 网页弹出验证码输入框 → 输入验证码后创建会话。密码应为 8–32 位，并同时包含字母和数字。

如果控制台明确提示“未配置发件人”，或实际测试收不到邮件，再配置发件邮箱：

1. 在身份认证页面打开“配置发件人”。
2. 使用可稳定向中国大陆投递的邮箱 SMTP 服务，例如项目所有者控制的 QQ 邮箱或其他可靠邮箱。
3. SMTP 密码应使用邮箱服务生成的授权码，不在聊天或 Git 中保存。
4. 应用名称可填 `Future With You`。
5. 若界面要求跳转地址，先填 CloudBase 部署完成后得到的默认 HTTPS 网址；尚未得到网址时先完成第 5 步，再回来填写。

通过标准：邮箱登录开关保持开启；正式验收时能收到 6 位验证码。

## 第 4 步：确认使用的是 Publishable Key

入口：当前环境 →“环境配置”→“API Key 配置 / API Key 管理”。

1. 找到类型明确写着 **Publishable Key** 的项。
2. 若已经有可用项，直接使用，不需要重复创建。
3. 若没有，点击“新建”，类型选择 **Publishable Key**，名称建议填 `romantic-lover-alpha3-dev-web`。
4. 把值临时保存在可信密码管理器中，稍后只粘贴到 CloudBase 构建变量 `VITE_CLOUDBASE_PUBLISHABLE_KEY`。

辨别规则：

| 类型 | 能否放入浏览器构建 | 本轮是否需要 |
| --- | --- | --- |
| Publishable Key | 可以 | 需要 |
| API Key / Service Role / 管理员 Key | 绝对不可以 | 不需要 |
| 腾讯云 SecretId / SecretKey | 绝对不可以 | 不需要 |

如果界面只看到“API Key”而没有“Publishable Key”，不要拿 API Key 顶替；先确认是否进入了正确环境的 CloudBase API Key 管理页面。

通过标准：有且只有 Publishable Key 会进入后面的 `VITE_*` 构建变量。

## 第 5 步：部署 `dev` 测试站

两条路径二选一。路径 A 自动跟踪 Git；路径 B 用来绕过 GitHub 授权或拉取不稳定。最终网页功能相同。

### 路径 A：Git 仓库部署

1. 左侧进入“静态网站托管”。
2. 首次使用时按页面提示开通服务。
3. 点击“新建部署”。
4. 选择“Git 仓库”→“个人仓库”。
5. 选择 GitHub 并完成授权。
6. 选择仓库 `saksim/romantic_lover`。
7. 分支选择 `dev`，不要选择 `main`。
8. 若找不到仓库，回到 GitHub 的 CloudBase 应用授权页，确认该应用有权读取这个仓库；不要因此创建或粘贴服务端 API Key。

如果 GitHub 授权页在当地无法稳定打开，立即改用路径 B，不必反复尝试。

### 路径 B：上传源码 ZIP，不经过 GitHub

1. 由项目维护者发送一份当前 `dev` 的源码 ZIP，例如 `romantic-lover-alpha3-dev-source.zip`。
2. ZIP 内必须包含完整源码、`package.json` 和 `package-lock.json`；不要包含 `.env`、真实 Key、`node_modules` 或 `.git`。
3. 在“静态网站托管”点击“新建部署”→“上传代码包”→选择 ZIP。
4. ZIP 解压后的代码根目录必须能直接看到 `package.json`。如果 ZIP 外层多了一层目录，就把“代码目录 / 目标目录”指向那层目录，或让维护者重新打包。
5. 后续构建参数与路径 A 完全相同。

这条路径由 CloudBase 云端安装和构建，所以执行者电脑仍然不需要 NPM 或 Node.js。

### 两条路径共同的构建配置

按下表逐格核对：

```text
项目名称：romantic-lover-alpha3-dev
项目框架：Vite
Node.js：20
代码目录 / 目标目录：留空或 .（必须是 package.json 所在目录）
安装命令：npm ci
构建命令：npm run build
构建产物目录：./dist
部署路径：/
```

在“环境变量”“构建环境变量”或“高级配置 → 环境变量”中逐行添加：

```text
VITE_BACKEND_PROVIDER        cloudbase-pg
VITE_CLOUDBASE_ENV_ID        romantic-lover-d2gm91y2511244d02
VITE_CLOUDBASE_PUBLISHABLE_KEY  <Publishable Key 的完整值>
VITE_CLOUDBASE_REGION        ap-shanghai
```

确认没有多余空格、引号或换行。变量名区分大小写。Publishable Key 很长，粘贴后只核对开头和结尾是否完整，不要把它发到聊天中请求检查。

第一次测试建议关闭“推送后自动发布正式环境”，先手动点击“部署”。等待状态从“构建中”变为“成功”。

通过标准：构建日志中 `npm ci`、`npm run build` 成功，系统识别并发布 `dist`。

## 第 6 步：把实际网址加入安全域名

这就是旧清单中容易找错的“第 5 步”。它不在身份认证页面，也不在自定义域名页面。

1. 打开刚才成功的部署详情。
2. 复制默认 HTTPS 访问网址，例如 `https://某个主机名.tcloudbaseapp.com/`。
3. 从网址中只取主机名：去掉 `https://`、最后的 `/`、路径和参数。
4. 返回当前环境 →“环境配置”→“安全来源”→“安全域名”。
5. 先查看系统是否已经自动加入这个 CloudBase 默认域名。
6. 已存在完全相同的域名或覆盖它的官方默认项：不要重复添加。
7. 不存在：点击“添加域名”，只填主机名并保存。

正确示例：

```text
romantic-lover-example.tcloudbaseapp.com
```

错误示例：

```text
https://romantic-lover-example.tcloudbaseapp.com/
https://romantic-lover-example.tcloudbaseapp.com/login
```

配置通常需要几分钟生效。保存后等待 2 分钟再测试；若仍提示跨域，最多等待 10 分钟并重新打开无痕窗口。不要为了省事添加 `*` 或不受控制的通配域名。

若还要用 Vercel Preview 连接这个 CloudBase 测试环境，应单独加入实际 Preview 主机名，不要笼统放开所有 `*.vercel.app`。

通过标准：部署域名出现在安全域名列表中，网页请求不再出现 `cors permission denied`。

## 第 7 步：第一次打开网页

1. 用手机无痕窗口打开 CloudBase 默认 HTTPS 网址。
2. 如果以前打开过同一网址，先关闭旧标签页再重新打开，避免 PWA 缓存造成“仍是旧版本”的错觉。
3. 进入账号区域。
4. 页面应显示 `Alpha 3 · CloudBase 大陆云`。
5. 若显示 `Supabase 海外云` 或“本地安全模式”，说明构建变量没有生效；回到第 5 步修正变量并重新部署。
6. 若页面显示 V0.2/V0.4 而不是当前 Alpha 3，确认部署来源是 `dev`，然后重建并用无痕窗口复验。

通过标准：页面能打开，资源无 404，账号面板显示 CloudBase 大陆云。

## 第 8 步：最小验收

先使用测试邮箱和测试情侣空间，不要立即放入真实私人内容。

1. A 在账号面板选择注册，填写昵称、邮箱和合规密码。
2. A 收到邮件后，在网页弹窗输入 6 位验证码。
3. 刷新网页，A 应保持登录。
4. A 创建测试情侣空间并生成一次性邀请码。
5. B 在另一台手机或另一个完全隔离的浏览器中注册并登录。
6. B 输入邀请码加入。
7. A、B 刷新后应看到同一个情侣空间和两位成员。
8. 再次使用同一邀请码必须失败；第三个账号加入必须失败。
9. 验收期间原有愿望、回忆和照片仍留在各自本机，数量不得被云端测试改变。

只有以上步骤都通过，才可以把结果称为“中国大陆 Alpha 3 链路已打通”。一次在海外打开成功不等于中国大陆已验收；至少分别用中国大陆手机流量和常用 Wi-Fi 测一次。

## 常见故障按现象处理

| 现象 | 最可能原因 | 处理 |
| --- | --- | --- |
| CloudBase 无法读取 GitHub | GitHub 授权或跨境拉取不稳定 | 改用“上传源码 ZIP”；也可后续镜像到 Gitee |
| `npm ci` 失败 | 代码目录不对、缺少 `package-lock.json` 或 Node 版本不对 | 确认代码根目录、锁文件和 Node 20；保留日志最后 30 行 |
| 构建成功但页面空白 / 资源 404 | 产物目录或部署路径错误 | 产物目录改为 `./dist`，部署路径 `/`；项目已配置 Vite 相对资源路径 |
| 页面仍是 V0.2/V0.4 | 选错分支或浏览器/PWA 缓存 | 选择 `dev` 重建，用无痕窗口确认 |
| 页面显示“本地安全模式” | 四个 `VITE_*` 变量缺失或拼错 | 逐项对照填值表，重新构建；仅刷新不会改变已编译变量 |
| `cors permission denied` / `permission_denied` | 当前网址没有加入安全域名 | 按第 6 步添加纯主机名，等待最多 10 分钟 |
| Key 无效或初始化失败 | 误用了 API Key、Key 属于另一个环境或粘贴不完整 | 重新从当前环境复制 Publishable Key，绝不使用管理员 API Key |
| 注册后收不到验证码 | 邮箱登录未开启、发件人未配置、邮件被拦截或触发频控 | 检查身份认证和垃圾箱；60 秒后再试；必要时配置国内可投递 SMTP |
| 创建空间 / 邀请时报 401、403 或 RPC 不存在 | SQL 未完整执行、`0002` 未执行或会话未登录 | 运行第 2 步只读检查；不要删除表重来 |
| 图片验证码没有出现 | 未触发风控，或页面版本不是 Alpha 3 | 正常注册不一定触发验证码；只有 CloudBase 风控要求时才显示 |
| 默认网址可开但自定义域名不可开 | DNS、证书或备案尚未完成 | Alpha 3 先用默认网址验收，自定义域名留到正式阶段 |

## “中国大陆有墙”到底影响哪一段

把链路分成两段就不会混乱：

1. **构建链路**：CloudBase/GitHub 授权和 CloudBase 拉取 GitHub 源码。这一段可能跨境不稳定，所以有源码 ZIP 和未来 Gitee 镜像两种兜底。
2. **用户运行链路**：中国大陆手机 → CloudBase 静态托管/CDN → 上海 CloudBase Auth/PostgreSQL。这一段不依赖 Vercel、Supabase 或 Cloudflare，是本轮要真实验收的链路。

因此“GitHub 打不开”不等于“CloudBase 网站做不了”。只要用 ZIP 把源码交给 CloudBase 构建，最终测试站仍可以完全走大陆链路。但任何平台都不能靠文档承诺所有地区、运营商和时段 100% 可达，必须用她的真实手机网络完成第 8 步。

## 执行者应反馈什么

可以反馈：

```text
环境 ID：romantic-lover-d2gm91y2511244d02
部署来源：Git dev / 源码 ZIP（二选一）
部署状态：成功 / 失败
CloudBase 默认网址：...
页面显示：Alpha 3 · CloudBase 大陆云 / 其他
SQL 八项检查：全部 true / 哪一项 false
验收完成到：第 ... 步
错误码或 Request ID：...
构建日志最后 30 行：...
```

绝对不要反馈：邮箱密码、SMTP 授权码、API Key、Secret Key、完整 Publishable Key、JWT、会话 Token、真实邀请码或未打码的私人邮箱截图。

## 正式发布不在本手册内

本手册只部署 `dev` 测试环境。测试通过后仍需：

1. 完成双设备和大陆双网络验收。
2. 评审 `dev → main` PR。
3. 人工合并到 `main`。
4. 为正式环境单独配置 CloudBase 项目、Publishable Key 和安全域名。
5. 准备备案域名、HTTPS 证书、DNS 和回滚方案。

在此之前，不把 `dev` 默认网址当作长期正式站，也不迁移真实情侣数据。

## 腾讯云官方参考

- [API Key 配置：Publishable Key 与服务端 API Key 的区别](https://docs.cloudbase.net/api-reference/webv2/api-key)
- [安全来源：控制台入口和安全域名格式](https://docs.cloudbase.net/envconfig/security/intro)
- [静态网站托管：Git、ZIP 和文件夹部署方式](https://docs.cloudbase.net/hosting/web-hosting)
- [部署指南：构建命令、环境变量和 `dist` 目录](https://docs.cloudbase.net/hosting/web-hosting-guide)
- [CloudBase 静态托管概述](https://docs.cloudbase.net/hosting/introduce)
- [邮箱登录配置](https://docs.cloudbase.net/authentication/method/email-login)
- [PostgreSQL 控制台 SQL 执行说明](https://docs.cloudbase.net/database/postgresql/tutorial)
- [从 Vercel 迁移到 CloudBase](https://docs.cloudbase.net/quick-start/migration/vercel)
