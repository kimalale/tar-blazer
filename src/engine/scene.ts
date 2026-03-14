// ─────────────────────────────────────────────────────────
// Tar Blazer v2 — Three.js Scene
// Builds and owns all 3D objects. Game logic calls update().
// ─────────────────────────────────────────────────────────
import * as THREE from 'three'

const ROAD_W   = 3.8
const TILE_LEN = 10
const TILE_CNT = 14
const CAR_Z    = 2.2

export interface ObstacleData {
  mesh:   THREE.Group
  w:      number
  h:      number
  rotSpd: number
}

export class TarBlazerScene {
  renderer:   THREE.WebGLRenderer
  scene:      THREE.Scene
  camera:     THREE.PerspectiveCamera
  carGroup:   THREE.Group
  wheels:     THREE.Group[] = []
  roadTiles:  THREE.Group[] = []
  obstacles:  ObstacleData[] = []

  private hitFlashFrames = 0
  private stars!: THREE.Points

  constructor(canvas: HTMLCanvasElement) {
    // ── Renderer ────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setSize(canvas.width, canvas.height)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x020208)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1

    // ── Scene & fog ─────────────────────────────────────
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x020208, 0.028)

    // ── Camera ───────────────────────────────────────────
    const aspect = canvas.width / canvas.height
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 120)
    this.camera.position.set(0, 2.8, 5.5)
    this.camera.lookAt(0, 0.4, -8)

    this.carGroup = new THREE.Group()

    this._buildLighting()
    this._buildCar()
    this._buildRoad()
    this._buildBarriers()
    this._buildStarfield()
  }

  // ── Helpers ─────────────────────────────────────────────

  private mat(color: number, emissive = 0, emissiveI = 0, metal = 0.5, rough = 0.4) {
    return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: emissiveI })
  }

  // ── Lighting ─────────────────────────────────────────────

  private _buildLighting() {
    this.scene.add(new THREE.AmbientLight(0x1a1a4a, 1.2))

    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(3, 12, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -12; sun.shadow.camera.right = 12
    sun.shadow.camera.top = 12;   sun.shadow.camera.bottom = -12
    sun.shadow.camera.far = 60;   sun.shadow.bias = -0.001
    this.scene.add(sun)

    this.scene.add(Object.assign(new THREE.DirectionalLight(0x4488ff, 0.5), { position: new THREE.Vector3(-5, 3, -4) }))
    this.scene.add(Object.assign(new THREE.PointLight(0xff2d78, 3, 10), { position: new THREE.Vector3(-2.5, 0.5, 1) }))
    this.scene.add(Object.assign(new THREE.PointLight(0x00f5ff, 3, 10), { position: new THREE.Vector3(2.5, 0.5, 1) }))
  }

  // ── Car ──────────────────────────────────────────────────

  private _buildCar() {
    const cg = this.carGroup

    // Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 2.0), this.mat(0x1a0010, 0xff2d78, 0.05, 0.7, 0.3))
    chassis.position.set(0, 0.18, 0); chassis.castShadow = true; cg.add(chassis)

    // Body (extruded profile)
    const bodyPts = [
      new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0),
      new THREE.Vector2(0.52, 0.22), new THREE.Vector2(0.3, 0.28),
      new THREE.Vector2(-0.3, 0.28), new THREE.Vector2(-0.52, 0.22),
    ]
    const bodyShape = new THREE.Shape(bodyPts)
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.8, bevelEnabled: false })
    const body = new THREE.Mesh(bodyGeo, this.mat(0xcc0044, 0xff2d78, 0.12, 0.7, 0.25))
    body.position.set(0, 0.09, -0.9); body.rotation.x = Math.PI / 2; body.castShadow = true; cg.add(body)

    // Cabin
    const cabinPts = [
      new THREE.Vector2(-0.32, 0), new THREE.Vector2(0.32, 0),
      new THREE.Vector2(0.28, 0.28), new THREE.Vector2(-0.28, 0.28),
    ]
    const cabinGeo = new THREE.ExtrudeGeometry(new THREE.Shape(cabinPts), { depth: 0.85, bevelEnabled: false })
    const cabin = new THREE.Mesh(cabinGeo, this.mat(0x880022, 0xff2d78, 0.05, 0.5, 0.5))
    cabin.position.set(0, 0.36, -0.05); cabin.rotation.x = Math.PI / 2; cabin.castShadow = true; cg.add(cabin)

    // Windscreen
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.04), this.mat(0x88ccff, 0x00f5ff, 0.4, 0.05, 0.05))
    ws.position.set(0, 0.5, 0.44); ws.rotation.x = -0.18; cg.add(ws)

    // Rear window
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.04), this.mat(0x446688, 0x0044ff, 0.2, 0.05, 0.1))
    rw.position.set(0, 0.48, -0.8); rw.rotation.x = 0.2; cg.add(rw)

    // Side windows
    ;([-0.53, 0.53] as number[]).forEach(x => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.58), this.mat(0x446688, 0x0044ff, 0.15, 0.05, 0.1))
      sw.position.set(x, 0.48, -0.2); cg.add(sw)
    })

    // Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.6), this.mat(0xdd0044, 0xff2d78, 0.08, 0.7, 0.2))
    hood.position.set(0, 0.32, 0.78); hood.castShadow = true; cg.add(hood)

    // Spoiler
    const spoilerMat = this.mat(0x880022, 0, 0, 0.8, 0.3)
    ;([-0.3, 0.3] as number[]).forEach(sx => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), spoilerMat)
      post.position.set(sx, 0.45, -0.92); cg.add(post)
    })
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.07, 0.18), this.mat(0xaa0033, 0xff2d78, 0.1, 0.6, 0.3))
    spoiler.position.set(0, 0.58, -0.92); cg.add(spoiler)

    // Wheels
    const tireGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16)
    const tireMat = this.mat(0x111111, 0, 0, 0.9, 0.5)
    const rimGeo  = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 8)
    const rimMat  = this.mat(0xcccccc, 0xffffff, 0.3, 1.0, 0.1)
    const wPos: [number, number, number][] = [[-0.56,0.2,0.72],[0.56,0.2,0.72],[-0.56,0.2,-0.72],[0.56,0.2,-0.72]]
    wPos.forEach(([x, y, z]) => {
      const wg = new THREE.Group()
      const tire = new THREE.Mesh(tireGeo, tireMat); tire.rotation.z = Math.PI / 2; tire.castShadow = true; wg.add(tire)
      const rim  = new THREE.Mesh(rimGeo,  rimMat);  rim.rotation.z  = Math.PI / 2; rim.position.x = x > 0 ? 0.02 : -0.02; wg.add(rim)
      wg.position.set(x, y, z); cg.add(wg); this.wheels.push(wg)
    })

    // Headlights
    const hlMat = new THREE.MeshStandardMaterial({ color:0xffffee, emissive:0xffffaa, emissiveIntensity:3, metalness:0.1, roughness:0.1 })
    ;([[- 0.28, 0.3, 1.01],[0.28, 0.3, 1.01]] as [number,number,number][]).forEach(([x, y, z]) => {
      cg.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.05), hlMat), { position: new THREE.Vector3(x, y, z) }))
      const spot = new THREE.SpotLight(0xffffcc, 4, 14, 0.35, 0.5)
      spot.position.set(x, y, z); spot.target.position.set(x * 0.5, 0, -8)
      cg.add(spot); cg.add(spot.target)
    })

    // Tail lights
    const tlMat = new THREE.MeshStandardMaterial({ color:0xff0000, emissive:0xff0000, emissiveIntensity:2 })
    ;([[-0.28,0.3,-1.01],[0.28,0.3,-1.01]] as [number,number,number][]).forEach(([x,y,z]) => {
      cg.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.04), tlMat), { position: new THREE.Vector3(x,y,z) }))
    })

    // Exhausts
    const exMat = this.mat(0x888888, 0, 0, 0.9, 0.3)
    ;([[-0.2,0.12,-1.04],[0.2,0.12,-1.04]] as [number,number,number][]).forEach(([x,y,z]) => {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8), exMat)
      ex.rotation.x = Math.PI / 2; ex.position.set(x, y, z); cg.add(ex)
    })

    // Ground shadow disc
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35 }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; cg.add(shadow)

    cg.position.set(0, 0, CAR_Z)
    this.scene.add(cg)
  }

  // ── Road ──────────────────────────────────────────────────

  private _buildRoad() {
    for (let i = 0; i < TILE_CNT; i++) {
      const tile = this._makeRoadTile()
      tile.position.z = -i * TILE_LEN
      this.scene.add(tile)
      this.roadTiles.push(tile)
    }
  }

  private _makeRoadTile(): THREE.Group {
    const g = new THREE.Group()
    const len = TILE_LEN

    // Asphalt
    const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W * 2 + 0.2, 0.06, len), this.mat(0x12121e, 0, 0, 0.1, 0.95))
    road.receiveShadow = true; road.position.y = -0.03; g.add(road)

    // Gravel strips
    ;([-ROAD_W - 0.8, ROAD_W + 0.8] as number[]).forEach(gx => {
      const grav = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, len), this.mat(0x2a2018, 0, 0, 0, 1))
      grav.position.set(gx, -0.01, 0); grav.receiveShadow = true; g.add(grav)
    })

    // Centre dashes
    const dashMat = new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.4 })
    for (let d = -len / 2 + 0.8; d < len / 2; d += 3) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 1.0), dashMat)
      dash.position.set(0, 0.04, d); g.add(dash)
    }

    // Lane markers
    const laneMat = new THREE.MeshStandardMaterial({ color:0xffff00, emissive:0xffff00, emissiveIntensity:0.2, transparent:true, opacity:0.7 })
    ;([-ROAD_W * 0.52, ROAD_W * 0.52] as number[]).forEach(lx => {
      for (let d = -len / 2 + 1.2; d < len / 2; d += 4) {
        const lm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.6), laneMat)
        lm.position.set(lx, 0.04, d); g.add(lm)
      }
    })

    // Edge lines
    const edgeMat = new THREE.MeshStandardMaterial({ color:0xff2d78, emissive:0xff2d78, emissiveIntensity:1.2 })
    ;([-ROAD_W, ROAD_W] as number[]).forEach(ex => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, len), edgeMat)
      edge.position.set(ex, 0.04, 0); g.add(edge)
    })

    // Kerbs
    const kLen = 0.8
    for (let ki = -len / 2; ki < len / 2; ki += kLen * 2) {
      ;([-ROAD_W - 0.18, ROAD_W + 0.18] as number[]).forEach(kx => {
        const kr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, kLen), new THREE.MeshStandardMaterial({ color:0xdd2222 }))
        kr.position.set(kx, 0.04, ki + kLen * 0.5); g.add(kr)
        const kw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, kLen), new THREE.MeshStandardMaterial({ color:0xffffff }))
        kw.position.set(kx, 0.04, ki + kLen * 1.5); g.add(kw)
      })
    }
    return g
  }

  private _buildBarriers() {
    const barMat = this.mat(0x0a0a1e, 0x00f5ff, 0.06, 0.3, 0.8)
    const glowMat = new THREE.MeshStandardMaterial({ color:0x00f5ff, emissive:0x00f5ff, emissiveIntensity:0.6 })
    ;([-ROAD_W - 1.5, ROAD_W + 1.5] as number[]).forEach(bx => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 200), barMat)
      bar.position.set(bx, 1.25, -80); this.scene.add(bar)
    })
    ;([-ROAD_W - 0.65, ROAD_W + 0.65] as number[]).forEach(gx => {
      const gs = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 200), glowMat)
      gs.position.set(gx, 2.52, -80); this.scene.add(gs)
    })
  }

  private _buildStarfield() {
    const positions: number[] = []
    for (let i = 0; i < 300; i++) {
      positions.push((Math.random() - 0.5) * 80, 3 + Math.random() * 20, (Math.random() - 0.5) * 200 - 40)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size:0.08 }))
    this.scene.add(this.stars)
  }

  // ── Obstacle spawner ──────────────────────────────────────

  spawnObstacle() {
    const lanes = [-ROAD_W * 0.62, 0, ROAD_W * 0.62]
    const lane  = lanes[Math.floor(Math.random() * lanes.length)]
    const h = 0.35 + Math.random() * 0.55
    const w = 0.5  + Math.random() * 0.35
    const colors = [0x00f5ff, 0xfbbf24, 0xa855f7, 0xf97316, 0x4ade80, 0xec4899]
    const col = colors[Math.floor(Math.random() * colors.length)]

    const g = new THREE.Group()

    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color:col, metalness:0.5, roughness:0.3, emissive:col, emissiveIntensity:0.2 }))
    box.castShadow = true; box.position.y = h / 2; g.add(box)

    const pip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, h * 0.3, w * 0.3),
      new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:1 }))
    pip.position.y = h + h * 0.18; g.add(pip)

    const pt = new THREE.PointLight(col, 2.5, 4)
    pt.position.y = h; g.add(pt)

    g.position.set(lane, 0, -42)
    this.scene.add(g)
    this.obstacles.push({ mesh: g, w, h, rotSpd: (Math.random() - 0.5) * 2 })
  }

  removeObstacle(idx: number) {
    this.scene.remove(this.obstacles[idx].mesh)
    this.obstacles.splice(idx, 1)
  }

  triggerHitFlash() { this.hitFlashFrames = 8 }

  resetCarPosition() {
    this.carGroup.position.set(0, 0, CAR_Z)
    this.carGroup.rotation.set(0, 0, 0)
  }

  // ── Per-frame update ──────────────────────────────────────

  update(dt: number, ts: number, speed: number, carX: number, carVX: number) {
    // Car movement
    this.carGroup.position.x += (carX - this.carGroup.position.x) * 14 * dt
    this.carGroup.rotation.y  = -carVX * 0.16
    this.carGroup.rotation.z  = -carVX * 0.055
    this.carGroup.position.y  = Math.sin(ts * 0.012 * Math.max(speed * 0.08, 0.01)) * 0.012

    // Wheels spin
    this.wheels.forEach(w => { w.rotation.x += speed * dt * 2.8 })

    // Road scroll
    this.roadTiles.forEach(tile => {
      tile.position.z += speed * dt
      if (tile.position.z > TILE_LEN * 0.9) tile.position.z -= TILE_CNT * TILE_LEN
    })

    // Stars
    this.stars.position.z += speed * dt * 0.04

    // Obstacle rotation
    this.obstacles.forEach(o => { o.mesh.rotation.y += o.rotSpd * dt })

    // Hit flash
    if (this.hitFlashFrames > 0) {
      this.hitFlashFrames--
      this.renderer.setClearColor(this.hitFlashFrames % 2 === 0 ? 0x330000 : 0x020208)
    } else {
      this.renderer.setClearColor(0x020208)
    }

    // Camera lean
    this.camera.position.x += (carVX * 0.12 - this.camera.position.x) * 4 * dt
    this.camera.position.y  = 2.8 + speed * 0.008
    this.camera.lookAt(this.carGroup.position.x * 0.3, 0.4, -8)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.dispose()
  }
}
