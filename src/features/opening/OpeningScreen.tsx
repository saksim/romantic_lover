import { LogoMark } from '../../components/LogoMark'

interface OpeningScreenProps { returning: boolean; onEnter: () => void }

export function OpeningScreen({ returning, onEnter }: OpeningScreenProps) {
  return (
    <section className="opening-screen" aria-labelledby="opening-title">
      <div className="opening-orbit opening-orbit--one" aria-hidden="true" />
      <div className="opening-orbit opening-orbit--two" aria-hidden="true" />
      <div className="opening-letter">
        <div className="opening-letter__topline"><span>TO · YOU</span><span>V0.2</span></div>
        <div className="opening-seal"><LogoMark /></div>
        <p className="opening-kicker">A little future, for us</p>
        <h1 id="opening-title">Future<br />With You</h1>
        <p className="opening-subtitle">写给我们还没发生的日子</p>
        <div className="opening-note"><p>这里不再只是一张愿望清单。</p><p>它会收藏今天的答案、你写下的期待，和未来打开的信。</p></div>
        <button type="button" className="primary-button opening-button" onClick={onEnter}>
          <span>{returning ? '回到我们的空间' : '拆开这份礼物'}</span><span aria-hidden="true">→</span>
        </button>
        <div className="opening-details" aria-label="礼物内容"><span>今天</span><span aria-hidden="true">·</span><span>愿望</span><span aria-hidden="true">·</span><span>回忆</span><span aria-hidden="true">·</span><span>我们</span></div>
      </div>
    </section>
  )
}

