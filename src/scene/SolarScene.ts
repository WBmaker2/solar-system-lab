import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH, PLANETS, heliocentricScene, moonRelativeScene, type PlanetDef } from '../astro/orbits';
import type { TimeStore } from '../stores/timeStore';
import type { ViewState, ViewStore } from '../stores/viewStore';

export interface SceneCallbacks {
  onSelect?: (id: string | null) => void;
  onEarthAngle?: (angleDeg: number) => void;
}

const TRUE_SIZE_RATIO: Record<string, number> = {
  mercury: 0.383, venus: 0.949, earth: 1, mars: 0.532,
  jupiter: 11.21, saturn: 9.45, uranus: 4.01, neptune: 3.88,
};

function makeEarthTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d5fae';
  g.fillRect(0, 0, 256, 128);
  // Simple stylised continents
  g.fillStyle = '#3f8f4f';
  const blobs: Array<[number, number, number, number]> = [
    [30, 30, 46, 30], [120, 44, 40, 34], [180, 60, 44, 30], [70, 76, 36, 22], [150, 84, 30, 18],
  ];
  for (const [x, y, w, h] of blobs) {
    g.beginPath();
    g.ellipse(x, y, w / 2, h / 2, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#cfe6f5';
  g.fillRect(0, 0, 256, 10);
  g.fillRect(0, 118, 256, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMoonTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9c9c9';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#a8a8a8';
  const craters: Array<[number, number, number]> = [[30, 40, 10], [80, 70, 14], [60, 100, 7], [100, 30, 8], [45, 75, 5]];
  for (const [x, y, r] of craters) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 210, 120, 1)');
  grad.addColorStop(0.35, 'rgba(255, 170, 60, 0.55)');
  grad.addColorStop(1, 'rgba(255, 150, 40, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const EARTH_DAY_FRAG = /* glsl */ `
  uniform vec3 sunDirection;
  uniform sampler2D dayMap;
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 s = normalize(sunDirection);
    float d = dot(n, s);
    vec3 dayColor = texture2D(dayMap, vUv).rgb;
    vec3 nightColor = vec3(0.015, 0.03, 0.075);
    float dayMix = smoothstep(-0.08, 0.25, d);
    vec3 col = mix(nightColor, dayColor, dayMix);
    // Warm terminator band (sunrise/sunset line)
    float band = smoothstep(0.22, 0.0, abs(d - 0.03));
    col += vec3(0.45, 0.22, 0.06) * band * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const EARTH_DAY_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class SolarScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private bodies = new Map<string, THREE.Mesh>();
  private earthGroup = new THREE.Group();
  private earthMesh!: THREE.Mesh;
  private earthMaterial!: THREE.ShaderMaterial;
  private moonMesh!: THREE.Mesh;
  private moonOrbitLine!: THREE.LineLoop;
  private orbitLines: THREE.LineLoop[] = [];
  private labelLayer: HTMLDivElement;
  private labelEls = new Map<string, HTMLDivElement>();
  private disposed = false;
  private resizeObs: ResizeObserver;
  private lastAngleReport = 0;
  private lastFrameTime = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    private time: TimeStore,
    private view: ViewStore,
    private cb: SceneCallbacks = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    this.camera.position.set(0, 55, 95);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 600;
    this.controls.minDistance = 2;

    this.scene.background = new THREE.Color('#05080f');
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    this.labelLayer.setAttribute('aria-hidden', 'true');
    container.appendChild(this.labelLayer);
    this.buildLights();
    this.buildStars();
    this.buildSun();
    this.buildPlanets();
    this.buildEarthTerminator();
    this.buildMoon();
    this.buildOrbitLines();
    this.buildLabels();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    canvas.addEventListener('pointerdown', this.pick);
    this.renderer.setAnimationLoop(() => this.frame());
    this.applyView(this.view.get());
    this.view.subscribe((v) => this.applyView(v));
  }

  private buildLights(): void {
    const sun = new THREE.PointLight('#fff2d0', 2.2, 0, 0);
    sun.position.set(0, 0, 0);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight('#33415e', 0.85));
  }

  private buildStars(): void {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 900 + Math.random() * 1800;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.cos(p);
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: '#aebfe0', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85 });
    this.scene.add(new THREE.Points(geo, mat));
  }

  private buildSun(): void {
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 48, 48),
      new THREE.MeshBasicMaterial({ color: '#ffb62e' }),
    );
    sun.name = 'sun';
    this.scene.add(sun);
    this.bodies.set('sun', sun);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.scale.setScalar(26);
    this.scene.add(glow);
    this.labelEls.set('sun', this.makeLabel('태양 Sun'));
  }

  private bodyMaterial(def: PlanetDef): THREE.Material {
    if (def.id === 'earth') {
      return new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9 });
    }
    return new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.95, metalness: 0.02 });
  }

  private buildPlanets(): void {
    for (const def of PLANETS) {
      if (def.id === 'earth') continue; // Earth gets the shader mesh
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.displaySize, 32, 32), this.bodyMaterial(def));
      mesh.name = def.id;
      mesh.userData.defId = def.id;
      this.scene.add(mesh);
      this.bodies.set(def.id, mesh);
      if (def.id === 'saturn') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(def.displaySize * 1.35, def.displaySize * 2.1, 64),
          new THREE.MeshBasicMaterial({ color: '#cbb98a', side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
        );
        ring.rotation.x = -Math.PI / 2 + 0.35;
        mesh.add(ring);
      }
    }
  }

  private buildEarthTerminator(): void {
    this.earthGroup.rotation.z = THREE.MathUtils.degToRad(23.4393);
    this.earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
        dayMap: { value: makeEarthTexture() },
      },
      vertexShader: EARTH_DAY_VERT,
      fragmentShader: EARTH_DAY_FRAG,
    });
    this.earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH.displaySize, 48, 48),
      this.earthMaterial,
    );
    this.earthMesh.name = 'earth';
    this.earthMesh.userData.defId = 'earth';
    this.earthGroup.add(this.earthMesh);
    this.scene.add(this.earthGroup);
    this.bodies.set('earth', this.earthMesh);

    // Axis stick (visual aid for axial tilt lessons)
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.4, 0),
      new THREE.Vector3(0, 1.4, 0),
    ]);
    const axis = new THREE.Line(
      axisGeo,
      new THREE.LineBasicMaterial({ color: '#8fa8d0', transparent: true, opacity: 0.6 }),
    );
    this.earthGroup.add(axis);
  }

  private buildMoon(): void {
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({ map: makeMoonTexture(), roughness: 1 }),
    );
    this.moonMesh.name = 'moon';
    this.scene.add(this.moonMesh);
    this.bodies.set('moon', this.moonMesh);

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 2.4, 0, -Math.sin(a) * 2.4));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.moonOrbitLine = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: '#5f7191', transparent: true, opacity: 0.8 }));
    this.scene.add(this.moonOrbitLine);
  }

  private buildOrbitLines(): void {
    for (const def of PLANETS) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * def.displayRadius, 0, -Math.sin(a) * def.displayRadius));
      }
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: '#263a63', transparent: true, opacity: 0.5 }),
      );
      line.visible = true;
      this.scene.add(line);
      this.orbitLines.push(line);
    }
  }

  private makeLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'body-label';
    el.textContent = text;
    this.labelLayer.appendChild(el);
    return el;
  }

  private buildLabels(): void {
    const names: Record<string, string> = {
      sun: '태양 Sun', mercury: '수성', venus: '금성', earth: '지구', mars: '화성',
      jupiter: '목성', saturn: '토성', uranus: '천왕성', neptune: '해왕성', moon: '달',
    };
    for (const [id, text] of Object.entries(names)) {
      if (this.labelEls.has(id)) continue;
      this.labelEls.set(id, this.makeLabel(text));
    }
  }

  private pick = (ev: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.camera);
    const hits = ray.intersectObjects([...this.bodies.values()], false);
    const id = hits.length > 0 ? (hits[0].object.userData.defId as string | undefined) ?? hits[0].object.name : null;
    this.cb.onSelect?.(id);
    if (id) this.view.patch({ selectedId: id });
  };

  setEclipseHighlight(solar: boolean, lunar: boolean): void {
    const color = solar ? '#ffb62e' : lunar ? '#ff6d6d' : '#5f7191';
    (this.moonOrbitLine.material as THREE.LineBasicMaterial).color.set(color);
  }

  private applyView(v: ViewState): void {
    for (const line of this.orbitLines) line.visible = v.showOrbits;
    this.labelLayer.style.display = v.showLabels ? 'block' : 'none';
    // Realistic scale: true body-size ratios (distances stay classroom for usability)
    for (const def of PLANETS) {
      const mesh = this.bodies.get(def.id);
      if (!mesh || def.id === 'earth') continue;
      const target = v.scale === 'classroom'
        ? def.displaySize
        : THREE.MathUtils.clamp(0.65 * (TRUE_SIZE_RATIO[def.id] ?? 1), 0.18, 2.4);
      const base = def.displaySize;
      mesh.scale.setScalar(target / base);
    }
    if (v.mode === 'space') {
      this.controls.enabled = true;
    } else {
      this.controls.enabled = true; // keep orbit interaction; camera target follows body
    }
  }

  private updatePositions(jd: number): void {
    for (const def of PLANETS) {
      if (def.id === 'earth') continue;
      const mesh = this.bodies.get(def.id);
      if (!mesh) continue;
      const p = heliocentricScene(def, jd);
      mesh.position.set(p.x, p.y, p.z);
    }
    const earthPos = heliocentricScene(EARTH, jd);
    this.earthGroup.position.set(earthPos.x, 0, earthPos.z);
    // Earth daily rotation: one turn per day from JD fraction
    const dayFraction = jd - Math.floor(jd);
    this.earthMesh.rotation.y = dayFraction * Math.PI * 2;

    const rel = moonRelativeScene(jd);
    this.moonMesh.position.set(earthPos.x + rel.x, rel.y, earthPos.z + rel.z);

    // Sun direction uniform (Earth -> Sun, world space; tilt group ignored for simplicity
    // so the terminator stays sun-locked while the surface rotates beneath it)
    const sunDir = new THREE.Vector3(-earthPos.x, 0, -earthPos.z).normalize();
    (this.earthMaterial.uniforms.sunDirection.value as THREE.Vector3).copy(sunDir);

    // Moon orbit line follows Earth
    this.moonOrbitLine.position.set(earthPos.x, 0, earthPos.z);

    // Camera follow modes
    const v = this.view.get();
    if (v.mode === 'earth' || v.mode === 'moon' || v.followEarth) {
      const anchor = v.mode === 'moon' ? this.moonMesh.position : new THREE.Vector3(earthPos.x, 0, earthPos.z);
      this.controls.target.lerp(anchor, 0.12);
      if (v.mode !== 'space' && this.camera.position.distanceTo(anchor) > 12) {
        const dir = this.camera.position.clone().sub(anchor).normalize();
        this.camera.position.copy(anchor.clone().add(dir.multiplyScalar(10)));
      }
    } else if (v.mode === 'space' || v.mode === 'observer') {
      this.controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    }
  }

  private updateLabels(): void {
    const v = this.view.get();
    if (!v.showLabels) return;
    const rect = this.canvas.getBoundingClientRect();
    const vec = new THREE.Vector3();
    for (const [id, el] of this.labelEls) {
      const mesh = this.bodies.get(id);
      if (!mesh) {
        el.style.display = 'none';
        continue;
      }
      mesh.getWorldPosition(vec);
      vec.y += id === 'sun' ? 5.6 : 1.1;
      vec.project(this.camera);
      if (vec.z > 1) {
        el.style.display = 'none';
        continue;
      }
      const x = (vec.x * 0.5 + 0.5) * rect.width;
      const y = (-vec.y * 0.5 + 0.5) * rect.height;
      el.style.display = 'block';
      el.style.transform = `translate(-50%, -130%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  private frame(): void {
    if (this.disposed) return;
    const now = performance.now();
    const dt = this.lastFrameTime === 0 ? 0.016 : Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;
    this.time.tick(dt);
    const jd = this.time.get().jd;
    this.updatePositions(jd);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    if (now - this.lastAngleReport > 500) {
      this.lastAngleReport = now;
      this.cb.onEarthAngle?.((jd % 1) * 360);
    }
  }

  resize(): void {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 480;
    const canvasH = Math.max(300, h);
    this.renderer.setSize(w, canvasH, false);
    this.camera.aspect = w / canvasH;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObs.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pick);
    this.labelLayer.remove();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.renderer.dispose();
  }
}
