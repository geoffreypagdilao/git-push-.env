import { useState } from 'react'
import Icon from '../components/Icon'
import { useNav } from '../lib/navigation'

const STICKER_URL = (f) => `${import.meta.env.BASE_URL}stickers/${f}`

// scattered plate — hand-placed, % of the stage
const PLATE = [
  { src: 'lettuce.png', top: 20, left: 30, size: 96, rot: -10 },
  { src: 'tomato.png', top: 14, left: 60, size: 104, rot: 8 },
  { src: 'cheese.png', top: 52, left: 33, size: 100, rot: -6 },
  { src: 'avocado.png', top: 50, left: 62, size: 98, rot: 12 },
]

const SUGGESTIONS = ['15 min recipes', 'Easy breakfast', 'Tomato soup', 'Use what expires first']

export default function AskRecipe() {
  const nav = useNav()
  const [text, setText] = useState('')
  const [reply, setReply] = useState(null)

  const submit = (q) => {
    const prompt = (q ?? text).trim()
    if (!prompt) return
    setReply({
      prompt,
      title: 'Charred Broccoli & Egg Bowl',
      line: 'Based on what’s in your fridge, this comes together in 25 minutes and uses the broccoli and eggs first.',
    })
    setText('')
  }

  return (
    <div className="screen ask">
      <div className="ask__bar">
        <span className="wordmark ask__wordmark">yoink!</span>
        <button
          type="button"
          className="ask__icon-btn"
          aria-label="Back to recipe"
          onClick={() => nav.replace('recipe')}
        >
          <Icon name="arrow-left" size={20} />
        </button>
      </div>

      <div className="screen__scroll ask__body">
        {reply ? (
          <div className="ask__thread">
            <p className="ask__you">{reply.prompt}</p>
            <div className="ask__ai">
              <span className="ask__ai-spark">
                <Icon name="sparkle" size={14} />
              </span>
              <div>
                <p className="ask__ai-line">{reply.line}</p>
                <button
                  type="button"
                  className="ask__ai-open"
                  onClick={() => nav.push('recipe', { seedItem: 'Broccoli' })}
                >
                  Open {reply.title}
                  <Icon name="chevron-right" size={15} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="ask__stage">
              {PLATE.map((s) => (
                <img
                  key={s.src}
                  className="ask__sticker"
                  src={STICKER_URL(s.src)}
                  alt=""
                  style={{
                    top: `${s.top}%`,
                    left: `${s.left}%`,
                    width: `${s.size}px`,
                    '--rotation': `${s.rot}deg`,
                  }}
                />
              ))}
              <span className="ask__plus ask__plus--a" aria-hidden="true">
                <Icon name="plus" size={18} />
              </span>
              <span className="ask__plus ask__plus--b" aria-hidden="true">
                <Icon name="plus" size={18} />
              </span>
            </div>
            <p className="ask__lead">
              Let’s find out what’s <strong>on your plate</strong>
            </p>
          </>
        )}
      </div>

      <div className="ask__composer">
        {!reply && (
          <div className="ask__chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ask__chip" onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="ask__inputwrap"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            className="ask__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the dish…"
          />
          <div className="ask__inputrow">
            <button type="button" className="ask__upload">
              <Icon name="upload" size={15} />
              Upload
            </button>
            <button type="submit" className="ask__send" aria-label="Ask" disabled={!text.trim()}>
              <Icon name="arrow-up" size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
