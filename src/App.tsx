import React, { useState } from 'react'
import { MenuScreen, RecordsScreen } from './views/MenuScreen'
import { RaceScreen } from './views/RaceScreen'

type View = 'menu' | 'race' | 'records'

export function App() {
  const [view, setView] = useState<View>('menu')

  if (view === 'menu')    return <MenuScreen   onPlay={() => setView('race')} onRecords={() => setView('records')} />
  if (view === 'records') return <RecordsScreen onBack={() => setView('menu')} />
  if (view === 'race')    return <RaceScreen    onMenu={() => setView('menu')} />
  return null
}
