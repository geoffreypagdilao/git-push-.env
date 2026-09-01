import { useState } from 'react'
import Icon from '../components/Icon'
import { useNav } from '../lib/navigation'
import { chatWithAgent } from '../lib/api'

const STICKER_URL = (f) => `${import.meta.env.BASE_URL}stickers/${f}`

// scattered plate — hand-placed, % of the stage
const PLATE = [
  { src: 'lettuce.png', top: 20, left: 30, size: 96, rot: -10 },
  { src: 'tomato.png', top: 14, left: 60, size: 104, rot: 8 },
  { src: 'cheese.png', top: 52, left: 33, size: 100, rot: -6 },
  { src: 'avocado.png', top: 50, left: 62, size: 98, rot: 12 },
]

const SUGGESTIONS = ["What's about to expire?", 'Should I restock anything?', 'Substitute for eggs?', 'Add milk to my list']

export default function AskRecipe() {
  const nav = useNav()
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([]) // {role: 'user' | 'assistant', content}
  const [sending, setSending] = useState(false)

  const submit = (q) => {
    const prompt = (q ?? text).trim()
    if (!prompt || sending) return
    const next = [...messages, { role: 'user', content: prompt }]
    setMessages(next)
    setText('')
    setSending(true)
    chatWithAgent(next)
      .then((result) => {
        setMessages((m) => [...m, { role: 'assistant', content: result.reply }])
      })
      .catch((err) => {
        setMessages((m) => [...m, { role: 'assistant', content: `Sorry, something went wrong. (${err.message})` }])
      })
      .finally(() => setSending(false))
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
        {messages.length > 0 ? (
          <div className="ask__thread">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <p className="ask__you" key={i}>
                  {m.content}
                </p>
              ) : (
                <div className="ask__ai" key={i}>
                  <span className="ask__ai-spark">
                    <Icon name="sparkle" size={14} />
                  </span>
                  <p className="ask__ai-line">{m.content}</p>
                </div>
              ),
            )}
            {sending && (
              <div className="ask__ai">
                <span className="ask__ai-spark">
                  <Icon name="sparkle" size={14} />
                </span>
                <p className="ask__ai-line">Thinking…</p>
              </div>
            )}
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
              Ask about <strong>your fridge</strong>
            </p>
          </>
        )}
      </div>

      <div className="ask__composer">
        {messages.length === 0 && (
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
            placeholder="Ask about your fridge…"
            disabled={sending}
          />
          <div className="ask__inputrow">
            <button type="button" className="ask__upload">
              <Icon name="upload" size={15} />
              Upload
            </button>
            <button type="submit" className="ask__send" aria-label="Ask" disabled={!text.trim() || sending}>
              <Icon name="arrow-up" size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
