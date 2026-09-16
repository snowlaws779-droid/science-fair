"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Quality = {
  primary: [number, number];
  secondary: [number, number];
  atmosphere: number;
  dpr: number;
  reduced: boolean;
};

type Motion = {
  pointerTarget: THREE.Vector2;
  pointer: THREE.Vector2;
  pointerWorldTarget: THREE.Vector2;
  pointerWorld: THREE.Vector2;
  previousPointerWorld: THREE.Vector2;
  pointerVelocity: THREE.Vector2;
  pointerSpeed: number;
  pointerStrength: number;
  pointerStrengthTarget: number;
  scroll: number;
};

// The approved field is kept intact, only raised slightly so it sits a touch
// higher in the hero composition.
const FIELD_BASE_Y = -2.04;
const FIELD_INTERACTION_Y = -1.92;

const fieldVertex = `
uniform float uTime;
uniform float uScroll;
uniform float uLayer;
uniform vec2 uPointerWorld;
uniform float uPointerStrength;
uniform float uPointerSpeed;
attribute float aVariation;
attribute float aSize;
varying float vDepth;
varying float vWarmth;
varying float vLife;
varying float vAlpha;
varying float vCursor;

float landscape(vec2 p, float phase) {
  float broad = sin(p.x * .25 + p.y * .095 + phase) * .83;
  float opposing = cos(p.x * .14 - p.y * .17 - phase * .48) * .7;
  float fold = sin(p.x * .52 + sin(p.y * .11 + phase) * 2.1) * .29;
  float valley = -exp(-pow(p.x * .12 - sin(p.y * .12 + phase) * .48, 2.)) * 1.35;
  return broad + opposing + fold + valley;
}

void main() {
  vec3 p = position;
  float phase = uTime * .105 + uScroll * .17 + uLayer * 1.45;
  p.y = ${FIELD_BASE_Y.toFixed(2)} + landscape(vec2(p.x, p.z), phase) * (uLayer < .5 ? 1. : 1.4);
  if (uLayer > .5) p.y += 2.25;

  // Broad, smooth world-space magnetic/pressure influence. The deeper layer
  // reacts less so the parallax/depth remains believable.
  vec2 cursorDelta = vec2(p.x - uPointerWorld.x, p.z - uPointerWorld.y);
  vec2 shapedDelta = vec2(cursorDelta.x * .31, cursorDelta.y * .16);
  float cursorDistance = length(shapedDelta);
  float local = exp(-dot(shapedDelta, shapedDelta));
  float layerStrength = uLayer < .5 ? 1. : .42;
  float influence = local * uPointerStrength * layerStrength;

  // Gentle lift + movement-driven ripple. No particle is moved on the CPU.
  float ripple = sin(cursorDistance * 7.2 - uTime * 3.15)
    * exp(-cursorDistance * 1.5)
    * uPointerSpeed
    * influence;
  p.y += influence * (uLayer < .5 ? .54 : .29);
  p.y += ripple * (uLayer < .5 ? .20 : .085);

  // Very small lateral bend gives the field a magnetic feel without
  // disturbing the approved topology.
  vec2 dir = cursorDelta / max(length(cursorDelta), .001);
  p.xz += dir * influence * (uLayer < .5 ? .105 : .042);

  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float distanceFade = 1. - smoothstep(14., 68., -mv.z);
  float edge = (1. - smoothstep(13., 19.5, abs(p.x)));
  float nearFade = smoothstep(3., 7., -mv.z);
  vDepth = distanceFade;
  vAlpha = distanceFade * nearFade * edge * (.64 + aVariation * .28) * (uLayer < .5 ? 1. : .48);
  vWarmth = sin(p.x * .14 + p.z * .085 + uLayer * 2.3) * .5 + .5;
  vLife = aVariation;
  vCursor = influence;
  gl_PointSize = clamp(aSize * (48. / max(2., -mv.z)) * (1. + influence * .08), .8, 3.7);
}
`;

const fieldFragment = `
varying float vDepth;
varying float vWarmth;
varying float vLife;
varying float vAlpha;
varying float vCursor;
void main() {
  float radius = length(gl_PointCoord - .5);
  float soft = 1. - smoothstep(.12, .48, radius);
  if (soft <= .01) discard;
  vec3 amber = vec3(.88, .36, .13);
  vec3 orange = vec3(.98, .55, .22);
  vec3 blue = vec3(.075, .27, .43);
  vec3 green = vec3(.18, .36, .19);
  vec3 ivory = vec3(.91, .8, .66);
  vec3 color = mix(amber, orange, vWarmth * .72);
  if (vWarmth < .25) color = mix(color, blue, .62);
  if (vLife > .966) color = mix(color, green, .65);
  if (vLife > .993) color = mix(color, ivory, .48);
  color = mix(vec3(.09, .11, .14), color, .3 + vDepth * .7);

  // A slight local glow follows the cursor without creating a visible halo.
  color = mix(color, ivory, clamp(vCursor * .20, 0., .16));
  float cursorGlow = 1. + vCursor * .24;
  gl_FragColor = vec4(color, soft * vAlpha * .91 * cursorGlow);
}
`;

const surfaceVertex = `
uniform float uTime;
uniform float uScroll;
uniform vec2 uPointerWorld;
uniform float uPointerStrength;
uniform float uPointerSpeed;
varying float vHeight;
varying float vDistance;
varying vec2 vUv;
varying float vFlow;
varying float vCursor;

float landscape(vec2 p, float phase) {
  float broad = sin(p.x * .25 + p.y * .095 + phase) * .83;
  float opposing = cos(p.x * .14 - p.y * .17 - phase * .48) * .7;
  float fold = sin(p.x * .52 + sin(p.y * .11 + phase) * 2.1) * .29;
  float valley = -exp(-pow(p.x * .12 - sin(p.y * .12 + phase) * .48, 2.)) * 1.35;
  return broad + opposing + fold + valley;
}
void main() {
  vUv = uv;
  vec3 p = vec3(position.x, 0., -23. + position.y);
  float phase = uTime * .105 + uScroll * .17;
  float height = landscape(vec2(p.x, p.z), phase);
  p.y = ${FIELD_BASE_Y.toFixed(2)} + height;

  vec2 cursorDelta = vec2(p.x - uPointerWorld.x, p.z - uPointerWorld.y);
  vec2 shapedDelta = vec2(cursorDelta.x * .31, cursorDelta.y * .16);
  float cursorDistance = length(shapedDelta);
  float local = exp(-dot(shapedDelta, shapedDelta));
  float influence = local * uPointerStrength;
  float ripple = sin(cursorDistance * 7.2 - uTime * 3.15)
    * exp(-cursorDistance * 1.5)
    * uPointerSpeed
    * influence;
  p.y += influence * .54 + ripple * .20;
  vec2 dir = cursorDelta / max(length(cursorDelta), .001);
  p.xz += dir * influence * .105;

  vHeight = height;
  vFlow = sin(p.x * .38 + p.z * .14 + phase * .65);
  vCursor = influence;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vDistance = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const surfaceFragment = `
varying float vHeight;
varying float vDistance;
varying vec2 vUv;
varying float vFlow;
varying float vCursor;
void main() {
  float ridge = smoothstep(-1.35, .9, vHeight);
  float current = smoothstep(.35, .96, vFlow * .5 + .5);
  float side = smoothstep(0., .24, vUv.x) * (1. - smoothstep(.76, 1., vUv.x));
  float front = smoothstep(0., .17, vUv.y) * (1. - smoothstep(.8, 1., vUv.y));
  float distanceFade = 1. - smoothstep(15., 56., vDistance);
  vec3 orange = vec3(.95, .4, .14);
  vec3 blue = vec3(.07, .22, .38);
  vec3 color = mix(blue, orange, .65 + current * .25);
  float contour = pow(max(0., sin(vHeight * 10.5 + vDistance * .11)), 18.);
  color = mix(color, vec3(1., .63, .27), contour * .6);
  color = mix(color, vec3(1., .72, .42), clamp(vCursor * .16, 0., .13));
  float alpha = (.23 + ridge * .4 + current * .18 + contour * .15 + vCursor * .11)
    * side * front * distanceFade;
  gl_FragColor = vec4(color, alpha);
}
`;

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function FieldLayer({ grid, layer, motion, reduced }: {
  grid: [number, number];
  layer: 0 | 1;
  motion: Motion;
  reduced: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const random = seeded(7117 + layer * 982);
    const count = grid[0] * grid[1];
    const positions = new Float32Array(count * 3);
    const variation = new Float32Array(count);
    const sizes = new Float32Array(count);
    const width = layer ? 48 : 38;
    const start = layer ? -17 : -3;
    const length = layer ? 47 : 42;
    for (let row = 0; row < grid[1]; row += 1) {
      for (let column = 0; column < grid[0]; column += 1) {
        const index = row * grid[0] + column;
        const jitter = (random() - .5) * .37;
        positions[index * 3] = (column / (grid[0] - 1) - .5) * width + jitter;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = start - row / (grid[1] - 1) * length + (random() - .5) * .28;
        variation[index] = random();
        const rank = random();
        sizes[index] = rank < .77 ? .68 : rank < .97 ? 1.1 : 1.65;
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    result.setAttribute("aVariation", new THREE.BufferAttribute(variation, 1));
    result.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return result;
  }, [grid, layer]);
  const uniforms = useMemo(() => ({
    uTime: { value: 1.9 },
    uScroll: { value: 0 },
    uLayer: { value: layer },
    uPointerWorld: { value: motion.pointerWorld },
    uPointerStrength: { value: 0 },
    uPointerSpeed: { value: 0 },
  }), [layer, motion]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = reduced ? 1.9 : state.clock.elapsedTime + 1.9;
    material.current.uniforms.uScroll.value = motion.scroll;
    const heroFade = Math.max(.16, 1 - Math.min(motion.scroll, 1.6) * .52);
    material.current.uniforms.uPointerStrength.value = reduced ? 0 : motion.pointerStrength * heroFade;
    material.current.uniforms.uPointerSpeed.value = reduced ? 0 : motion.pointerSpeed;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={fieldVertex}
        fragmentShader={fieldFragment} transparent depthWrite={false}
        blending={THREE.AdditiveBlending} />
    </points>
  );
}

function SurfaceGlow({ motion, reduced, mobile }: {
  motion: Motion;
  reduced: boolean;
  mobile: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 1.9 },
    uScroll: { value: 0 },
    uPointerWorld: { value: motion.pointerWorld },
    uPointerStrength: { value: 0 },
    uPointerSpeed: { value: 0 },
  }), [motion]);
  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = reduced ? 1.9 : state.clock.elapsedTime + 1.9;
    material.current.uniforms.uScroll.value = motion.scroll;
    const heroFade = Math.max(.16, 1 - Math.min(motion.scroll, 1.6) * .52);
    material.current.uniforms.uPointerStrength.value = reduced ? 0 : motion.pointerStrength * heroFade;
    material.current.uniforms.uPointerSpeed.value = reduced ? 0 : motion.pointerSpeed;
  });
  return <mesh frustumCulled={false}>
    <planeGeometry args={[38, 42, mobile ? 48 : 76, mobile ? 54 : 84]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={surfaceVertex}
      fragmentShader={surfaceFragment} side={THREE.DoubleSide} transparent
      depthWrite={false} blending={THREE.AdditiveBlending} />
  </mesh>;
}

function Atmosphere({ count, motion, reduced }: { count: number; motion: Motion; reduced: boolean }) {
  const points = useMemo(() => {
    const random = seeded(2216);
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - .5) * 36;
      positions[index * 3 + 1] = (random() - .5) * 9;
      positions[index * 3 + 2] = -4 - random() * 35;
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return result;
  }, [count]);
  const group = useRef<THREE.Points>(null);
  useEffect(() => () => points.dispose(), [points]);
  useFrame((_, delta) => {
    if (group.current && !reduced) {
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, motion.pointer.x * -.24, 2.2, delta);
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, motion.pointer.y * -.07, 2.2, delta);
    }
  });
  return <points ref={group} geometry={points}>
    <pointsMaterial color="#9c7856" size={.017} sizeAttenuation transparent opacity={.22}
      depthWrite={false} blending={THREE.AdditiveBlending} />
  </points>;
}

function Scene({ quality }: { quality: Quality }) {
  const motion = useMemo<Motion>(() => ({
    pointerTarget: new THREE.Vector2(),
    pointer: new THREE.Vector2(),
    pointerWorldTarget: new THREE.Vector2(),
    pointerWorld: new THREE.Vector2(),
    previousPointerWorld: new THREE.Vector2(),
    pointerVelocity: new THREE.Vector2(),
    pointerSpeed: 0,
    pointerStrength: 0,
    pointerStrengthTarget: 0,
    scroll: 0,
  }), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const interactionPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -FIELD_INTERACTION_Y),
    [],
  );
  const hit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      motion.pointerTarget.set(
        event.clientX / window.innerWidth * 2 - 1,
        1 - event.clientY / window.innerHeight * 2,
      );
      motion.pointerStrengthTarget = 1;
    };
    const onEnter = () => {
      motion.pointerStrengthTarget = 1;
    };
    const onLeave = () => {
      // Fade interaction where it is instead of snapping deformation to center.
      motion.pointerStrengthTarget = 0;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerenter", onEnter);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerenter", onEnter);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [motion]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, .05);
    const targetScroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 12);
    motion.scroll = THREE.MathUtils.damp(motion.scroll, targetScroll, quality.reduced ? 8 : 2.3, dt);

    if (!quality.reduced) {
      // Responsive but weighted pointer motion.
      motion.pointer.lerp(motion.pointerTarget, 1 - Math.exp(-dt * 6.0));

      // Screen-space cursor -> actual X/Z position on the particle landscape.
      raycaster.setFromCamera(motion.pointer, camera);
      const intersection = raycaster.ray.intersectPlane(interactionPlane, hit);
      if (intersection) {
        motion.pointerWorldTarget.set(
          THREE.MathUtils.clamp(intersection.x, -18.5, 18.5),
          THREE.MathUtils.clamp(intersection.z, -45, -2.5),
        );
      }
      motion.pointerWorld.lerp(motion.pointerWorldTarget, 1 - Math.exp(-dt * 7.0));

      if (dt > .0001) {
        motion.pointerVelocity.copy(motion.pointerWorld).sub(motion.previousPointerWorld).multiplyScalar(1 / dt);
        const speedTarget = THREE.MathUtils.clamp(motion.pointerVelocity.length() * .045, 0, 1);
        motion.pointerSpeed = THREE.MathUtils.damp(motion.pointerSpeed, speedTarget, 7.5, dt);
      }
      motion.previousPointerWorld.copy(motion.pointerWorld);
      motion.pointerStrength = THREE.MathUtils.damp(
        motion.pointerStrength,
        motion.pointerStrengthTarget,
        6.0,
        dt,
      );

      // Slightly stronger but still restrained parallax than the old .29/.14.
      camera.position.x = THREE.MathUtils.damp(camera.position.x, motion.pointer.x * .56, 2.7, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.2 + motion.pointer.y * .25, 2.7, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 8.3 - Math.min(motion.scroll * .16, 1.35), 1.8, dt);
    } else {
      motion.pointerSpeed = THREE.MathUtils.damp(motion.pointerSpeed, 0, 8, dt);
      motion.pointerStrength = THREE.MathUtils.damp(motion.pointerStrength, 0, 8, dt);
    }

    camera.lookAt(
      quality.reduced ? 0 : motion.pointer.x * .19,
      quality.reduced ? -1.1 : -1.1 + motion.pointer.y * .075,
      -14,
    );
  });
  return <>
    <SurfaceGlow motion={motion} reduced={quality.reduced} mobile={quality.primary[0] < 144} />
    <FieldLayer grid={quality.primary} layer={0} motion={motion} reduced={quality.reduced} />
    <FieldLayer grid={quality.secondary} layer={1} motion={motion} reduced={quality.reduced} />
    <Atmosphere count={quality.atmosphere} motion={motion} reduced={quality.reduced} />
  </>;
}

function profile(width: number, reduced: boolean): Quality {
  const mobile = width < 720;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
  return {
    primary: mobile ? [112, 94] : lowPower ? [144, 96] : [176, 118],
    secondary: mobile ? [70, 62] : lowPower ? [88, 68] : [96, 72],
    atmosphere: mobile ? 75 : lowPower ? 100 : 155,
    dpr: mobile || lowPower ? 1.15 : 1.5,
    reduced,
  };
}

export function ScienceWorld() {
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(true);
  const [quality, setQuality] = useState<Quality>({
    primary: [176, 118], secondary: [96, 72], atmosphere: 155, dpr: 1.5, reduced: false,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateProfile = () => setQuality(profile(window.innerWidth, media.matches));
    updateProfile();
    const canvas = document.createElement("canvas");
    setEnabled(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    window.addEventListener("resize", updateProfile);
    media.addEventListener("change", updateProfile);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("resize", updateProfile);
      media.removeEventListener("change", updateProfile);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!enabled) return <div className="world-fallback" aria-hidden="true" />;
  return <div className="world" aria-hidden="true">
    <Canvas dpr={quality.dpr} frameloop={visible && !quality.reduced ? "always" : "demand"}
      camera={{ position: [0, 3.2, 8.3], fov: 50, near: .1, far: 90 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", () => setEnabled(false), { once: true });
      }}>
      <color attach="background" args={["#080b11"]} />
      <fog attach="fog" args={["#080b11", 20, 66]} />
      <Scene quality={quality} />
    </Canvas>
  </div>;
}

// Keep both exports so existing dynamic imports and direct imports are safe.
export default ScienceWorld;
