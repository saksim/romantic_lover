import type { DailyQuestion } from '../domain/wish'

export const dailyQuestions: DailyQuestion[] = [
  { id: 'q01', prompt: '今天最想谢谢对方的一件小事是什么？', hint: '越小的事情，往往越容易被忽略。' },
  { id: 'q02', prompt: '最近哪个瞬间让你觉得“有她 / 他真好”？', hint: '可以只写一句，也可以讲完整个故事。' },
  { id: 'q03', prompt: '如果今晚只留一个小时给彼此，你最想怎么过？', hint: '不用考虑现实，先说心里最想要的。' },
  { id: 'q04', prompt: '对方身上哪个习惯，正在悄悄影响你？', hint: '那些慢慢发生的改变，也是一种靠近。' },
  { id: 'q05', prompt: '哪一次普通约会，你其实一直记到现在？', hint: '也许当时没有拍照，但心里留下了画面。' },
  { id: 'q06', prompt: '最近有什么压力，是你希望对方更懂一点的？', hint: '说出来不是添麻烦，是允许彼此靠近。' },
  { id: 'q07', prompt: '如果为我们的关系选一种天气，会是什么？', hint: '晴天、阵雨、晚风，或者你自己的答案。' },
  { id: 'q08', prompt: '你最喜欢对方怎样安慰你？', hint: '具体一点，下次我们就更会爱彼此。' },
  { id: 'q09', prompt: '如果可以重播一段共同记忆，你会选哪一段？', hint: '说说当时你眼里的对方。' },
  { id: 'q10', prompt: '今年结束以前，你最想和对方完成什么？', hint: '它可以是一场旅行，也可以只是一顿饭。' },
  { id: 'q11', prompt: '你觉得我们最像哪一部电影里的两个人？', hint: '不一定是爱情电影。' },
  { id: 'q12', prompt: '最近一次被对方逗笑，是因为什么？', hint: '把那个瞬间再讲一遍。' },
  { id: 'q13', prompt: '如果给现在的我们写一句旁白，你会写什么？', hint: '像电影里那种，很多年后还会记得的旁白。' },
  { id: 'q14', prompt: '你希望我们的家里，永远保留什么小仪式？', hint: '比如出门前的拥抱，或周末的一顿早餐。' },
  { id: 'q15', prompt: '对方哪一种样子，自己可能不知道有多可爱？', hint: '请认真描述，让她 / 他看见你眼中的自己。' },
  { id: 'q16', prompt: '遇到分歧时，什么做法会让你更有安全感？', hint: '这不是规则，是彼此的使用说明。' },
  { id: 'q17', prompt: '如果明天突然多出一天假期，我们去哪里？', hint: '第一反应通常最诚实。' },
  { id: 'q18', prompt: '你觉得我们一起做得最棒的一件事是什么？', hint: '关系里的努力，也值得被看见。' },
  { id: 'q19', prompt: '未来的某一天，你最期待和对方分享什么日常？', hint: '不是宏大计划，是一幅生活的画面。' },
  { id: 'q20', prompt: '今天想对对方说、但差点忘记说的话是什么？', hint: '现在正好可以补上。' },
  { id: 'q21', prompt: '在你心里，“被爱着”最具体的感觉是什么？', hint: '一个动作、一句话或一种安静都可以。' },
  { id: 'q22', prompt: '如果我们的故事有下一季，你希望主题是什么？', hint: '给接下来的日子取一个名字。' },
  { id: 'q23', prompt: '对方最近做了什么，让你觉得她 / 他在成长？', hint: '被重要的人看见，会让成长更有力量。' },
  { id: 'q24', prompt: '你想和对方一起学会哪一件新事情？', hint: '笨拙地一起开始，也会很好玩。' },
]

export function getDailyQuestion(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return dailyQuestions[dayOfYear % dailyQuestions.length]
}

export function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
