interface SecretScreenProps { openedAt?: string; onBack: () => void }

export function SecretScreen({ openedAt, onBack }: SecretScreenProps) {
  return (
    <section className="secret-screen" aria-labelledby="secret-title">
      <div className="secret-stars" aria-hidden="true"><span>✦</span><span>·</span><span>✦</span><span>·</span><span>✦</span><span>♥</span></div>
      <button type="button" className="secret-back" onClick={onBack}><span aria-hidden="true">←</span>返回收藏</button>
      <div className="secret-card">
        <p className="secret-card__eyebrow">ONE MORE, ALWAYS</p>
        <div className="secret-infinity" aria-hidden="true">∞</div>
        <p className="secret-number">WISH #∞</p>
        <h1 id="secret-title">剩下那些<br />我还没有想到的事</h1>
        <div className="secret-message">
          <p>我不知道以后具体会发生什么，</p><p>也不知道我们会去哪里、会变成什么样的大人。</p><p>所以这张卡没有完成条件。</p>
        </div>
        <blockquote>因为我真正想要完成的愿望，并不只在这些事情里。<br /><strong>是希望未来很多还没想到的事情里，都有你。</strong></blockquote>
        <div className="secret-signature"><span>For us,</span><strong>Future With You</strong></div>
      </div>
      <p className="secret-footnote">{openedAt ? '这份秘密已经被你留在这里。' : '现在，它也属于你了。'}</p>
    </section>
  )
}

