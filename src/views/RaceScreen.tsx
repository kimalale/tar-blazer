import React, { useEffect, useRef, useCallback, useState } from 'react'
import { TarBlazerScene } from '../engine/scene'
import { GameEngine, Keys, GamePhase } from '../engine/game'
import { sfx } from '../../cloudphone-ui/src/engine/sound'

const W = 240, H = 320
function fmtScore(n: number) { return Math.floor(n).toLocaleString() }
function fmtDist(m: number)  { return m >= 1000 ? `${(m/1000).toFixed(1)}km` : `${Math.floor(m)}m` }

export function RaceScreen({ onMenu }: { onMenu: () => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const engineRef  = useRef<GameEngine | null>(null)
  const keysRef    = useRef<Keys>({ left:false, right:false, nitro:false })
  const rafRef     = useRef<number>(0)
  const lastRef    = useRef<number>(0)
  const loopRef    = useRef<(ts: number) => void>()
  const phaseRef   = useRef<GamePhase>('idle')

  const [phase,    setPhase]    = useState<GamePhase>('idle')
  const [hud,      setHud]      = useState({
    speed: 0, score: 0, lives: 3, nitro: 100,
    combo: 1, distance: 0, countdown: 3,
  })

  // ── Init scene ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = W; canvas.height = H
    let scene: TarBlazerScene
    try { scene = new TarBlazerScene(canvas) }
    catch (e) { console.error('Three.js init failed', e); return }
    engineRef.current = new GameEngine(scene)
    scene.renderer.render(scene.scene, scene.camera)
    return () => { cancelAnimationFrame(rafRef.current); scene.dispose() }
  }, [])

  // ── Game loop — ref-based to avoid stale closures ──────
  loopRef.current = (ts: number) => {
    const engine = engineRef.current
    if (!engine) return
    const dt = Math.min((ts - lastRef.current) / 1000, 0.05)
    lastRef.current = ts

    engine.update(dt, ts, keysRef.current)
    const s = engine.state

    setHud({
      speed:    Math.floor(s.speed * 9),
      score:    s.score,
      lives:    s.lives,
      nitro:    s.nitro,
      combo:    s.combo,
      distance: s.distance,
      countdown: s.countdown,
    })
    setPhase(s.phase)
    phaseRef.current = s.phase

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

  // ── Keyboard ───────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = keysRef.current; const p = phaseRef.current
      if (e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') k.left=true
      if (e.key==='ArrowRight'||e.key==='d'||e.key==='D') k.right=true
      if (e.key===' '||e.key==='Shift'||e.key==='ArrowUp'||e.key==='w'||e.key==='W') k.nitro=true
      if ((e.key==='Enter'||e.key===' '||e.key==='Escape') && (p==='idle'||p==='gameover')) {
        e.preventDefault(); startGame(); return
      }
      if (e.key==='Backspace' && (p==='idle'||p==='gameover')) onMenu()
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      const k = keysRef.current
      if (e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') k.left=false
      if (e.key==='ArrowRight'||e.key==='d'||e.key==='D') k.right=false
      if (e.key===' '||e.key==='Shift'||e.key==='ArrowUp'||e.key==='w'||e.key==='W') k.nitro=false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [startGame, onMenu])

  const nitroColor = hud.nitro > 60 ? '#00aaff' : hud.nitro > 25 ? '#fbbf24' : '#ff2d78'

  return (
    <div className="w-[240px] h-[320px] bg-black flex flex-col relative overflow-hidden font-mono">

      <canvas ref={canvasRef} style={{ display:'block', width:W, height:H, position:'absolute', top:0, left:0 }} />

      {/* HUD top bar */}
      <div className="absolute top-0 left-0 right-0 h-[38px] flex items-center justify-between px-2"
        style={{ background:'rgba(0,0,0,0.55)', borderBottom:'1px solid rgba(255,255,255,0.1)', zIndex:10 }}>

        {/* Speed */}
        <div className="flex flex-col items-center min-w-[36px]">
          <span className="text-[6px] tracking-widest" style={{color:'rgba(255,255,255,0.4)'}}>KM/H</span>
          <span className="font-hud text-[14px] font-bold leading-none" style={{color:'#fff'}}>{hud.speed}</span>
        </div>

        {/* Centre — combo + nitro */}
        <div className="flex flex-col items-center gap-[3px] flex-1 mx-2">
          {hud.combo > 1 && (
            <div className="font-hud text-[9px] font-bold tracking-wide" style={{color:'#fbbf24'}}>
              x{hud.combo} COMBO!
            </div>
          )}
          <div className="w-full h-[4px] rounded-sm overflow-hidden" style={{background:'rgba(0,0,0,0.5)'}}>
            <div className="h-full rounded-sm transition-all duration-100"
              style={{ width:`${hud.nitro}%`, background: nitroColor }} />
          </div>
          <span className="text-[6px] tracking-widest" style={{color:'rgba(255,255,255,0.35)'}}>NITRO</span>
        </div>

        {/* Lives + score */}
        <div className="flex flex-col items-end">
          <div className="flex gap-1 mb-[2px]">
            {[0,1,2].map(i => (
              <div key={i} className="w-[7px] h-[7px] rounded-full"
                style={{background: i < hud.lives ? '#ff2d78' : 'rgba(255,255,255,0.15)'}} />
            ))}
          </div>
          <span className="font-hud text-[11px] font-bold leading-none" style={{color:'#fbbf24'}}>{fmtScore(hud.score)}</span>
        </div>
      </div>

      {/* Distance — bottom left above softkey */}
      <div className="absolute left-2 font-mono text-[8px]"
        style={{bottom:28, color:'rgba(255,255,255,0.5)', zIndex:10}}>
        {fmtDist(hud.distance)}
      </div>

      {/* Softkey bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[24px] flex items-center justify-between px-2"
        style={{ background:'rgba(0,0,0,0.7)', borderTop:'1px solid rgba(255,255,255,0.08)', zIndex:10 }}>
        <span className="text-[8px]" style={{color:'#00aaff'}}>NITRO</span>
        <span className="text-[7px]" style={{color:'rgba(255,255,255,0.25)'}}>← → STEER  SPACE BOOST</span>
        <span className="text-[8px] cursor-pointer" style={{color:'rgba(255,255,255,0.3)'}} onClick={onMenu}>QUIT</span>
      </div>

      {/* Countdown */}
      {phase === 'countdown' && hud.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{zIndex:20}}>
          <span className="font-hud font-bold text-[80px] leading-none"
            style={{color:'#fff', textShadow:'0 0 20px rgba(0,0,0,0.5)'}}>{hud.countdown}</span>
        </div>
      )}

      {/* GO */}
      {phase === 'playing' && hud.score < 1 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{zIndex:20}}>
          <span className="font-hud font-bold text-[48px]" style={{color:'#fbbf24'}}>GO!</span>
        </div>
      )}

      {/* Menu overlay */}
      {phase === 'idle' && <MenuOverlay onStart={startGame} onMenu={onMenu} />}

      {/* Game over */}
      {phase === 'gameover' && (
        <GameOverOverlay
          score={hud.score}
          distance={hud.distance}
          highScore={engineRef.current?.state.highScore ?? 0}
          onRetry={startGame}
          onMenu={onMenu}
        />
      )}
    </div>
  )
}

function MenuOverlay({ onStart, onMenu }: { onStart: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center"
      style={{background:'rgba(0,0,0,0.78)', zIndex:30}}>
      <div className="font-hud text-[30px] font-bold tracking-[6px] leading-none" style={{color:'#f5c518'}}>TAR</div>
      <div className="font-hud text-[30px] font-bold tracking-[6px] mb-3" style={{color:'#f5c518'}}>BLAZER</div>
      <div className="w-[130px] h-[1px] mb-4" style={{background:'linear-gradient(90deg,transparent,#f5c518,#ffffff,transparent)'}} />
      <div className="text-[8px] tracking-[3px] mb-5" style={{color:'rgba(255,255,255,0.35)'}}>CRUISE · DODGE · COMBO</div>
      <div onClick={onStart} className="cursor-pointer px-8 py-2 text-[10px] tracking-[3px] mb-2"
        style={{border:'1px solid #f5c518', color:'#f5c518', background:'rgba(245,197,24,0.1)'}}>START</div>
      <div className="mt-4 text-[7px] text-center leading-[2]" style={{color:'rgba(255,255,255,0.3)'}}>
        ← → STEER &nbsp;·&nbsp; SPACE / W / ↑ = NITRO<br/>
        NEAR MISSES BUILD COMBO MULTIPLIER
      </div>
    </div>
  )
}

function GameOverOverlay({ score, distance, highScore, onRetry, onMenu }: {
  score: number; distance: number; highScore: number; onRetry: () => void; onMenu: () => void
}) {
  const isNew = score >= highScore && score > 0
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
      style={{background:'rgba(0,0,0,0.85)', zIndex:30}}>
      <div className="font-hud text-[18px] font-bold tracking-[4px]" style={{color:'#ff4400'}}>GAME OVER</div>
      <div className="w-[160px] mt-2 mb-2 px-4 py-3 flex flex-col gap-2 rounded"
        style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}>
        <div className="flex justify-between">
          <span className="text-[7px] tracking-wide" style={{color:'rgba(255,255,255,0.4)'}}>SCORE</span>
          <span className="font-hud text-[11px]" style={{color:'#fbbf24'}}>{fmtScore(score)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[7px] tracking-wide" style={{color:'rgba(255,255,255,0.4)'}}>DISTANCE</span>
          <span className="font-hud text-[11px]" style={{color:'#fff'}}>
            {distance >= 1000 ? `${(distance/1000).toFixed(2)}km` : `${Math.floor(distance)}m`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[7px] tracking-wide" style={{color:'rgba(255,255,255,0.4)'}}>BEST</span>
          <span className="font-hud text-[11px]" style={{color: isNew ? '#4ade80' : 'rgba(255,255,255,0.5)'}}>
            {isNew ? '★ NEW!' : fmtScore(highScore)}
          </span>
        </div>
      </div>
      <div className="flex gap-3 mt-1">
        <div onClick={onRetry} className="cursor-pointer px-5 py-2 text-[9px] tracking-[2px]"
          style={{border:'1px solid #f5c518', color:'#f5c518', background:'rgba(245,197,24,0.1)'}}>RETRY</div>
        <div onClick={onMenu} className="cursor-pointer px-5 py-2 text-[9px] tracking-[2px]"
          style={{border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.4)'}}>MENU</div>
      </div>
    </div>
  )
}
