import * as THREE from 'three'

const ROAD_W    = 3.8
const TILE_LEN  = 12
const TILE_CNT  = 14
export const CAR_Z = 2.2

export interface ObstacleData {
  mesh:   THREE.Group
  w:      number
  h:      number
  rotSpd: number
  passed: boolean
}

export class TarBlazerScene {
  renderer:     THREE.WebGLRenderer
  scene:        THREE.Scene
  camera:       THREE.PerspectiveCamera
  carGroup:     THREE.Group
  wheels:       THREE.Group[]  = []
  roadTiles:    THREE.Group[]  = []
  sceneryTiles: THREE.Group[]  = []
  obstacles:    ObstacleData[] = []

  private hitFlashFrames = 0
  private nitroParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = []
  private skidMarks: THREE.Mesh[] = []
  private skidTimer  = 0
  private exhaustL!: THREE.Mesh
  private exhaustR!: THREE.Mesh
  private boostLight!: THREE.PointLight

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setSize(canvas.width, canvas.height)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x87ceeb)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.3

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.fog = new THREE.Fog(0xc9e8f5, 30, 90)

    const aspect = canvas.width / canvas.height
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 120)
    this.camera.position.set(0, 3.2, 7.5)
    this.camera.lookAt(0, 0.5, -6)

    this.carGroup = new THREE.Group()

    this._buildLighting()
    this._buildSky()
    this._buildTerrain()
    this._buildCar()
    this._buildRoad()
    this._buildScenery()
  }

  private mat(color: number, emissive = 0, emissiveI = 0, metal = 0.4, rough = 0.6) {
    return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: emissiveI })
  }

  private _buildLighting() {
    this.scene.add(new THREE.AmbientLight(0xc8dff0, 1.8))

    const sun = new THREE.DirectionalLight(0xfff5e0, 3.0)
    sun.position.set(8, 20, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(512, 512)
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15
    sun.shadow.camera.top  = 15;  sun.shadow.camera.bottom = -15
    sun.shadow.camera.far  = 80;  sun.shadow.bias = -0.001
    this.scene.add(sun)

    const bounce = new THREE.DirectionalLight(0xd4f0a0, 0.6)
    bounce.position.set(-3, -2, 2)
    this.scene.add(bounce)

    this.boostLight = new THREE.PointLight(0x00aaff, 0, 6)
    this.boostLight.position.set(0, 0.5, 3.5)
    this.scene.add(this.boostLight)
  }

  private _buildSky() {
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0xd4eef8, transparent: true, opacity: 0.6 })
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(200, 8), hazeMat)
    haze.position.set(0, 4, -60)
    this.scene.add(haze)

    const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfff5aa })
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(2.5, 16), sunMat)
    sunDisc.position.set(20, 18, -70)
    this.scene.add(sunDisc)

    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.25 })
    const glow    = new THREE.Mesh(new THREE.CircleGeometry(5, 16), glowMat)
    glow.position.set(20, 18, -69)
    this.scene.add(glow)

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3a, roughness: 1 })
    const hills   = [[-30,0,-55,18,6,20],[10,0,-58,22,7,18],[40,0,-52,16,5,16],[-55,0,-50,20,6,18]] as number[][]
    hills.forEach(([x,y,z,w,h,d]) => {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), hillMat)
      hill.scale.set(w, h, d); hill.position.set(x, y, z); this.scene.add(hill)
    })
  }

  private _buildTerrain() {
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5cb85c, roughness: 0.95, metalness: 0 })
    const ground   = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), grassMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -0.05, -60)
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  private _buildCar() {
    const cg = this.carGroup

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 2.0), this.mat(0x1a3a0a, 0, 0, 0.6, 0.4))
    chassis.position.set(0, 0.18, 0); chassis.castShadow = true; cg.add(chassis)

    const bodyPts = [
      new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0),
      new THREE.Vector2(0.52, 0.22), new THREE.Vector2(0.3, 0.28),
      new THREE.Vector2(-0.3, 0.28), new THREE.Vector2(-0.52, 0.22),
    ]
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(new THREE.Shape(bodyPts), { depth: 1.8, bevelEnabled: false }),
      this.mat(0xf5c518, 0xffdd44, 0.06, 0.5, 0.35)
    )
    body.position.set(0, 0.09, -0.9); body.rotation.x = Math.PI / 2; body.castShadow = true; cg.add(body)

    const cabinPts = [
      new THREE.Vector2(-0.32, 0), new THREE.Vector2(0.32, 0),
      new THREE.Vector2(0.28, 0.28), new THREE.Vector2(-0.28, 0.28),
    ]
    const cabin = new THREE.Mesh(
      new THREE.ExtrudeGeometry(new THREE.Shape(cabinPts), { depth: 0.85, bevelEnabled: false }),
      this.mat(0xd4a800, 0, 0, 0.4, 0.5)
    )
    cabin.position.set(0, 0.36, -0.05); cabin.rotation.x = Math.PI / 2; cabin.castShadow = true; cg.add(cabin)

    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.04), this.mat(0xaaddff, 0x88ccff, 0.3, 0.05, 0.05))
    ws.position.set(0, 0.5, 0.44); ws.rotation.x = -0.18; cg.add(ws)

    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.04), this.mat(0x88bbcc, 0, 0, 0.05, 0.1))
    rw.position.set(0, 0.48, -0.8); rw.rotation.x = 0.2; cg.add(rw)

    ;([-0.53, 0.53] as number[]).forEach(x => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.58), this.mat(0x88bbcc, 0, 0, 0.05, 0.1))
      sw.position.set(x, 0.48, -0.2); cg.add(sw)
    })

    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.6), this.mat(0xf5c518, 0, 0, 0.5, 0.3))
    hood.position.set(0, 0.32, 0.78); hood.castShadow = true; cg.add(hood)

    const spoilerMat = this.mat(0x333333, 0, 0, 0.7, 0.4)
    ;([-0.3, 0.3] as number[]).forEach(sx => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), spoilerMat)
      post.position.set(sx, 0.45, -0.92); cg.add(post)
    })
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.07, 0.18), this.mat(0x222222, 0, 0, 0.8, 0.3))
    spoiler.position.set(0, 0.58, -0.92); cg.add(spoiler)

    const stripeMat = this.mat(0x111111, 0, 0, 0.3, 0.7)
    ;([-0.15, 0.15] as number[]).forEach(sx => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 1.82), stripeMat)
      stripe.position.set(sx, 0.36, -0.01); cg.add(stripe)
    })

    const tireGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16)
    const tireMat = this.mat(0x1a1a1a, 0, 0, 0.9, 0.7)
    const rimGeo  = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 8)
    const rimMat  = this.mat(0xdddddd, 0xffffff, 0.2, 1.0, 0.1)
    const wPos: [number, number, number][] = [[-0.56,0.2,0.72],[0.56,0.2,0.72],[-0.56,0.2,-0.72],[0.56,0.2,-0.72]]
    wPos.forEach(([x, y, z]) => {
      const wg = new THREE.Group()
      const tire = new THREE.Mesh(tireGeo, tireMat); tire.rotation.z = Math.PI / 2; tire.castShadow = true; wg.add(tire)
      const rim  = new THREE.Mesh(rimGeo, rimMat);   rim.rotation.z  = Math.PI / 2; rim.position.x = x > 0 ? 0.02 : -0.02; wg.add(rim)
      wg.position.set(x, y, z); cg.add(wg); this.wheels.push(wg)
    })

    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 0.8 })
    ;([[-0.28,0.3,1.01],[0.28,0.3,1.01]] as [number,number,number][]).forEach(([x,y,z]) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.05), hlMat)
      hl.position.set(x, y, z); cg.add(hl)
    })

    const tlMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.5 })
    ;([[-0.28,0.3,-1.01],[0.28,0.3,-1.01]] as [number,number,number][]).forEach(([x,y,z]) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.04), tlMat)
      tl.position.set(x, y, z); cg.add(tl)
    })

    const exMat = this.mat(0x888888, 0, 0, 0.9, 0.3)
    ;([[-0.2,0.12,-1.04],[0.2,0.12,-1.04]] as [number,number,number][]).forEach(([x,y,z]) => {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8), exMat)
      ex.rotation.x = Math.PI / 2; ex.position.set(x, y, z); cg.add(ex)
    })

    const exGlowMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0066ff, emissiveIntensity: 0, transparent: true, opacity: 0.9 })
    this.exhaustL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), exGlowMat.clone())
    this.exhaustR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), exGlowMat.clone())
    this.exhaustL.position.set(-0.2, 0.12, -1.16)
    this.exhaustR.position.set(0.2, 0.12, -1.16)
    cg.add(this.exhaustL); cg.add(this.exhaustR)

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; cg.add(shadow)

    cg.position.set(0, 0, CAR_Z)
    this.scene.add(cg)
  }

  private _buildRoad() {
    for (let i = 0; i < TILE_CNT; i++) {
      const tile = this._makeRoadTile()
      tile.position.z = -i * TILE_LEN
      this.scene.add(tile)
      this.roadTiles.push(tile)
    }
  }

  private _makeRoadTile(): THREE.Group {
    const g = new THREE.Group(); const len = TILE_LEN

    const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W * 2 + 0.2, 0.06, len), this.mat(0x555555, 0, 0, 0.1, 0.9))
    road.receiveShadow = true; road.position.y = -0.03; g.add(road)

    ;([-ROAD_W - 0.8, ROAD_W + 0.8] as number[]).forEach(gx => {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, len), this.mat(0x888877, 0, 0, 0, 0.95))
      sh.position.set(gx, -0.01, 0); sh.receiveShadow = true; g.add(sh)
    })

    const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1 })
    for (let d = -len / 2 + 0.8; d < len / 2; d += 3.5) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.2), dashMat)
      dash.position.set(0, 0.04, d); g.add(dash)
    }

    const laneMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.15 })
    ;([-ROAD_W * 0.52, ROAD_W * 0.52] as number[]).forEach(lx => {
      for (let d = -len / 2 + 1.2; d < len / 2; d += 4) {
        const lm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.8), laneMat)
        lm.position.set(lx, 0.04, d); g.add(lm)
      }
    })

    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1 })
    ;([-ROAD_W, ROAD_W] as number[]).forEach(ex => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, len), edgeMat)
      edge.position.set(ex, 0.04, 0); g.add(edge)
    })

    const kLen = 0.8
    for (let ki = -len / 2; ki < len / 2; ki += kLen * 2) {
      ;([-ROAD_W - 0.2, ROAD_W + 0.2] as number[]).forEach(kx => {
        const kr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, kLen), new THREE.MeshStandardMaterial({ color: 0xdd2222 }))
        kr.position.set(kx, 0.045, ki + kLen * 0.5); g.add(kr)
        const kw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, kLen), new THREE.MeshStandardMaterial({ color: 0xffffff }))
        kw.position.set(kx, 0.045, ki + kLen * 1.5); g.add(kw)
      })
    }
    return g
  }

  // Shared scenery materials — created once, reused across all tiles
  private readonly _trunkMat  = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 1 })
  private readonly _leafMats  = [0x2d8a2d, 0x3a9e3a, 0x228822].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })
  )
  private readonly _poleMat   = new THREE.MeshStandardMaterial({ color: 0x8a7060, roughness: 0.9, metalness: 0.2 })
  private readonly _postMat   = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5, metalness: 0.6 })
  // Shared geometries
  private readonly _trunkGeo  = new THREE.CylinderGeometry(0.1, 0.14, 0.8, 5)
  private readonly _leaf0Geo  = new THREE.SphereGeometry(0.55, 5, 4)
  private readonly _leaf1Geo  = new THREE.SphereGeometry(0.42, 5, 4)
  private readonly _leaf2Geo  = new THREE.SphereGeometry(0.28, 5, 4)

  private _buildScenery() {
    for (let i = 0; i < TILE_CNT; i++) {
      const tile = this._makeSceneryTile()
      tile.position.z = -i * TILE_LEN
      this.scene.add(tile)
      this.sceneryTiles.push(tile)
    }
  }

  private _makeSceneryTile(): THREE.Group {
    const g = new THREE.Group(); const len = TILE_LEN
    const treeCount = 2

    for (let t = 0; t < treeCount; t++) {
      const zPos  = -len / 2 + (t + 0.5) * (len / treeCount) + (Math.random() - 0.5) * 1.5
      const scale = 0.8 + Math.random() * 0.5

      ;([-1, 1] as number[]).forEach(side => {
        const xPos = side * (ROAD_W + 1.8 + Math.random() * 2.0)
        const tg   = new THREE.Group()
        const lm   = this._leafMats[Math.floor(Math.random() * this._leafMats.length)]

        // Trunk — shared geo, NO shadow casting (performance)
        const trunk = new THREE.Mesh(this._trunkGeo, this._trunkMat)
        trunk.scale.setScalar(scale)
        trunk.position.y = 0.4 * scale
        tg.add(trunk)

        // Three foliage spheres — shared geo + mat, no shadows
        const leafOffsets: [number, number, number, THREE.BufferGeometry][] = [
          [0, 1.0 * scale, 0, this._leaf0Geo],
          [0, 1.45 * scale, 0, this._leaf1Geo],
          [0, 1.8 * scale,  0, this._leaf2Geo],
        ]
        leafOffsets.forEach(([x, y, z, geo]) => {
          const leaf = new THREE.Mesh(geo, lm)
          leaf.scale.setScalar(scale)
          leaf.position.set(x, y, z)
          tg.add(leaf)
        })

        tg.position.set(xPos, 0, zPos)
        g.add(tg)
      })
    }

    // Signs — only half the tiles
    if (Math.random() > 0.55) {
      const signColors = [0x2255cc, 0x22aa44, 0xcc4400]
      const col  = signColors[Math.floor(Math.random() * signColors.length)]
      const zPos = (Math.random() - 0.5) * len * 0.6
      const boardMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })

      ;([-1, 1] as number[]).forEach(side => {
        const sg   = new THREE.Group()
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 5), this._postMat)
        post.position.y = 1.0; sg.add(post)
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.06), boardMat)
        board.position.y = 2.1; sg.add(board)
        sg.position.set(side * (ROAD_W + 0.9), 0, zPos); g.add(sg)
      })
    }

    // Power poles — one third of tiles
    if (Math.random() > 0.66) {
      const zPos = (Math.random() - 0.5) * len * 0.7
      ;([-1, 1] as number[]).forEach(side => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 5), this._poleMat)
        pole.position.set(side * (ROAD_W + 2.2), 1.75, zPos); g.add(pole)
      })
    }

    return g
  }

  spawnObstacle() {
    const lanes  = [-ROAD_W * 0.62, 0, ROAD_W * 0.62]
    const lane   = lanes[Math.floor(Math.random() * lanes.length)]
    const h      = 0.4 + Math.random() * 0.6
    const w      = 0.5 + Math.random() * 0.4
    const colors = [0xff4400, 0xffaa00, 0xff0066, 0x8800ff, 0x0088ff]
    const col    = colors[Math.floor(Math.random() * colors.length)]
    const g      = new THREE.Group()

    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.5, emissive: col, emissiveIntensity: 0.15 }))
    box.castShadow = true; box.position.y = h / 2; g.add(box)

    const pip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, h * 0.28, w * 0.28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 }))
    pip.position.y = h + h * 0.2; g.add(pip)

    const pt = new THREE.PointLight(col, 1.5, 5)
    pt.position.y = h * 0.8; g.add(pt)

    g.position.set(lane, 0, -44)
    this.scene.add(g)
    this.obstacles.push({ mesh: g, w, h, rotSpd: (Math.random() - 0.5) * 1.5, passed: false })
  }

  removeObstacle(idx: number) {
    this.scene.remove(this.obstacles[idx].mesh)
    this.obstacles.splice(idx, 1)
  }

  triggerHitFlash() { this.hitFlashFrames = 10 }

  resetCarPosition() {
    this.carGroup.position.set(0, 0, CAR_Z)
    this.carGroup.rotation.set(0, 0, 0)
  }

  spawnNitroParticle() {
    const mat  = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.85 })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 4, 3), mat)
    mesh.position.set(
      this.carGroup.position.x + (Math.random() - 0.5) * 0.4,
      0.1 + Math.random() * 0.3,
      this.carGroup.position.z - 1.2
    )
    this.scene.add(mesh)
    this.nitroParticles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.4, 1.5 + Math.random() * 1.5),
      life: 0.4 + Math.random() * 0.3,
    })
  }

  private curvePhase  = 0
  private curveOffset = 0

  update(dt: number, ts: number, speed: number, carX: number, carVX: number, nitroActive: boolean) {
    this.carGroup.position.x += (carX - this.carGroup.position.x) * 14 * dt
    this.carGroup.rotation.y  = -carVX * 0.18
    this.carGroup.rotation.z  = -carVX * 0.06
    this.carGroup.position.y  = Math.sin(ts * 0.01 * Math.max(speed * 0.1, 0.5)) * 0.01

    this.wheels.forEach(w => { w.rotation.x += speed * dt * 3.0 })

    // Gentle road curve — slow sine, subtle lateral drift
    this.curvePhase  += speed * dt * 0.014
    const curveDelta  = Math.sin(this.curvePhase) * 0.28 * dt
    this.curveOffset += curveDelta

    this.roadTiles.forEach(tile => {
      tile.position.z += speed * dt
      tile.position.x  = this.curveOffset * 0.4
      if (tile.position.z > TILE_LEN * 0.9) tile.position.z -= TILE_CNT * TILE_LEN
    })

    this.sceneryTiles.forEach(tile => {
      tile.position.z += speed * dt
      tile.position.x  = this.curveOffset * 0.4
      if (tile.position.z > TILE_LEN * 0.9) tile.position.z -= TILE_CNT * TILE_LEN
    })

    // FIX: obstacles must scroll forward + follow curve
    this.obstacles.forEach(o => {
      o.mesh.position.z += speed * dt
      o.mesh.position.x += curveDelta * 0.4
      o.mesh.rotation.y += o.rotSpd * dt
    })

    // Skid marks
    if (Math.abs(carVX) > 1.2) {
      this.skidTimer += dt
      if (this.skidTimer > 0.15) {
        this.skidTimer = 0
        const skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.4 })
        ;([-0.42, 0.42] as number[]).forEach(sx => {
          const skid = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), skidMat)
          skid.rotation.x = -Math.PI / 2
          skid.position.set(this.carGroup.position.x + sx, 0.01, this.carGroup.position.z - 0.5)
          this.scene.add(skid); this.skidMarks.push(skid)
        })
        if (this.skidMarks.length > 80) {
          this.skidMarks.splice(0, 4).forEach(s => this.scene.remove(s))
        }
      }
    } else {
      this.skidTimer = 0
    }

    // Nitro effects
    if (nitroActive) {
      this.boostLight.intensity = 3 + Math.sin(ts * 0.05) * 1
      if (Math.random() > 0.3) this.spawnNitroParticle()
      ;([this.exhaustL, this.exhaustR] as THREE.Mesh[]).forEach(ex => {
        ;(ex.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.random()
      })
    } else {
      this.boostLight.intensity *= 0.85
      ;([this.exhaustL, this.exhaustR] as THREE.Mesh[]).forEach(ex => {
        ;(ex.material as THREE.MeshStandardMaterial).emissiveIntensity *= 0.7
      })
    }

    // Nitro particles
    for (let i = this.nitroParticles.length - 1; i >= 0; i--) {
      const p = this.nitroParticles[i]
      p.life -= dt
      if (p.life <= 0) { this.scene.remove(p.mesh); this.nitroParticles.splice(i, 1); continue }
      p.mesh.position.x += p.vel.x * dt
      p.mesh.position.y += p.vel.y * dt
      p.mesh.position.z += p.vel.z * dt * speed * 0.1
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life * 2
      p.mesh.scale.setScalar(p.life * 3)
    }

    // Hit flash
    if (this.hitFlashFrames > 0) {
      this.hitFlashFrames--
      const flash = this.hitFlashFrames % 2 === 0
      this.renderer.setClearColor(flash ? 0xff2200 : 0x87ceeb)
      ;(this.scene.fog as THREE.Fog).color.set(flash ? 0xff2200 : 0xc9e8f5)
    } else {
      this.renderer.setClearColor(0x87ceeb)
      ;(this.scene.fog as THREE.Fog).color.set(0xc9e8f5)
    }

    // Camera with FOV zoom on nitro
    const fovTarget = nitroActive ? 62 : 55
    this.camera.fov += (fovTarget - this.camera.fov) * 6 * dt
    this.camera.updateProjectionMatrix()
    this.camera.position.x += (carVX * 0.1 - this.camera.position.x) * 5 * dt
    this.camera.position.y  = 3.2 + speed * 0.006
    this.camera.lookAt(this.carGroup.position.x * 0.25, 0.5, -6)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() { this.renderer.dispose() }
}
