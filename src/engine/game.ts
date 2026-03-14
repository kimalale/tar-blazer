// ─────────────────────────────────────────────────────────
// Tar Blazer v2 — Game Logic
// Pure state machine — no Three.js here, only numbers.
// ─────────────────────────────────────────────────────────

import { TarBlazerScene } from './scene'

const ROAD_W = 3.8

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'dead' | 'gameover'

export interface GameState {
  phase:        GamePhase
  speed:        number
  carX:         number
  carVX:        number
  score:        number
  lives:        number
  turbo:        number
  turboActive:  boolean
  countdown:    number
  cdTimer:      number
  spawnTimer:   number
  highScore:    number
}

export const INITIAL_STATE = (): GameState => ({
  phase: 'idle', speed: 5, carX: 0, carVX: 0,
  score: 0, lives: 3, turbo: 120, turboActive: false,
  countdown: 3, cdTimer: 0, spawnTimer: 0, highScore: 0,
})

export interface Keys {
  up: boolean; down: boolean; left: boolean; right: boolean; turbo: boolean
}

export class GameEngine {
  state:   GameState
  private scene: TarBlazerScene

  constructor(scene: TarBlazerScene) {
    this.scene = scene
    this.state = INITIAL_STATE()
    this.state.highScore = parseInt(localStorage.getItem('tb_hs') || '0')
  }

  startGame() {
    // Clear obstacles
    while (this.scene.obstacles.length) this.scene.removeObstacle(0)
    this.scene.resetCarPosition()

    const prev = this.state.highScore
    this.state = INITIAL_STATE()
    this.state.highScore  = prev
    this.state.phase      = 'countdown'
    this.state.countdown  = 3
    this.state.cdTimer    = 0
  }

  update(dt: number, ts: number, keys: Keys) {
    const s = this.state

    // ── Countdown ──────────────────────────────────────
    if (s.phase === 'countdown') {
      s.cdTimer += dt
      if (s.cdTimer >= 1) {
        s.cdTimer = 0
        s.countdown--
        if (s.countdown <= 0) s.phase = 'playing'
      }
      this.scene.update(dt, ts, 0, s.carX, s.carVX)
      return
    }

    if (s.phase !== 'playing') return

    // ── Turbo ───────────────────────────────────────────
    s.turboActive = keys.turbo && s.turbo > 3
    s.turbo = s.turboActive
      ? Math.max(0, s.turbo - 45 * dt)
      : Math.min(100, s.turbo + 18 * dt)

    // ── Speed ───────────────────────────────────────────
    const topSpd = s.turboActive ? 80 : 40
    if (keys.up)        s.speed += (topSpd - s.speed) * 3.5 * dt
    else if (keys.down) s.speed -= s.speed * 5 * dt
    else                s.speed -= s.speed * 2 * dt
    s.speed = Math.max(0, Math.min(topSpd, s.speed))

    // ── Steering ────────────────────────────────────────
    const steer = 3.0 + s.speed * 0.07
    if (keys.left)  s.carVX -= steer * dt
    if (keys.right) s.carVX += steer * dt
    s.carVX *= 0.80
    s.carX  += s.carVX * dt * 60
    s.carX   = Math.max(-ROAD_W + 0.6, Math.min(ROAD_W - 0.6, s.carX))

    // ── Spawn obstacles ──────────────────────────────────
    s.spawnTimer += dt
    const spawnRate = Math.max(0.55, 2.2 - s.score / 1200)
    if (s.spawnTimer > spawnRate) { this.scene.spawnObstacle(); s.spawnTimer = 0 }

    // ── Collision ────────────────────────────────────────
    const carPosX = s.carX
    for (let i = this.scene.obstacles.length - 1; i >= 0; i--) {
      const o   = this.scene.obstacles[i]
      const pos = o.mesh.position
      const dx  = Math.abs(carPosX - pos.x)
      const dz  = Math.abs(pos.z - 2.2)

      if (dx < o.w / 2 + 0.42 && dz < o.h / 2 + 0.72 && pos.z > 0 && pos.z < 5.5) {
        this.scene.removeObstacle(i)
        s.lives--
        s.speed  *= 0.28
        s.carVX  += (Math.random() - 0.5) * 5
        this.scene.triggerHitFlash()

        if (s.lives <= 0) {
          s.phase = 'gameover'
          if (s.score > s.highScore) {
            s.highScore = s.score
            localStorage.setItem('tb_hs', String(Math.floor(s.score)))
          }
        }
        continue
      }
      if (pos.z > 9) this.scene.removeObstacle(i)
    }

    // ── Score ────────────────────────────────────────────
    s.score += s.speed * dt * 2

    // ── Scene update ─────────────────────────────────────
    this.scene.update(dt, ts, s.speed, s.carX, s.carVX)
  }
}
