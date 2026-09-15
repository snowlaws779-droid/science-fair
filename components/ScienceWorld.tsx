"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ============================================================
   Reduced-motion detection
   ============================================================ */
const _mq =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

let _reduced = _mq ? _mq.matches : false;
if (_mq) {
  _mq.addEventListener("change", (e: MediaQueryListEvent) => {
    _reduced = e.matches;
  });
}

/* ============================================================
   Mutable interaction state — never triggers React re-render
   ============================================================ */
const I = {
  ndcTarget: new THREE.Vector2(0, 0),
  ndc: new THREE.Vector2(0, 0),
  worldTarget: new THREE.Vector2(0, 0), // x, z in world space
  world: new THREE.Vector2(0, 0),
  prevWorld: new THREE.Vector2(0, 0),
  vel: new THREE.Vector2(0, 0),
  speed: 0,
  speedTarget: 0,
  strength: 0,
  strengthTarget: 0,
  scroll: 0,
  inside: false,
  raycaster: new THREE.Raycaster(),
  plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hit: new THREE.Vector3(),
};

const FIELD_Y = 0.0;

/* ============================================================
   Primary particle field — vertex shader
   (existing wave + world-space cursor deformation)
   ============================================================ */
const primaryVert = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2  uPointerWorld;
  uniform float uPointerStrength;
  uniform float uPointerSpeed;
  uniform float uScrollFade;

  attribute float aScale;
  attribute float aPhase;
  attribute vec3  aColor;

  varying vec3  vColor;
  varying float vPointerInfluence;
  varying float vDepth;

  void main() {
    vec3 p = position;

    /* ---- existing base landscape wave (preserved) ---- */
    float w1 = sin(p.x * 0.30 + uTime * 0.50) * cos(p.z * 0.25 + uTime * 0.40);
    float w2 = sin(p.x * 0.15 - uTime * 0.30 + aPhase) * 0.50;
    p.y += w1 * 0.40 + w2 * 0.30;
    p.y += aScale * 0.12;

    /* ---- cursor world-space influence ---- */
    vec2  cD    = vec2(p.x, p.z) - uPointerWorld;
    float cDist = length(cD);
    float fall  = 0.14;
    float infl  = exp(-cDist * cDist * fall) * uScrollFade;

    /* pressure deformation — gentle broad rise */
    p.y += infl * 0.55 * uPointerStrength;

    /* speed-driven ripple */
    float rDec = exp(-cDist * 0.55);
    float rip  = sin(cDist * 3.2 - uTime * 4.5) * rDec
               * uPointerSpeed * uPointerStrength;
    p.y += rip * 0.14;

    /* subtle lateral bend */
    vec2 dir = normalize(cD + 1e-5);
    p.xz += dir * infl * 0.12 * uPointerStrength;

    vPointerInfluence = infl * uPointerStrength;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixelRatio * (300.0 / -mv.z);
    vColor = aColor;
    vDepth = -mv.z;
  }
`;

const primaryFrag = /* glsl */ `
  varying vec3  vColor;
  varying float vPointerInfluence;
  varying float vDepth;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = vColor + vPointerInfluence * 0.18;
    float depthFade = smoothstep(70.0, 8.0, vDepth);
    gl_FragColor = vec4(col, a * 0.82 * depthFade);
  }
`;

/* ============================================================
   Secondary (deeper) field — weaker response
   ============================================================ */
const secondaryVert = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2  uPointerWorld;
  uniform float uPointerStrength;
  uniform float uPointerSpeed;
  uniform float uScrollFade;

  attribute float aScale;
  attribute float aPhase;
  attribute vec3  aColor;

  varying vec3  vColor;
  varying float vPointerInfluence;
  varying float vDepth;

  void main() {
    vec3 p = position;

    float w1 = sin(p.x * 0.18 + uTime * 0.25) * cos(p.z * 0.15 + uTime * 0.20);
    p.y += w1 * 0.30;
    p.y += aScale * 0.08;

    /* weaker, wider influence */
    vec2  cD    = vec2(p.x, p.z) - uPointerWorld;
    float cDist = length(cD);
    float fall  = 0.08;
    float infl  = exp(-cDist * cDist * fall) * uScrollFade;

    p.y += infl * 0.25 * uPointerStrength;

    float rDec = exp(-cDist * 0.35);
    float rip  = sin(cDist * 2.0 - uTime * 2.5) * rDec
               * uPointerSpeed * uPointerStrength;
    p.y += rip * 0.06;

    vec2 dir = normalize(cD + 1e-5);
    p.xz += dir * infl * 0.05 * uPointerStrength;

    vPointerInfluence = infl * uPointerStrength * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixelRatio * (300.0 / -mv.z);
    vColor = aColor;
    vDepth = -mv.z;
  }
`;

const secondaryFrag = /* glsl */ `
  varying vec3  vColor;
  varying float vPointerInfluence;
  varying float vDepth;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = vColor + vPointerInfluence * 0.10;
    float depthFade = smoothstep(90.0, 10.0, vDepth);
    gl_FragColor = vec4(col, a * 0.6 * depthFade);
  }
`;

/* ============================================================
   Glow / surface mesh — follows SAME deformation as primary
   ============================================================ */
const glowVert = /* glsl */ `
  uniform float uTime;
  uniform vec2  uPointerWorld;
  uniform float uPointerStrength;
  uniform float uPointerSpeed;
  uniform float uScrollFade;

  varying float vPointerInfluence;
  varying float vY;

  void main() {
    vec3 p = position;

    /* match primary field base wave exactly */
    float w1 = sin(p.x * 0.30 + uTime * 0.50) * cos(p.z * 0.25 + uTime * 0.40);
    float w2 = sin(p.x * 0.15 - uTime * 0.30) * 0.50;
    p.y += w1 * 0.40 + w2 * 0.30;

    /* identical cursor deformation */
    vec2  cD    = vec2(p.x, p.z) - uPointerWorld;
    float cDist = length(cD);
    float fall  = 0.14;
    float infl  = exp(-cDist * cDist * fall) * uScrollFade;

    p.y += infl * 0.55 * uPointerStrength;

    float rDec = exp(-cDist * 0.55);
    float rip  = sin(cDist * 3.2 - uTime * 4.5) * rDec
               * uPointerSpeed * uPointerStrength;
    p.y += rip * 0.14;

    vec2 dir = normalize(cD + 1e-5);
    p.xz += dir * infl * 0.12 * uPointerStrength;

    vPointerInfluence = infl * uPointerStrength;
    vY = p.y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const glowFrag = /* glsl */ `
  uniform float uTime;
  varying float vPointerInfluence;
  varying float vY;
  void main() {
    vec3 base = mix(
      vec3(0.04, 0.08, 0.16),
      vec3(0.10, 0.05, 0.02),
      smoothstep(-1.0, 1.5, vY)
    );
    base += vec3(0.05, 0.03, 0.08) * vPointerInfluence;
    float alpha = 0.20 + vPointerInfluence * 0.12;
    gl_FragColor = vec4(base, alpha);
  }
`;

/* ============================================================
   Atmosphere — parallax only, no local deformation
   ============================================================ */
const atmoVert = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2  uParallax;

  attribute float aScale;
  attribute float aPhase;
  attribute vec3  aColor;

  varying vec3  vColor;
  varying float vDepth;

  void main() {
    vec3 p = position;
    p.xz -= uParallax;            /* inverse parallax */

    float drift = sin(uTime * 0.2 + aPhase) * 0.3;
    p.y += drift;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixelRatio * (250.0 / -mv.z);
    vColor = aColor;
    vDepth = -mv.z;
  }
`;

const atmoFrag = /* glsl */ `
  varying vec3  vColor;
  varying float vDepth;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    float depthFade = smoothstep(100.0, 15.0, vDepth);
    gl_FragColor = vec4(vColor, a * 0.35 * depthFade);
  }
`;

/* ============================================================
   Primary particle field component
   ============================================================ */
function PrimaryField() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 2.2 },
      uPixelRatio: {
        value:
          typeof window !== "undefined"
            ? Math.min(window.devicePixelRatio, 2)
            : 1,
      },
      uPointerWorld: { value: new THREE.Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uPointerSpeed: { value: 0 },
      uScrollFade: { value: 1 },
    }),
    []
  );

  const { positions, scales, phases, colors } = useMemo(() => {
    const COUNT = 18000;
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const cA = new THREE.Color("#ff8a3d");
    const cB = new THREE.Color("#3da5ff");
    const cC = new THREE.Color("#4dd9a0");
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      scales[i] = 0.5 + Math.random() * 1.5;
      phases[i] = Math.random() * Math.PI * 2;
      const r = Math.random();
      const c = r < 0.33 ? cA : r < 0.66 ? cB : cC;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, scales, phases, colors };
  }, []);

  useFrame((_, delta) => {
    const u = uniforms;
    u.uTime.value += delta;
    u.uPointerWorld.value.copy(I.world);
    u.uPointerStrength.value = I.strength;
    u.uPointerSpeed.value = I.speed;
    u.uScrollFade.value = 1.0 - I.scroll * 0.6;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={primaryVert}
        fragmentShader={primaryFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ============================================================
   Secondary (deeper) particle field component
   ============================================================ */
function SecondaryField() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 1.6 },
      uPixelRatio: {
        value:
          typeof window !== "undefined"
            ? Math.min(window.devicePixelRatio, 2)
            : 1,
      },
      uPointerWorld: { value: new THREE.Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uPointerSpeed: { value: 0 },
      uScrollFade: { value: 1 },
    }),
    []
  );

  const { positions, scales, phases, colors } = useMemo(() => {
    const COUNT = 8000;
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const cA = new THREE.Color("#cc6a2e");
    const cB = new THREE.Color("#2e7acc");
    const cC = new THREE.Color("#3da878");
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = -4 + (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
      scales[i] = 0.3 + Math.random() * 1.0;
      phases[i] = Math.random() * Math.PI * 2;
      const r = Math.random();
      const c = r < 0.33 ? cA : r < 0.66 ? cB : cC;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, scales, phases, colors };
  }, []);

  useFrame((_, delta) => {
    const u = uniforms;
    u.uTime.value += delta;
    u.uPointerWorld.value.copy(I.world);
    u.uPointerStrength.value = I.strength;
    u.uPointerSpeed.value = I.speed;
    u.uScrollFade.value = 1.0 - I.scroll * 0.6;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={secondaryVert}
        fragmentShader={secondaryFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ============================================================
   Glow surface mesh — aligned with primary field deformation
   ============================================================ */
function GlowSurface() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointerWorld: { value: new THREE.Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uPointerSpeed: { value: 0 },
      uScrollFade: { value: 1 },
    }),
    []
  );

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(60, 60, 80, 80);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uPointerWorld.value.copy(I.world);
    uniforms.uPointerStrength.value = I.strength;
    uniforms.uPointerSpeed.value = I.speed;
    uniforms.uScrollFade.value = 1.0 - I.scroll * 0.6;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={glowVert}
        fragmentShader={glowFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================
   Atmospheric particles — subtle inverse parallax only
   ============================================================ */
function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 1.5 },
      uPixelRatio: {
        value:
          typeof window !== "undefined"
            ? Math.min(window.devicePixelRatio, 2)
            : 1,
      },
      uParallax: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  const { positions, scales, phases, colors } = useMemo(() => {
    const COUNT = 800;
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const c = new THREE.Color("#aaccff");
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = 5 + Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      scales[i] = 0.3 + Math.random() * 0.8;
      phases[i] = Math.random() * Math.PI * 2;
      const v = 0.5 + Math.random() * 0.5;
      colors[i * 3] = c.r * v;
      colors[i * 3 + 1] = c.g * v;
      colors[i * 3 + 2] = c.b * v;
    }
    return { positions, scales, phases, colors };
  }, []);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    const u = uniforms.uParallax.value;
    if (!_reduced) {
      const tx = -I.ndc.x * 0.3 * (1.0 - I.scroll * 0.5);
      const ty = -I.ndc.y * 0.1 * (1.0 - I.scroll * 0.5);
      const k = 1.0 - Math.exp(-delta * 3.0);
      u.x += (tx - u.x) * k;
      u.y += (ty - u.y) * k;
    } else {
      u.x *= 0.9;
      u.y *= 0.9;
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={atmoVert}
        fragmentShader={atmoFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ============================================================
   Pointer tracker — window-level listeners + raycast to world
   ============================================================ */
function PointerTracker() {
  const { camera } = useThree();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      I.ndcTarget.x = (e.clientX / w) * 2 - 1;
      I.ndcTarget.y = -(e.clientY / h) * 2 + 1;
      I.strengthTarget = 1;
      I.inside = true;
    };
    const onLeave = () => {
      I.strengthTarget = 0;
      I.inside = false;
    };
    const onEnter = () => {
      I.inside = true;
    };
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      I.scroll = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    window.addEventListener("blur", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = 1.0 - Math.exp(-dt * 6.0);
    const kSlow = 1.0 - Math.exp(-dt * 4.0);

    /* smooth NDC */
    I.ndc.x += (I.ndcTarget.x - I.ndc.x) * k;
    I.ndc.y += (I.ndcTarget.y - I.ndc.y) * k;

    /* raycast to horizontal plane at FIELD_Y */
    I.plane.normal.set(0, 1, 0);
    I.plane.constant = -FIELD_Y;
    I.raycaster.setFromCamera(I.ndc, camera);
    const hit = I.raycaster.ray.intersectPlane(I.plane, I.hit);
    if (hit) {
      I.worldTarget.x = hit.x;
      I.worldTarget.y = hit.z;
    }

    /* smooth world position */
    I.world.x += (I.worldTarget.x - I.world.x) * k;
    I.world.y += (I.worldTarget.y - I.world.y) * k;

    /* velocity → speed */
    if (dt > 1e-4) {
      I.vel.x = (I.world.x - I.prevWorld.x) / dt;
      I.vel.y = (I.world.y - I.prevWorld.y) / dt;
      I.speedTarget = Math.min(I.vel.length() * 0.3, 1.0);
    }
    I.prevWorld.copy(I.world);

    /* smooth speed + strength */
    I.speed += (I.speedTarget - I.speed) * kSlow;
    I.strength += (I.strengthTarget - I.strength) * kSlow;

    /* reduced motion: kill interaction */
    if (_reduced) {
      I.speed *= 0.9;
      I.strength *= 0.9;
    }
  });

  return null;
}

/* ============================================================
   Camera rig — subtle parallax tied to cursor strength
   ============================================================ */
function CameraRig() {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 8, 22), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = 1.0 - Math.exp(-dt * 3.0);

    let px = 0,
      py = 0;
    if (!_reduced) {
      px = I.ndc.x * 0.5 * I.strength;
      py = I.ndc.y * 0.2 * I.strength;
    }

    target.set(base.x + px, base.y + py, base.z);
    camera.position.lerp(target, k);
    camera.lookAt(look);
  });

  return null;
}

/* ============================================================
   Main exported component
   ============================================================ */
export default function ScienceWorld() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 8, 22], fov: 55, near: 0.1, far: 200 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true }}
        style={{ pointerEvents: "none" }}
      >
        <color attach="background" args={["#05080f"]} />
        <fog attach="fog" args={["#05080f", 25, 70]} />
        <PointerTracker />
        <CameraRig />
        <GlowSurface />
        <PrimaryField />
        <SecondaryField />
        <Atmosphere />
      </Canvas>
    </div>
  );
}
