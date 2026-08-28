import './styles.css'
import AppShell from './components/AppShell'
import BottomNav from './components/BottomNav'
import { NavProvider, useNav } from './lib/navigation'
import { StoreProvider, useStore } from './lib/store'
import Onboarding from './screens/Onboarding'
import BaselineScan from './screens/BaselineScan'
import MyFridge from './screens/MyFridge'
import ShoppingList from './screens/ShoppingList'
import Recipe from './screens/Recipe'

const SCREENS = {
  onboarding: Onboarding,
  scan: BaselineScan,
  fridge: MyFridge,
  shopping: ShoppingList,
  recipe: Recipe,
}

const WITH_NAV = new Set(['fridge', 'shopping', 'recipe'])

function Router() {
  const { current } = useNav()
  const Screen = SCREENS[current.name] || MyFridge
  const key = current.name + (current.props.seedItem || '')
  return (
    <AppShell>
      <Screen key={key} {...current.props} />
      {WITH_NAV.has(current.name) && <BottomNav />}
    </AppShell>
  )
}

function Root() {
  const { state } = useStore()
  return (
    <NavProvider initial={state.onboarded ? 'fridge' : 'onboarding'}>
      <Router />
    </NavProvider>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  )
}
