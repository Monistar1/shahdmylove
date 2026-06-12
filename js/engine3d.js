/* ==========================================================
   LUXURY 3D ENVIRONMENT ENGINE v6.0 — $20,000 Standard
   Design System Colors: Primary #e91e63 | Rose Gold #d4a574
   ========================================================== */

(function() {
  'use strict';

  /* ── Canonical Color Tokens (mirrors css/core.css) ──
     Three.js cannot read CSS custom properties at runtime.
     These hex values MUST stay synchronized with css/core.css.
     When updating the design system, change BOTH files.         */
  const TOKENS = {
    primary:    0xe91e63,  // --color-primary
    pink:       0xff7a9e,  // --accent-pink
    purple:     0x9d4edd,  // --accent-purple
    lilac:      0xc8b6ff,  // --accent-lilac
    roseGold:   0xd4a574,  // --color-accent
    lightPink:  0xf472b6,
    palePink:   0xfbcfe8,
    paleLilac:  0xe9d5ff,
    bgPrimary:  0xcf99d7,  // --bg-primary
    ambient:    0xfff0f5,
    warmWhite:  0xfff5f8
  };

  const CONFIG = {
    particleCount: { desktop: 80, mobile: 30, low: 12 },
    colors: [
      new THREE.Color(TOKENS.primary),
      new THREE.Color(TOKENS.pink),
      new THREE.Color(TOKENS.purple),
      new THREE.Color(TOKENS.lilac),
      new THREE.Color(TOKENS.lightPink),
      new THREE.Color(TOKENS.roseGold),
      new THREE.Color(TOKENS.palePink),
      new THREE.Color(TOKENS.paleLilac)
    ],
    emissiveColors: [
      new THREE.Color(TOKENS.primary),
      new THREE.Color(TOKENS.pink),
      new THREE.Color(TOKENS.purple),
      new THREE.Color(TOKENS.lilac)
    ],
    cameraZ: 18,
    mouseSensitivity: 0.02,
    windStrength: 0.12,
    windFrequency: 0.25,
    damping: 0.97,
    returnForce: 0.006
  };

  let scene, camera, renderer, instancedMesh, material, geometry;
  let animId = null, isActive = true;
  let isMobile = false, isLowPower = false;
  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  let time = 0;

  let velocities, positions, basePositions, rotations, rotationSpeeds;
  let scales, baseScales, colorIndices;
  let dummy = new THREE.Object3D();

  /* ── Perlin Noise ── */
  const Perm = new Uint8Array(512);
  const P = new Uint8Array([
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
    140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
    247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
    57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
    74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
    60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
    65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
    200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
    52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
    207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
    119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
    129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
    218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
    81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
    184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
    222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
  ]);
  for (let i = 0; i < 512; i++) Perm[i] = P[i & 255];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function perlin3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = Perm[X] + Y, AA = Perm[A] + Z, AB = Perm[A + 1] + Z;
    const B = Perm[X + 1] + Y, BA = Perm[B] + Z, BB = Perm[B + 1] + Z;
    return lerp(w, lerp(v, lerp(u, grad(Perm[AA], x, y, z), grad(Perm[BA], x - 1, y, z)),
      lerp(u, grad(Perm[AB], x, y - 1, z), grad(Perm[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(Perm[AA + 1], x, y, z - 1), grad(Perm[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(Perm[AB + 1], x, y - 1, z - 1), grad(Perm[BB + 1], x - 1, y - 1, z - 1))));
  }

  /* ── Create 3D Gem Geometry ── */
  function createGemGeometry() {
    return new THREE.IcosahedronGeometry(0.35, 0);
  }

  /* ── Init ── */
  function init() {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded');
      return;
    }

    // Skip heavy 3D background on mobile to save battery/GPU
    isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window || !window.matchMedia('(pointer: fine)').matches;
    if (isMobile) {
      const canvas = document.getElementById('bg3d');
      if (canvas) canvas.style.display = 'none';
      return;
    }

    detectCapabilities();
    const container = document.getElementById('bg3d');
    if (!container) return;

    const qualityClass = document.body.classList.contains('quality-low') ? 'low'
      : document.body.classList.contains('quality-medium') ? 'medium' : 'high';
    const count = qualityClass === 'low' || isLowPower ? CONFIG.particleCount.low
      : (isMobile || qualityClass === 'medium' ? CONFIG.particleCount.mobile : CONFIG.particleCount.desktop);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(TOKENS.bgPrimary, 0.018);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.z = CONFIG.cameraZ;

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: isLowPower ? 'low-power' : 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
    container.appendChild(renderer.domElement);

    geometry = createGemGeometry();
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      emissiveIntensity: 0.3,
      metalness: 0.1,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(instancedMesh);

    velocities = new Float32Array(count * 3);
    positions = new Float32Array(count * 3);
    basePositions = new Float32Array(count * 3);
    rotations = new Float32Array(count * 3);
    rotationSpeeds = new Float32Array(count * 3);
    scales = new Float32Array(count);
    baseScales = new Float32Array(count);
    colorIndices = new Uint8Array(count);

    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const cluster = Math.random() < 0.3 ? 0.4 : 1.0;
      const r = (6 + Math.random() * 10 * cluster + Math.random() * Math.random() * 8);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      const z = r * Math.cos(phi) * 0.4;

      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      velocities[i * 3] = (Math.random() - 0.5) * 0.008;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;

      rotations[i * 3] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 1] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 2] = Math.random() * Math.PI * 2;

      rotationSpeeds[i * 3] = (Math.random() - 0.5) * 0.004;
      rotationSpeeds[i * 3 + 1] = (Math.random() - 0.5) * 0.004;
      rotationSpeeds[i * 3 + 2] = (Math.random() - 0.5) * 0.004;

      const s = 0.8 + Math.random() * 1.8 + Math.random() * Math.random() * 1.2;
      baseScales[i] = s;
      scales[i] = s;

      colorIndices[i] = Math.floor(Math.random() * CONFIG.colors.length);

      dummy.position.set(x, y, z);
      dummy.rotation.set(rotations[i * 3], rotations[i * 3 + 1], rotations[i * 3 + 2]);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      color.copy(CONFIG.colors[colorIndices[i]]);
      color.r += (Math.random() - 0.5) * 0.08;
      color.g += (Math.random() - 0.5) * 0.08;
      color.b += (Math.random() - 0.5) * 0.08;
      instancedMesh.setColorAt(i, color);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

    // 4-point lighting matching design system
    const ambientLight = new THREE.AmbientLight(TOKENS.ambient, 0.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(TOKENS.pink, 1.5, 40);
    pointLight1.position.set(6, 6, 8);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(TOKENS.lilac, 1.0, 40);
    pointLight2.position.set(-6, -4, 6);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(TOKENS.palePink, 0.8, 30);
    pointLight3.position.set(0, 8, 4);
    scene.add(pointLight3);

    const dirLight = new THREE.DirectionalLight(TOKENS.warmWhite, 0.6);
    dirLight.position.set(3, 5, 5);
    scene.add(dirLight);

    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    animate();
  }

  function detectCapabilities() {
    isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
    isLowPower = isMobile && (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseMove(e) {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onTouchMove(e) {
    if (!e.touches[0]) return;
    targetX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }

  function onVisibilityChange() {
    isActive = document.visibilityState === 'visible';
    if (isActive && !animId) animate();
  }

  /* ── Animation Loop ── */
  function animate() {
    animId = requestAnimationFrame(animate);
    if (!isActive) { animId = null; return; }
    if (document.hidden) return; // pause when tab hidden
    if (window.__FIREWORKS_ACTIVE__) return; // yield main thread to fireworks

    time += 0.016;
    const dt = 0.016;

    mouseX += (targetX - mouseX) * 0.03;
    mouseY += (targetY - mouseY) * 0.03;

    camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.015;
    camera.position.y += (-mouseY * 1.2 - camera.position.y) * 0.015;
    camera.lookAt(0, 0, 0);

    const count = instancedMesh.count;

    for (let i = 0; i < count; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

      const windX = perlin3(
        basePositions[ix] * 0.04 + time * CONFIG.windFrequency,
        basePositions[iy] * 0.04 + time * CONFIG.windFrequency * 0.7,
        time * 0.08
      ) * CONFIG.windStrength;
      const windY = perlin3(
        basePositions[ix] * 0.04 + time * CONFIG.windFrequency + 100,
        basePositions[iy] * 0.04 + time * CONFIG.windFrequency * 0.7,
        time * 0.08 + 100
      ) * CONFIG.windStrength * 0.5;

      const dx = positions[ix] - mouseX * 12;
      const dy = positions[iy] - mouseY * 9;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5 && dist > 0.1) {
        const force = (1 - dist / 5) * 0.002;
        velocities[ix] += (dx / dist) * force;
        velocities[iy] += (dy / dist) * force;
      }

      velocities[ix] += windX * dt;
      velocities[iy] += windY * dt;
      velocities[ix] += (basePositions[ix] - positions[ix]) * CONFIG.returnForce * dt;
      velocities[iy] += (basePositions[iy] - positions[iy]) * CONFIG.returnForce * dt;
      velocities[iz] += (basePositions[iz] - positions[iz]) * CONFIG.returnForce * dt;

      velocities[ix] *= CONFIG.damping;
      velocities[iy] *= CONFIG.damping;
      velocities[iz] *= CONFIG.damping;

      positions[ix] += velocities[ix];
      positions[iy] += velocities[iy];
      positions[iz] += velocities[iz];

      rotations[ix] += rotationSpeeds[ix];
      rotations[iy] += rotationSpeeds[iy];
      rotations[iz] += rotationSpeeds[iz];

      const breathe = Math.sin(time * 1.5 + i * 0.3) * 0.08;
      const s = baseScales[i] + breathe;

      dummy.position.set(positions[ix], positions[iy], positions[iz]);
      dummy.rotation.set(rotations[ix], rotations[iy], rotations[iz]);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function destroy() {
    isActive = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    if (renderer) {
      renderer.dispose();
      geometry?.dispose();
      material?.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    scene = null; camera = null; renderer = null;
    instancedMesh = null; geometry = null; material = null;
  }

  window.Engine3D = { init, destroy };
})();
