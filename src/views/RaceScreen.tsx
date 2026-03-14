import React, { useEffect, useRef, useCallback, useState } from 'react'
import { TarBlazerScene } from '../engine/scene'
import { GameEngine, Keys, GamePhase } from '../engine/game'
import { sfx } from '../../cloudphone-ui/src/engine/sound'

const W = 240, H = 320

function fmtScore(n: number) { return Math.floor(n).toLocaleString() }

export function RaceScreen({ onMenu }: { onMenu: () => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sceneRef   = useRef<TarBlazerScene | null>(null)
  const engineRef  = useRef<GameEngine | null>(null)
  const keysRef    = useRef<Keys>({ up:false, down:false, left:false, right:false, turbo:false })
  const rafRef     = useRef<number>(0)
  const lastRef    = useRef<number>(0)
  const [phase,    setPhase]    = useState<GamePhase>('idle')
  const [hud,      setHud]      = useState({ speed:5, score:0, lives:3, turbo:128, countdown:3 })

  // ── Init Three.js scene ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = W; canvas.height = H

    let scene: TarBlazerScene
    try {
      scene = new TarBlazerScene(canvas)
    } catch (e) {
      console.error('Three.js init failed', e)
      return
    }
    sceneRef.current  = scene
    engineRef.current = new GameEngine(scene)

    // Render idle frame
    scene.renderer.render(scene.scene, scene.camera)

    return () => {
      cancelAnimationFrame(rafRef.current)
      scene.dispose()
    }
  }, [])

  // ── Game loop — use refs only, no useCallback ──────────
  // useCallback with [] captures stale refs; storing loop in a ref fixes this
  const loopRef = useRef<(ts: number) => void>()

  loopRef.current = (ts: number) => {
    const engine = engineRef.current
    if (!engine) return
    const dt = Math.min((ts - lastRef.current) / 1000, 0.05)
    lastRef.current = ts

    engine.update(dt, ts, keysRef.current)
    const s = engine.state

    setHud({
      speed:     Math.floor(s.speed * 9),
      score:     s.score,
      lives:     s.lives,
      turbo:     s.turbo,
      countdown: s.countdown,
    })
    setPhase(s.phase)

    if (s.phase === 'playing' || s.phase === 'countdown') {
      rafRef.current = requestAnimationFrame(ts => loopRef.current!(ts))
    }
  }

  const startGame = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    sfx.play('go')
    engine.startGame()
    cancelAnimationFrame(rafRef.current)
    lastRef.current = performance.now()
    rafRef.current  = requestAnimationFrame(ts => loopRef.current!(ts))
  }, [])

  // ── Keyboard input ─────────────────────────────────────
  // Use a ref for phase so the keydown handler always sees current value
  const phaseRef = useRef<GamePhase>('idle')
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = keysRef.current
      const p = phaseRef.current
      if (e.key==='ArrowUp'   ||e.key==='w'||e.key==='W') k.up=true
      if (e.key==='ArrowDown' ||e.key==='s'||e.key==='S') k.down=true
      if (e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') k.left=true
      if (e.key==='ArrowRight'||e.key==='d'||e.key==='D') k.right=true
      if (e.key===' '||e.key==='Shift') k.turbo=true
      // Start / retry: Enter, Space, or Escape all work
      if ((e.key==='Enter'||e.key===' '||e.key==='Escape') && (p==='idle'||p==='gameover')) {
        e.preventDefault()
        startGame()
        return
      }
      if (e.key==='Backspace' && (p==='idle'||p==='gameover')) onMenu()
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      const k = keysRef.current
      if (e.key==='ArrowUp'   ||e.key==='w'||e.key==='W') k.up=false
      if (e.key==='ArrowDown' ||e.key==='s'||e.key==='S') k.down=false
      if (e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') k.left=false
      if (e.key==='ArrowRight'||e.key==='d'||e.key==='D') k.right=false
      if (e.key===' '||e.key==='Shift') k.turbo=false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [startGame, onMenu])  // no `phase` dependency — using phaseRef instead

  const turboColor = hud.turbo > 50 ? '#00f5ff' : hud.turbo > 20 ? '#fbbf24' : '#ff2d78'

  return (
    <div className="w-[240px] h-[320px] bg-black flex flex-col relative overflow-hidden font-mono">

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ display:'block', width:W, height:H, position:'absolute', top:0, left:0 }} />

      {/* HUD — top bar */}
      <div className="absolute top-0 left-0 right-0 h-[36px] flex items-center justify-between px-2"
        style={{ background:'rgba(0,0,0,0.72)', borderBottom:'1px solid #1a1a3e', zIndex:10 }}>
        <div className="flex flex-col">
          <span className="text-[6px] tracking-widest" style={{color:'#555'}}>KM/H</span>
          <span className="font-hud text-[13px] font-bold leading-none" style={{color:'#00f5ff'}}>{hud.speed}</span>
        </div>
        <div className="flex flex-col items-center gap-[3px]">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-[8px] h-[8px] rounded-full"
                style={{background: i < hud.lives ? '#ff2d78' : '#333'}} />
            ))}
          </div>
          <div className="w-[56px] h-[4px] rounded-sm overflow-hidden" style={{background:'#111'}}>
            <div className="h-full rounded-sm transition-all duration-100"
              style={{ width:`${hud.turbo}%`, background: turboColor }} />
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[6px] tracking-widest" style={{color:'#555'}}>SCORE</span>
          <span className="font-hud text-[13px] font-bold leading-none" style={{color:'#fbbf24'}}>{fmtScore(hud.score)}</span>
        </div>
      </div>

      {/* Softkey bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[24px] flex items-center justify-between px-2"
        style={{ background:'rgba(0,0,0,0.8)', borderTop:'1px solid #1a1a3e', zIndex:10 }}>
        <span className="text-[8px]" style={{color:'#00f5ff'}}>TURBO</span>
        <span className="text-[7px]" style={{color:'#2a2a4a'}}>← → STEER  ↑ GAS</span>
        <span className="text-[8px] cursor-pointer" style={{color:'#444'}} onClick={onMenu}>QUIT</span>
      </div>

      {/* Countdown overlay */}
      {phase === 'countdown' && hud.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center" style={{zIndex:20, background:'rgba(0,0,0,0.45)', pointerEvents:'none'}}>
          <span className="font-hud font-bold text-[72px] leading-none" style={{color:'#00f5ff'}}>{hud.countdown}</span>
        </div>
      )}

      {/* GO flash */}
      {phase === 'playing' && hud.score < 0.5 && (
        <div className="absolute inset-0 flex items-center justify-center" style={{zIndex:20, pointerEvents:'none'}}>
          <span className="font-hud font-bold text-[42px]" style={{color:'#fbbf24'}}>GO!</span>
        </div>
      )}

      {/* Menu overlay */}
      {phase === 'idle' && (
        <MenuOverlay onStart={startGame} onMenu={onMenu} />
      )}

      {/* Game Over overlay */}
      {phase === 'gameover' && (
        <GameOverOverlay
          score={hud.score}
          highScore={engineRef.current?.state.highScore ?? 0}
          onRetry={startGame}
          onMenu={onMenu}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────

function DKey({ label, color='#666', onDown, onUp }: {
  label: string; color?: string; onDown: () => void; onUp: () => void
}) {
  return (
    <div
      onPointerDown={e => { e.preventDefault(); onDown() }}
      onPointerUp={e => { e.preventDefault(); onUp() }}
      onPointerLeave={e => { e.preventDefault(); onUp() }}
      style={{
        width:34, height:22, background:'#111', border:`1px solid #222`,
        borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:9, color, cursor:'pointer', userSelect:'none', touchAction:'none',
        fontFamily:'monospace',
      }}
    >{label}</div>
  )
}

function MenuOverlay({ onStart, onMenu }: { onStart: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{background:'rgba(0,0,0,0.92)', zIndex:30}}>
      <div className="font-hud text-[28px] font-bold tracking-[6px] leading-none" style={{color:'#ff2d78'}}>TAR</div>
      <div className="font-hud text-[28px] font-bold tracking-[6px] mb-3" style={{color:'#00f5ff'}}>BLAZER</div>
      <div className="w-[120px] h-[1px] mb-4" style={{background:'linear-gradient(90deg,transparent,#ff2d78,#00f5ff,transparent)'}} />
      <div className="text-[8px] tracking-[3px] mb-6" style={{color:'#444'}}>THREE.JS · CUBE RACER</div>
      <div onClick={onStart} className="cursor-pointer px-7 py-2 text-[10px] tracking-[3px]"
        style={{border:'1px solid #00f5ff', color:'#00f5ff'}}>START</div>
      <div className="mt-5 text-[7px] text-center leading-[2]" style={{color:'#333'}}>
        ↑↓ GAS/BRAKE · ← → STEER<br/>WASD WORKS · SPACE = TURBO
      </div>
    </div>
  )
}

function GameOverOverlay({ score, highScore, onRetry, onMenu }: {
  score: number; highScore: number; onRetry: () => void; onMenu: () => void
}) {
  const isNew = score >= highScore && score > 0
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{background:'rgba(0,0,0,0.92)', zIndex:30}}>
      <div className="font-hud text-[18px] font-bold tracking-[4px]" style={{color:'#ff2d78'}}>GAME OVER</div>
      <div className="text-[7px] tracking-[2px] mt-1" style={{color:'#555'}}>FINAL SCORE</div>
      <div className="font-hud text-[28px] font-bold" style={{color:'#fbbf24'}}>{fmtScore(score)}</div>
      {isNew
        ? <div className="text-[8px] tracking-[2px]" style={{color:'#4ade80'}}>★ NEW HIGH SCORE!</div>
        : <div className="text-[8px]" style={{color:'#444'}}>BEST: {fmtScore(highScore)}</div>
      }
      <div className="flex gap-3 mt-4">
        <div onClick={onRetry} className="cursor-pointer px-5 py-2 text-[9px] tracking-[2px]"
          style={{border:'1px solid #ff2d78', color:'#ff2d78'}}>RETRY</div>
        <div onClick={onMenu} className="cursor-pointer px-5 py-2 text-[9px] tracking-[2px]"
          style={{border:'1px solid #444', color:'#444'}}>MENU</div>
      </div>
    </div>
  )
}
