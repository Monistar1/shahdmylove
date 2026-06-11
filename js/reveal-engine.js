/* ==========================================================
   CINEMATIC FLOWER REVEAL ENGINE
   Apple Keynote-style product reveal sequence
   Three.js · Custom Shaders · GPU Optimized
   ========================================================== */

(function() {
  'use strict';

  /* ----------------------------------------------------------
     COLOR PALETTE — all colors centralized
     ---------------------------------------------------------- */
  const PALETTE = {
    // Petal gradient (purple lily identity)
    petalBase: '#7a50a0',
    petalMid: '#b088d8',
    petalTip: '#f5eaff',
    petalHighlight: '#ffffff',

    // Lighting & atmosphere
    rimLight: '#ffe4ec',
    ambientWarm: '#fff0f5',
    ambientCool: '#e8e0ff',
    keyLight: '#fff8f5',
    centerGlow: '#ffe0f0',

    // Materials
    golden: '#daa520',
    anther: '#f5d76e',
    stem: '#4a7a52',

    // Scene background
    bg: '#cf99d7',

    // Shader accent colors (RGB 0-1 for GLSL)
    subsurface: { r: 0.15, g: 0.05, b: 0.12 },
    specular: { r: 1.0, g: 0.98, b: 0.95 },
    edgeTrans: { r: 0.25, g: 0.15, b: 0.35 },

    // Glow texture radial gradient stops
    glowCenter: 'rgba(255, 240, 250, 0.45)',
    glowMid: 'rgba(220, 190, 240, 0.18)',
    glowOuter: 'rgba(200, 170, 230, 0.06)',
    glowEdge: 'rgba(180, 150, 220, 0)'
  };

  const CONFIG = {
    duration: 14,
    petalCount: 6,
    colors: {
      petalBase: new THREE.Color(PALETTE.petalBase),
      petalMid: new THREE.Color(PALETTE.petalMid),
      petalTip: new THREE.Color(PALETTE.petalTip),
      petalHighlight: new THREE.Color(PALETTE.petalHighlight),
      rimLight: new THREE.Color(PALETTE.rimLight),
      ambientWarm: new THREE.Color(PALETTE.ambientWarm),
      ambientCool: new THREE.Color(PALETTE.ambientCool),
      golden: new THREE.Color(PALETTE.golden)
    },
    camera: {
      startZ: 18,
      endZ: 6.5,
      orbitRadius: 0.3,
      orbitSpeed: 0.08
    }
  };

  let scene, camera, renderer, flowerGroup, stemMesh, pistilGroup;
  let animId = null;
  let startTime = null;
  let isActive = false;
  let petalMeshes = [];
  let glowSprites = [];

  /* ==========================================================
     EASING FUNCTIONS (Apple-level curves)
     ========================================================== */
  const Ease = {
    // Smooth start, faster middle, gentle settle
    cinematicInOut: t => {
      if (t < 0.5) return 4 * t * t * t;
      return 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    // Very gentle ease-out for delicate motion
    delicateOut: t => 1 - Math.pow(1 - t, 4),
    // Slow anticipation, then release
    anticipation: t => {
      if (t < 0.15) return t * t * 4.44; // slow start
      return 1 - Math.pow(1 - (t - 0.15) / 0.85, 3);
    },
    // Soft elastic settle
    softElastic: t => {
      const c4 = (2 * Math.PI) / 4.5;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    // Linear with micro smoothing
    smoothLinear: t => t * t * (3 - 2 * t)
  };

  /* ==========================================================
     PETAL GEOMETRY (Organic curved shape)
     ========================================================== */
  function createPetalGeometry() {
    const w = 1.6, h = 4.2;
    const segW = 24, segH = 40;
    const geo = new THREE.PlaneGeometry(w, h, segW, segH);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const ny = (y + h * 0.5) / h; // 0 bottom, 1 top
      const nx = x / (w * 0.5); // -1 to 1

      // Taper: narrow at bottom, wide at top with rounded tip
      const taper = Math.pow(ny, 0.55);
      const tipRound = Math.sin(ny * Math.PI) * 0.15 + 0.85;
      x *= (0.25 + 0.75 * taper) * tipRound;

      // Lengthwise curve (petal arches backward)
      const curveZ = -0.45 * Math.sin(ny * Math.PI);

      // Cup shape across width
      const cupZ = -0.18 * nx * nx;

      // Tip curls slightly backward
      const tipCurl = ny > 0.85 ? -(ny - 0.85) * 3.5 : 0;

      // Natural waviness
      const wave = Math.sin(ny * Math.PI * 2.5) * 0.03 * nx;

      pos.setX(i, x + wave);
      pos.setY(i, y);
      pos.setZ(i, curveZ + cupZ + tipCurl);
    }

    geo.computeVertexNormals();
    return geo;
  }

  /* ==========================================================
     CUSTOM PETAL MATERIAL (Premium shader)
     ========================================================== */
  function createPetalMaterial(baseHue) {
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewPos;
      uniform float uTime;
      uniform float uReveal;
      uniform float uBreath;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vViewPos = (viewMatrix * worldPos).xyz;

        // Subtle breathing motion
        vec3 pos = position;
        float breath = sin(uTime * 0.8 + uv.y * 3.0) * 0.015 * uBreath;
        pos += normal * breath;

        // Micro flutter at tip
        float flutter = sin(uTime * 1.2 + uv.x * 5.0) * 0.008 * uBreath * uv.y;
        pos.x += flutter;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewPos;

      uniform vec3 uColorBase;
      uniform vec3 uColorMid;
      uniform vec3 uColorTip;
      uniform vec3 uColorRim;
      uniform vec3 uColorHighlight;
      uniform vec3 uColorSubsurface;
      uniform vec3 uColorSpecular;
      uniform vec3 uColorEdge;
      uniform float uTime;
      uniform float uReveal;
      uniform float uSubsurface;
      uniform float uLightIntensity;

      // Simple noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 viewDir = normalize(-vViewPos);
        vec3 normal = normalize(vNormal);

        // Gradient along petal length
        float grad = vUv.y;
        vec3 color = mix(uColorBase, uColorMid, smoothstep(0.0, 0.5, grad));
        color = mix(color, uColorTip, smoothstep(0.5, 0.92, grad));
        color = mix(color, uColorHighlight, smoothstep(0.85, 1.0, grad));

        // Micro surface variation
        float surfNoise = noise(vUv * 18.0) * 0.04 + noise(vUv * 45.0 + uTime * 0.02) * 0.02;
        color += surfNoise;

        // Fresnel rim light (soft white/pink glow at edges)
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
        color += uColorRim * fresnel * 0.6;

        // Subsurface scattering approximation (warm glow from behind)
        float sss = pow(max(dot(viewDir, -normal), 0.0), 2.0) * uSubsurface;
        color += uColorSubsurface * sss;

        // Soft specular highlight
        vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
        color += uColorSpecular * spec * 0.3 * uLightIntensity;

        // Edge translucency
        float edge = pow(fresnel, 1.5) * 0.25;
        color += uColorEdge * edge;

        // Soft shadow gradient at bottom
        float shadow = smoothstep(0.0, 0.35, vUv.y);
        color *= 0.65 + 0.35 * shadow;

        // Depth-based ambient occlusion
        float ao = smoothstep(0.0, 0.2, vUv.y) * 0.4 + 0.6;
        color *= ao;

        // Overall reveal fade
        float revealFade = smoothstep(0.0, 0.08, uReveal);
        color *= revealFade;

        // Gentle brightness variation
        color *= 0.92 + 0.08 * sin(vUv.y * 20.0 + vUv.x * 10.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uBreath: { value: 0 },
        uSubsurface: { value: 0 },
        uLightIntensity: { value: 0 },
        uColorBase: { value: CONFIG.colors.petalBase },
        uColorMid: { value: CONFIG.colors.petalMid },
        uColorTip: { value: CONFIG.colors.petalTip },
        uColorRim: { value: CONFIG.colors.rimLight },
        uColorHighlight: { value: CONFIG.colors.petalHighlight },
        uColorSubsurface: { value: new THREE.Color(PALETTE.subsurface.r, PALETTE.subsurface.g, PALETTE.subsurface.b) },
        uColorSpecular: { value: new THREE.Color(PALETTE.specular.r, PALETTE.specular.g, PALETTE.specular.b) },
        uColorEdge: { value: new THREE.Color(PALETTE.edgeTrans.r, PALETTE.edgeTrans.g, PALETTE.edgeTrans.b) }
      },
      side: THREE.DoubleSide,
      transparent: false
    });

    return mat;
  }

  /* ==========================================================
     STEM GEOMETRY
     ========================================================== */
  function createStemGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -5.5, 0),
      new THREE.Vector3(0.08, -3.5, 0.05),
      new THREE.Vector3(-0.05, -1.5, -0.03),
      new THREE.Vector3(0.02, 0, 0.02)
    ]);
    const geo = new THREE.TubeGeometry(curve, 32, 0.08, 8, false);
    return geo;
  }

  /* ==========================================================
     GLOW SPRITE (Volumetric light simulation)
     ========================================================== */
  function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, PALETTE.glowCenter);
    gradient.addColorStop(0.3, PALETTE.glowMid);
    gradient.addColorStop(0.6, PALETTE.glowOuter);
    gradient.addColorStop(1, PALETTE.glowEdge);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /* ==========================================================
     BUILD FLOWER
     ========================================================== */
  function buildFlower() {
    flowerGroup = new THREE.Group();

    const petalGeo = createPetalGeometry();
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Create 6 petals
    for (let i = 0; i < CONFIG.petalCount; i++) {
      const angle = (Math.PI * 2 * i) / CONFIG.petalCount;
      const mat = createPetalMaterial();
      const mesh = new THREE.Mesh(petalGeo, mat);

      // Initial bud position (folded inward)
      mesh.rotation.z = angle;
      mesh.rotation.x = Math.PI * 0.72; // folded up
      mesh.position.set(
        Math.cos(angle) * 0.15,
        Math.sin(angle) * 0.15,
        -0.3
      );

      // Store animation data
      mesh.userData = {
        index: i,
        baseAngle: angle,
        unfoldDelay: i * 0.18,
        unfoldSpeed: 0.85 + Math.random() * 0.3,
        mat: mat
      };

      petalMeshes.push(mesh);
      flowerGroup.add(mesh);

      // Glow sprite per petal
      const glow = new THREE.Sprite(glowMat.clone());
      glow.scale.set(3.5, 3.5, 1);
      glow.position.copy(mesh.position);
      glow.userData = { parentPetal: mesh };
      glowSprites.push(glow);
      flowerGroup.add(glow);
    }

    // Center pistil (golden stamens)
    pistilGroup = new THREE.Group();
    const stamenGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6);
    const stamenMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.golden });

    for (let i = 0; i < 5; i++) {
      const stamen = new THREE.Mesh(stamenGeo, stamenMat);
      const a = (Math.PI * 2 * i) / 5;
      stamen.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.2);
      stamen.rotation.x = 0.25;
      stamen.rotation.z = a + Math.PI * 0.5;
      pistilGroup.add(stamen);

      // Anther (small sphere at tip)
      const anther = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: PALETTE.anther })
      );
      anther.position.set(0, 0.42, 0);
      stamen.add(anther);
    }

    pistilGroup.scale.set(0, 0, 0);
    flowerGroup.add(pistilGroup);

    // Stem
    const stemGeo = createStemGeometry();
    const stemMat = new THREE.MeshStandardMaterial({
      color: PALETTE.stem,
      roughness: 0.7,
      metalness: 0.05
    });
    stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.y = -0.3;
    stemMesh.scale.set(0, 0, 0);
    flowerGroup.add(stemMesh);

    scene.add(flowerGroup);
  }

  /* ==========================================================
     LIGHTING SYSTEM
     ========================================================== */
  function setupLighting() {
    // Ambient warm base
    const ambient = new THREE.AmbientLight(CONFIG.colors.ambientWarm, 0.12);
    scene.add(ambient);

    // Cool fill from below
    const fillLight = new THREE.DirectionalLight(CONFIG.colors.ambientCool, 0.08);
    fillLight.position.set(0, -3, 2);
    scene.add(fillLight);

    // Key light (warm, from top-right)
    const keyLight = new THREE.DirectionalLight(PALETTE.keyLight, 0);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // Rim light (soft pink, from behind-left)
    const rimLight = new THREE.DirectionalLight(CONFIG.colors.rimLight, 0);
    rimLight.position.set(-4, 2, -3);
    scene.add(rimLight);

    // Subtle point light at center (warm glow)
    const centerGlow = new THREE.PointLight(PALETTE.centerGlow, 0, 8);
    centerGlow.position.set(0, 0, 0.5);
    scene.add(centerGlow);

    return { keyLight, rimLight, centerGlow };
  }

  /* ==========================================================
     ANIMATION CONTROLLER
     ========================================================== */
  function getPhaseProgress(t) {
    // Phase 1: 0-2.5s (Emergence)
    if (t < 2.5) return { phase: 1, p: t / 2.5 };
    // Phase 2: 2.5-7s (Formation)
    if (t < 7) return { phase: 2, p: (t - 2.5) / 4.5 };
    // Phase 3: 7-11s (Materialization)
    if (t < 11) return { phase: 3, p: (t - 7) / 4 };
    // Phase 4: 11-14s (Presence)
    return { phase: 4, p: (t - 11) / 3 };
  }

  function animateReveal(time, lights) {
    const t = Math.min(time, CONFIG.duration);
    const phase = getPhaseProgress(t);

    // === PHASE 1: EMERGENCE ===
    if (phase.phase === 1) {
      const p = Ease.cinematicInOut(phase.p);

      // Center glow appears
      lights.centerGlow.intensity = p * 0.8;

      // Flower group scales from invisible
      const s = 0.3 + p * 0.7;
      flowerGroup.scale.set(s, s, s);

      // Camera starts moving in
      const camZ = CONFIG.camera.startZ - (CONFIG.camera.startZ - CONFIG.camera.endZ) * p * 0.15;
      camera.position.z = camZ;

      // Petals show as dark silhouettes
      petalMeshes.forEach(petal => {
        petal.userData.mat.uniforms.uReveal.value = p * 0.15;
        petal.userData.mat.uniforms.uLightIntensity.value = p * 0.1;
      });

      // Stem begins to appear
      const stemS = p * 0.3;
      stemMesh.scale.set(stemS, stemS, stemS);
    }

    // === PHASE 2: FORMATION ===
    if (phase.phase >= 2) {
      const p = Ease.delicateOut(phase.phase === 2 ? phase.p : 1);

      lights.centerGlow.intensity = 0.8 + p * 0.4;
      lights.keyLight.intensity = p * 1.2;
      lights.rimLight.intensity = p * 0.6;

      // Camera continues dolly
      const camProgress = phase.phase === 2 ? phase.p * 0.7 + 0.15 : 0.85;
      const camP = Ease.cinematicInOut(camProgress);
      camera.position.z = CONFIG.camera.startZ - (CONFIG.camera.startZ - CONFIG.camera.endZ) * camP;

      // Petals unfold
      petalMeshes.forEach(petal => {
        const data = petal.userData;
        const delay = data.unfoldDelay;
        const speed = data.unfoldSpeed;
        let petalP = Math.max(0, (p - delay * 0.3) / (1.0 - delay * 0.3));
        petalP = Math.min(1, petalP * speed);
        petalP = Ease.delicateOut(petalP);

        // Unfold: x-rotation goes from ~130° to ~25°
        const startRot = Math.PI * 0.72;
        const endRot = Math.PI * 0.14;
        petal.rotation.x = startRot - (startRot - endRot) * petalP;

        // Spread outward slightly
        const spread = petalP * 0.08;
        petal.position.x = Math.cos(data.baseAngle) * (0.15 + spread);
        petal.position.y = Math.sin(data.baseAngle) * (0.15 + spread);
        petal.position.z = -0.3 + petalP * 0.25;

        // Material properties
        data.mat.uniforms.uReveal.value = 0.15 + petalP * 0.85;
        data.mat.uniforms.uLightIntensity.value = 0.1 + petalP * 0.9;
      });

      // Stem grows
      const stemP = Ease.delicateOut(Math.min(1, p * 1.2));
      stemMesh.scale.set(stemP, stemP, stemP);

      // Flower scale settles
      const flowerS = 1.0 - (1.0 - p) * 0.05;
      flowerGroup.scale.set(flowerS, flowerS, flowerS);
    }

    // === PHASE 3: MATERIALIZATION ===
    if (phase.phase >= 3) {
      const p = Ease.smoothLinear(phase.phase === 3 ? phase.p : 1);

      // Subsurface scattering resolves
      petalMeshes.forEach(petal => {
        petal.userData.mat.uniforms.uSubsurface.value = p * 0.8;
      });

      // Pistil appears
      const pistilP = Ease.softElastic(Math.min(1, p * 1.5));
      pistilGroup.scale.set(pistilP, pistilP, pistilP);
      pistilGroup.rotation.z = p * 0.1;

      // Light intensifies subtly
      lights.keyLight.intensity = 1.2 + p * 0.3;
      lights.rimLight.intensity = 0.6 + p * 0.4;
      lights.centerGlow.intensity = 1.2 + p * 0.3;

      // Camera final approach
      const camP = 0.85 + p * 0.15;
      camera.position.z = CONFIG.camera.startZ - (CONFIG.camera.startZ - CONFIG.camera.endZ) * Ease.cinematicInOut(camP);
    }

    // === PHASE 4: PRESENCE ===
    if (phase.phase >= 4) {
      const p = phase.phase === 4 ? phase.p : 1;

      // Breathing motion
      const breathPhase = p * Math.PI * 0.5;
      const breath = Math.sin(breathPhase) * 0.5 + 0.5;

      petalMeshes.forEach(petal => {
        petal.userData.mat.uniforms.uBreath.value = breath;
        petal.userData.mat.uniforms.uSubsurface.value = 0.8;
      });

      // Subtle light breathing
      lights.centerGlow.intensity = 1.5 + Math.sin(breathPhase * 2) * 0.15;
      lights.keyLight.intensity = 1.5 + Math.sin(breathPhase * 1.5 + 1) * 0.1;

      // Camera micro orbit
      const orbitT = t * CONFIG.camera.orbitSpeed;
      camera.position.x = Math.sin(orbitT) * CONFIG.camera.orbitRadius;
      camera.position.y = Math.cos(orbitT * 0.7) * CONFIG.camera.orbitRadius * 0.5;
      camera.lookAt(0, 0.3, 0);

      // Glow sprites fade in
      glowSprites.forEach(glow => {
        glow.material.opacity = breath * 0.25 * p;
        const pp = glow.userData.parentPetal;
        if (pp) {
          glow.position.copy(pp.position);
          glow.position.z += 0.5;
        }
      });
    } else {
      camera.lookAt(0, 0.3, 0);
    }
  }

  /* ==========================================================
     RENDER LOOP
     ========================================================== */
  function render() {
    if (!isActive) return;
    animId = requestAnimationFrame(render);

    const now = performance.now() * 0.001;
    if (!startTime) startTime = now;
    const elapsed = now - startTime;

    petalMeshes.forEach(p => {
      p.userData.mat.uniforms.uTime.value = now;
    });

    if (lightsRef) {
      animateReveal(elapsed, lightsRef);
    }

    renderer.render(scene, camera);
  }

  let lightsRef = null;

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  window.CinematicReveal = {
    init(containerId) {
      const container = document.getElementById(containerId);
      if (!container || typeof THREE === 'undefined') return false;

      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(PALETTE.bg);
      // Soft warm haze via fog
      scene.fog = new THREE.FogExp2(PALETTE.bg, 0.035);

      // Camera
      camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 0, CONFIG.camera.startZ);

      // Renderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;';
      container.appendChild(renderer.domElement);

      buildFlower();
      lightsRef = setupLighting();

      isActive = true;
      startTime = null;
      render();

      // Resize handler
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      return true;
    },

    destroy() {
      isActive = false;
      if (animId) cancelAnimationFrame(animId);
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
      petalMeshes = [];
      glowSprites = [];
      scene = null;
      camera = null;
      renderer = null;
      flowerGroup = null;
    },

    // Check if reveal is complete (phase 4)
    isComplete() {
      if (!startTime) return false;
      const elapsed = performance.now() * 0.001 - startTime;
      return elapsed >= CONFIG.duration;
    },

    // Get current progress 0-1
    getProgress() {
      if (!startTime) return 0;
      const elapsed = performance.now() * 0.001 - startTime;
      return Math.min(1, elapsed / CONFIG.duration);
    }
  };
})();
