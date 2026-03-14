import React from 'react'
import { useDPad }    from '../../cloudphone-ui/src/hooks/useDPad'
import { useStorage } from '../../cloudphone-ui/src/hooks/useStorage'
import { sfx }        from '../../cloudphone-ui/src/engine/sound'
import { CP_KEYS }    from '../../cloudphone-ui/src/types'

export function MenuScreen({ onPlay, onRecords }: { onPlay: () => void; onRecords: () => void }) {
  const items = ['QUICK RACE', 'RECORDS']
  const { isFocused } = useDPad({
    length: 2, axis: 'vertical',
    onConfirm: (i) => { sfx.play('select'); i === 0 ? onPlay() : onRecords() },
    onChange: () => sfx.play('nav'),
  })

  return (
    <div className="w-[240px] h-[320px] bg-black flex flex-col items-center justify-center font-mono relative overflow-hidden">
      {/* Background road lines */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.04]">
        {[...Array(6)].map((_,i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{left:`${8+i*16}%`, width:'2px', background:'#fff'}} />
        ))}
      </div>

      <div className="font-hud text-[32px] font-bold tracking-[6px] leading-none" style={{color:'#ff2d78'}}>TAR</div>
      <div className="font-hud text-[32px] font-bold tracking-[6px]" style={{color:'#00f5ff'}}>BLAZER</div>
      <div className="w-[140px] h-[1px] my-4" style={{background:'linear-gradient(90deg,transparent,#ff2d78,#00f5ff,transparent)'}} />
      <div className="text-[7px] tracking-[3px] mb-6" style={{color:'#333'}}>THREE.JS · CUBE RACER</div>

      {items.map((label, i) => (
        <div
          key={label}
          onClick={() => { sfx.play('select'); i === 0 ? onPlay() : onRecords() }}
          className="w-[160px] h-[32px] flex items-center justify-center mb-2 text-[10px] tracking-[2px] cursor-pointer transition-all"
          style={{
            border: `1px solid ${isFocused(i) ? '#00f5ff' : '#1a1a3e'}`,
            color:  isFocused(i) ? '#00f5ff' : '#444',
            background: isFocused(i) ? '#020218' : 'transparent',
          }}
        >
          {isFocused(i) ? '▶ ' : '  '}{label}
        </div>
      ))}

      <div className="absolute bottom-8 text-[7px] tracking-widest" style={{color:'#1a1a3a'}}>↑↓ MOVE  ● SELECT</div>
    </div>
  )
}

export function RecordsScreen({ onBack }: { onBack: () => void }) {
  const [hs] = useStorage<number>('tb_hs', 0)

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === CP_KEYS.RSK || e.key === 'Backspace') { sfx.play('back'); onBack() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onBack])

  return (
    <div className="w-[240px] h-[320px] bg-black flex flex-col font-mono">
      <div className="h-[40px] flex-shrink-0 flex items-center px-3"
        style={{background:'#08080f', borderBottom:'1px solid #1a1a3e'}}>
        <span className="font-hud text-[10px] font-bold tracking-widest" style={{color:'#fbbf24'}}>RECORDS</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-full px-3 py-4 flex flex-col items-center gap-1"
          style={{background:'#08080f', border:'1px solid #1a1a3e', borderRadius:3}}>
          <div className="text-[7px] tracking-widest" style={{color:'#555'}}>ALL-TIME HIGH SCORE</div>
          <div className="font-hud text-[28px] font-bold" style={{color: hs > 0 ? '#fbbf24' : '#333'}}>
            {hs > 0 ? Math.floor(hs).toLocaleString() : '---'}
          </div>
          {hs <= 0 && <div className="text-[7px]" style={{color:'#333'}}>Play a race to set a record</div>}
        </div>
      </div>
      <div className="h-[24px] flex-shrink-0 flex items-center justify-end px-3"
        style={{background:'#08080f', borderTop:'1px solid #1a1a3e'}}>
        <span className="text-[8px] cursor-pointer" style={{color:'#444'}} onClick={onBack}>BACK</span>
      </div>
    </div>
  )
}
