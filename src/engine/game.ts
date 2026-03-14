// ─────────────────────────────────────────────────────────
// Tar Blazer v2 — Game Logic
// Cruise control: car always moves. Player steers + boosts.
// Near-miss combo: pass close to obstacle = multiplier up.
// ─────────────────────────────────────────────────────────

import { TarBlazerScene, CAR_Z } from './scene'

const ROAD_W       = 3.9
const BASE_SPEED   = 10       // cruise speed — always on
const MAX_SPEED    = 26      // nitro boost cap
const ACCEL_RATE   = 0.08    // how fast speed ramps up to base on start
const NITRO_BOOST  = 22
const NITRO_DRAIN  = 10       // per second
const NITRO_REGEN  = 14       // per second
const NEAR_MISS_DX = 0.9      // how close to count as near-miss (world units)

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'gameover'

export interface GameState {
  phase:        GamePhase
  speed:        number
  carX:         number
  carVX:        number
  score:        number
  lives:        number
  nitro:        number    // 0–100
  nitroActive:  boolean
  combo:        number    // near-miss multiplier
  comboTimer:   number    // countdown to reset combo
  countdown:    number
  cdTimer:      number
  spawnTimer:   number
  highScore:    number
  distance:     number    // metres travelled
}

export const INITIAL_STATE = (): GameState => ({
  phase: 'idle', speed: 0, carX: 0, carVX: 0,
  score: 0, lives: 3, nitro: 100, nitroActive: false,
  combo: 1, comboTimer: 0,
  countdown: 3, cdTimer: 0, spawnTimer: 0,
  highScore: 0, distance: 0,
})

export interface Keys {
  left: boolean; right: boolean; nitro: boolean
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
    while (this.scene.obstacles.length) this.scene.removeObstacle(0)
    this.scene.resetCarPosition()
    const prev = this.state.highScore
    this.state = INITIAL_STATE()
    this.state.highScore = prev
    this.state.phase     = 'countdown'
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
      this.scene.update(dt, ts, 0, s.carX, s.carVX, false)
      return
    }

    if (s.phase !== 'playing') return

    // ── Nitro ───────────────────────────────────────────
    s.nitroActive = keys.nitro && s.nitro > 3
    s.nitro = s.nitroActive
      ? Math.max(0, s.nitro - NITRO_DRAIN * dt)
      : Math.min(100, s.nitro + NITRO_REGEN * dt)

    // ── Cruise control — speed always ramps to BASE_SPEED
    //    Nitro fires a burst above that ─────────────────
    const targetSpeed = s.nitroActive ? NITRO_BOOST : BASE_SPEED
    const accelRate   = s.speed < BASE_SPEED ? 3.5 : (s.nitroActive ? 4.0 : ACCEL_RATE)
    s.speed += (targetSpeed - s.speed) * accelRate * dt
    s.speed  = Math.max(0, Math.min(MAX_SPEED, s.speed))

    // ── Steering ────────────────────────────────────────
    const steer = 3.2 + s.speed * 0.06
    if (keys.left)  s.carVX -= steer * dt
    if (keys.right) s.carVX += steer * dt
    s.carVX *= 0.80
    s.carX  += s.carVX * dt * 60
    s.carX   = Math.max(-ROAD_W + 0.6, Math.min(ROAD_W - 0.6, s.carX))

    // ── Combo timer decay ────────────────────────────────
    if (s.combo > 1) {
      s.comboTimer -= dt
      if (s.comboTimer <= 0) { s.combo = 1; s.comboTimer = 0 }
    }

    // ── Spawn obstacles ──────────────────────────────────
    s.spawnTimer += dt
    const spawnRate = Math.max(0.4, 1.6 - s.score / 1500)
    if (s.spawnTimer > spawnRate) { this.scene.spawnObstacle(); s.spawnTimer = 0 }

    // ── Obstacle check: collision + near-miss + despawn ──
    const CAR_WORLD_Z = CAR_Z
    for (let i = this.scene.obstacles.length - 1; i >= 0; i--) {
      const o   = this.scene.obstacles[i]
      const pos = o.mesh.position

      // Despawn past camera
      if (pos.z > CAR_WORLD_Z + 5) {
        this.scene.removeObstacle(i); continue
      }

      // Only check obstacles approaching the car
      if (pos.z < CAR_WORLD_Z - 2 || pos.z > CAR_WORLD_Z + 2) continue

      const dx = Math.abs(s.carX - pos.x)
      const dz = Math.abs(pos.z - CAR_WORLD_Z)

      // Collision
      if (dx < o.w / 2 + 0.40 && dz < 1.0) {
        this.scene.removeObstacle(i)
        s.lives--
        s.speed   = BASE_SPEED * 0.5
        s.carVX  += (Math.random() - 0.5) * 4
        s.combo   = 1
        s.comboTimer = 0
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

      // Near-miss — obstacle passes within NEAR_MISS_DX but didn't hit
      if (!o.passed && dx < o.w / 2 + NEAR_MISS_DX && dz < 1.2) {
        // It's close — wait for it to pass
        if (pos.z > CAR_WORLD_Z + 0.5) {
          o.passed  = true
          s.combo   = Math.min(s.combo + 1, 8)
          s.comboTimer = 3.0   // 3 seconds to chain next near-miss
        }
      }
    }

    // ── Score — speed × combo multiplier ────────────────
    s.score    += s.speed * dt * 2 * s.combo
    s.distance += s.speed * dt

    this.scene.update(dt, ts, s.speed, s.carX, s.carVX, s.nitroActive)
  }
}
