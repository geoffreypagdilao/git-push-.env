import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// Tiny screen-stack navigator — no router dependency. A screen is
// { name, props }. push/replace/back/reset operate on the stack.

const NavContext = createContext(null)

export function NavProvider({ initial = 'onboarding', children }) {
  const [stack, setStack] = useState([{ name: initial, props: {} }])

  const push = useCallback((name, props = {}) => {
    setStack((s) => [...s, { name, props }])
  }, [])

  const replace = useCallback((name, props = {}) => {
    setStack((s) => [...s.slice(0, -1), { name, props }])
  }, [])

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  // Jump to a top-level screen: reset the stack so back doesn't pile up.
  const go = useCallback((name, props = {}) => {
    setStack([{ name, props }])
  }, [])

  const reset = useCallback((name = 'onboarding') => {
    setStack([{ name, props: {} }])
  }, [])

  const current = stack[stack.length - 1]

  const value = useMemo(
    () => ({ current, canGoBack: stack.length > 1, push, replace, back, go, reset }),
    [current, stack.length, push, replace, back, go, reset],
  )

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>')
  return ctx
}
