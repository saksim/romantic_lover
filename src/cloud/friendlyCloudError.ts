interface CloudErrorShape {
  code?: unknown
  status?: unknown
  message?: unknown
}

interface CloudErrorDetails {
  code: string
  status?: number
  message: string
}

function readCloudError(error: unknown): CloudErrorDetails {
  if (!error || typeof error !== 'object') {
    return {
      code: '',
      message: typeof error === 'string' ? error : '',
    }
  }

  const value = error as CloudErrorShape
  const candidateCode = typeof value.code === 'string' ? value.code.trim().toLowerCase() : ''
  const code = /^[a-z0-9_.-]{1,64}$/.test(candidateCode) ? candidateCode : ''
  const status = typeof value.status === 'number' && value.status >= 100 && value.status <= 599
    ? value.status
    : undefined

  return {
    code,
    status,
    message: typeof value.message === 'string' ? value.message : '',
  }
}

function withDiagnostic(message: string, code: string, status?: number) {
  const diagnostic = code || (status ? `http_${status}` : '')
  return diagnostic ? `${message}（错误码：${diagnostic}）` : message
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: '邮箱或密码不正确。',
  email_not_confirmed: '请先打开邮箱里的验证链接，再回来登录。',
  captcha_failed: '人机验证未完成、已经过期，或验证码供应商与 Site Key 配置不一致。请重新验证后再试。',
  email_address_not_authorized: '当前邮件服务不能向这个邮箱发送验证信。请由空间创建者完成邮件配置，或在 Alpha 测试阶段关闭邮箱确认。',
  over_email_send_rate_limit: '验证邮件发送额度暂时用完了，请稍后重试，或由空间创建者配置自定义邮件服务。',
  signup_disabled: '当前云端项目已关闭新账号注册，请由空间创建者重新开启。',
  email_provider_disabled: '当前云端项目尚未开启邮箱登录，请由空间创建者完成 Auth 设置。',
  weak_password: '密码强度不足，请至少使用 8 位并避免过于简单的密码。',
  email_exists: '这个邮箱已经注册，可以直接登录。',
  user_already_exists: '这个邮箱已经注册，可以直接登录。',
  user_already_registered: '这个邮箱已经注册，可以直接登录。',
  unexpected_failure: '云端账号数据库没有完成注册。请由空间创建者检查 Auth 日志和用户资料触发器。',
}

export function friendlyCloudError(error: unknown) {
  const { code, status, message: raw } = readCloudError(error)
  const knownMessage = AUTH_ERROR_MESSAGES[code]
  if (knownMessage) return withDiagnostic(knownMessage, code, status)

  const message = raw.toLowerCase()
  if (message.includes('invalid login credentials')) return '邮箱或密码不正确。'
  if (message.includes('user already registered')) return '这个邮箱已经注册，可以直接登录。'
  if (message.includes('email not confirmed')) return '请先打开邮箱里的验证链接，再回来登录。'
  if (message.includes('email address') && message.includes('not authorized')) {
    return withDiagnostic(AUTH_ERROR_MESSAGES.email_address_not_authorized, 'email_address_not_authorized', status)
  }
  if (message.includes('password') && message.includes('least')) return '密码至少需要 8 位。'
  if (message.includes('email rate limit')) {
    return withDiagnostic(AUTH_ERROR_MESSAGES.over_email_send_rate_limit, 'over_email_send_rate_limit', status)
  }
  if (message.includes('already belongs')) return '这个账号已经加入了一个情侣空间。'
  if (message.includes('leave the current couple')) return '请先退出当前情侣空间，再加入新的空间。'
  if (message.includes('invalid or expired')) return '邀请码不正确或已经过期。'
  if (message.includes('already has two')) return '这个情侣空间已经有两个人了。'
  if (message.includes('authentication required')) return '登录状态已经失效，请重新登录。'
  if (message.includes('failed to fetch') || message.includes('network')) return '网络暂时无法连接云端，本地内容仍然安全。'
  if (message.includes('schema cache') || message.includes('could not find the table')) {
    return withDiagnostic('云端空间还没有完成初始化，请由空间创建者检查数据库迁移。', code, status)
  }
  if (message.includes('database error saving new user') || status === 500) {
    return withDiagnostic(AUTH_ERROR_MESSAGES.unexpected_failure, code || 'unexpected_failure', status)
  }
  if (status === 429) {
    return withDiagnostic('云端请求过于频繁，请稍后再试。', code, status)
  }

  return withDiagnostic('云端请求暂时未完成，请稍后再试。本地内容不会受到影响。', code, status)
}
