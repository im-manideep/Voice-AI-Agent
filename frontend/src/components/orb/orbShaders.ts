// Orb look: dark glassy core + bright fresnel rim (so UI text in front stays
// readable), two octaves of simplex noise for fine organic ripples rather
// than big lumps. Audio level feeds both displacement and rim brightness.
// Fragment: fresnel-weighted aurora (teal <-> violet). Zero runtime deps.

export const orbVertexShader = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uDisplace;
uniform float uGain;
uniform float uNoiseScale;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisp;

// --- Ashima simplex noise (webgl-noise, MIT) -------------------------------
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
// ---------------------------------------------------------------------------

void main() {
  // Broad slow swell + fine fast detail. Audio adds energy to the detail.
  float broad = snoise(normal * uNoiseScale + vec3(uTime * 0.5, uTime * 0.38, uTime * 0.26));
  float fine  = snoise(normal * (uNoiseScale * 2.7) - vec3(uTime * 0.9, uTime * 0.7, uTime * 0.55));
  float n = broad * 0.62 + fine * 0.38;

  float amp = uDisplace + uLevel * uGain * 0.16;
  vec3 displaced = position + normal * n * amp;

  vDisp = n;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const orbFragmentShader = /* glsl */ `
uniform vec3 uColorA;      // rim / highlight
uniform vec3 uColorB;      // secondary aurora
uniform vec3 uColorDeep;   // dark body
uniform float uLevel;
uniform float uBrightness;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisp;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);
  float facing = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - facing, 2.4);

  // Dark glassy body with a hint of aurora where the surface swells.
  vec3 body = mix(uColorDeep, uColorB, smoothstep(-0.5, 0.9, vDisp) * 0.35);
  vec3 col = body * (0.22 + 0.18 * uLevel);

  // Bright aurora rim — this is what blooms.
  vec3 rim = mix(uColorB, uColorA, fresnel);
  col += rim * fresnel * uBrightness * (0.9 + 1.1 * uLevel);

  // Soft key light from above.
  col += uColorA * 0.06 * smoothstep(0.15, 1.0, N.y) * facing;

  gl_FragColor = vec4(col, 1.0);
}
`

// Atmospheric halo rendered on a slightly larger back-facing sphere.
export const haloVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const haloFragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uStrength;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.0);
  vec3 col = mix(uColorB, uColorA, 0.45);
  gl_FragColor = vec4(col, f * uStrength);
}
`
