// Original GLSL for the DEVA world: a raymarched industrial quarry (pillars, gantries, dunes),
// backlit haze, pseudo-volumetric smoke, god rays, a metallic 3D bow-"D" emblem and GPU particles.

export const SCENE_VS = /* glsl */ `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam, uF, uR, uU;
uniform float uFl, uNear, uFar;
uniform float uFade, uBurst, uDim, uEmblem, uFlash, uSmoke, uAccent;
uniform int uSteps;
out vec4 fragColor;

const vec3 SUN = vec3(0.2316, 0.2965, -0.9265);
const vec3 EMB = vec3(0.0, 2.4, 0.0);

float hash21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float hash31(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash31(i), b = hash31(i + vec3(1,0,0)), c = hash31(i + vec3(0,1,0)), d = hash31(i + vec3(1,1,0));
  float e = hash31(i + vec3(0,0,1)), g = hash31(i + vec3(1,0,1)), h = hash31(i + vec3(0,1,1)), k = hash31(i + vec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
}
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ s += a * noise2(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return s; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }

// The emblem: bow (half ellipse-torus) + string (stem of the D) + arrow.
float sdEmblem(vec3 p){
  vec2 q = vec2(length(p.xy * vec2(1.0, 0.85)) - 1.0, p.z);
  float tube = 0.065 + 0.06 * smoothstep(0.8, 0.0, abs(p.y));
  float bow = max(length(q) - tube, -p.x);
  float str = sdCapsule(p, vec3(0.0, -1.17, 0.0), vec3(0.0, 1.17, 0.0), 0.028);
  float arrow = sdCapsule(p, vec3(-0.6, 0.0, 0.0), vec3(1.25, 0.0, 0.0), 0.032);
  vec3 h = p - vec3(1.36, 0.0, 0.0);
  float head = max(sdBox(h, vec3(0.17, 0.13, 0.035)), (h.x + abs(h.y) * 1.25 - 0.09) * 0.62);
  return min(min(bow, str), min(arrow, head));
}

float groundH(vec2 xz){
  return -0.45 + (0.3 + 1.7 * smoothstep(3.0, 15.0, abs(xz.x))) * fbm2(xz * 0.12) + 0.12 * noise2(xz * 0.9);
}

vec2 map(vec3 p){
  vec2 r = vec2((p.y - groundH(p.xz)) * 0.8, 0.0);
  // pillar corridor
  vec3 q = p; float side = sign(q.x); q.x = abs(q.x) - 7.5;
  float cz = floor(q.z / 9.0 + 0.5); q.z -= cz * 9.0;
  float h = 5.0 + 7.0 * hash21(vec2(cz, side));
  float pil = sdBox(q - vec3(0.0, h * 0.5 - 1.0, 0.0), vec3(0.85, h * 0.5, 0.85));
  pil = max(pil, -sdBox(vec3(q.x + 0.85, mod(q.y, 1.6) - 0.8, q.z), vec3(0.14, 0.09, 1.2)));
  if(pil < r.x) r = vec2(pil, 1.0);
  // gantry beams
  float bz = p.z - floor(p.z / 18.0 + 0.5) * 18.0;
  float beam = sdBox(vec3(p.x, p.y - 10.6, bz), vec3(8.4, 0.3, 0.35));
  beam = min(beam, sdBox(vec3(p.x, p.y - 11.3, bz), vec3(8.4, 0.08, 0.6)));
  if(beam < r.x) r = vec2(beam, 3.0);
  // emblem
  if(uEmblem > 0.01){
    vec3 e = p - EMB;
    float bd = length(e) - 2.3 * uEmblem;
    if(bd < 0.4){
      e.xz *= rot(sin(uTime * 0.35) * 0.45);
      e.xy *= rot(sin(uTime * 0.5) * 0.04);
      float s = 1.45 * uEmblem;
      float em = sdEmblem(e / s) * s;
      if(em < r.x) r = vec2(em, 2.0);
    } else r.x = min(r.x, bd);
  }
  return r;
}

vec3 calcNormal(vec3 p, float t){
  float e = 0.0015 * max(t, 1.0); vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x + k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

vec3 haze(vec3 rd){
  float s = max(dot(rd, SUN), 0.0);
  vec3 c = mix(vec3(0.47, 0.43, 0.40), vec3(0.17, 0.16, 0.16), smoothstep(0.0, 0.7, rd.y));
  return c + vec3(0.95, 0.82, 0.66) * pow(s, 5.0) * 0.55;
}
vec3 sky(vec3 rd){
  vec3 c = haze(rd);
  float s = max(dot(rd, SUN), 0.0);
  c += vec3(1.0, 0.93, 0.82) * pow(s, 90.0) * 0.9;
  vec2 cp = rd.xz / (abs(rd.y) + 0.25);
  c = mix(c, c * 0.8, smoothstep(0.45, 0.85, fbm2(cp * 1.2 + uTime * 0.01)) * smoothstep(0.05, 0.3, rd.y) * 0.6);
  float ang = atan(rd.x, -rd.z);
  float hill = 0.03 + 0.09 * fbm2(vec2(ang * 2.5, 3.1));
  c = mix(c, c * 0.55, smoothstep(hill + 0.006, hill - 0.006, rd.y) * 0.85);
  return c;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (2.0 * frag - uRes) / uRes.y;
  vec3 ro = uCam;
  vec3 rd = normalize(uF * uFl + uR * uv.x + uU * uv.y);

  float t = 0.1, mat = -1.0;
  for(int i = 0; i < 128; i++){
    if(i >= uSteps) break;
    vec2 h = map(ro + rd * t);
    if(h.x < 0.0012 * t){ mat = h.y; break; }
    t += h.x * 0.85;
    if(t > uFar) break;
  }

  vec3 col; float depth = 0.99999;
  float sd = max(dot(rd, SUN), 0.0);
  if(mat < 0.0){ col = sky(rd); t = uFar; }
  else {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p, t);
    float dif = clamp(dot(n, SUN), 0.0, 1.0);
    float ao = 0.4 + 0.6 * clamp(map(p + n * 0.5).x / 0.5, 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(-rd, n), 0.0, 1.0), 4.0);
    vec3 alb = vec3(0.07, 0.065, 0.06);
    if(mat < 0.5) alb = vec3(0.15, 0.13, 0.12) * (0.6 + 0.8 * noise2(p.xz * 1.3));
    else if(mat < 1.5) alb = vec3(0.11, 0.105, 0.10) * (0.75 + 0.5 * noise2(vec2(p.y * 3.0, p.x + p.z)));
    vec3 lin = vec3(1.0, 0.9, 0.78) * dif * 1.4 + vec3(0.42, 0.39, 0.36) * (0.5 + 0.5 * n.y) * 0.6 * ao;
    vec3 lp = vec3(0.0, 0.4, 1.6); vec3 lv = lp - p; float ld = length(lv);
    lin += vec3(0.85, 0.08, 0.06) * clamp(dot(n, lv / ld), 0.0, 1.0) * uAccent * 6.0 / (1.0 + ld * ld * 0.35);
    col = alb * lin + fres * haze(reflect(rd, n)) * 0.25 * ao;
    if(mat > 1.5 && mat < 2.5){
      vec3 rf = reflect(rd, n);
      float spec = pow(max(dot(rf, SUN), 0.0), 48.0);
      col = sky(rf) * vec3(0.78, 0.74, 0.72) * (0.35 + 0.65 * fres) + vec3(1.0, 0.92, 0.82) * spec * 2.5;
      col += vec3(0.95, 0.06, 0.08) * pow(1.0 - max(dot(-rd, n), 0.0), 2.5) * uAccent * 1.3;
      col += vec3(1.0, 0.2, 0.15) * uBurst * 0.8;
    }
    float zv = t * dot(rd, uF);
    float A = (uFar + uNear) / (uNear - uFar), B = 2.0 * uFar * uNear / (uNear - uFar);
    depth = clamp((-A + B / zv) * 0.5 + 0.5, 0.0, 1.0);
    float fa = (1.0 - exp(-t * 0.03)) * (0.65 + 0.6 * exp(-max(p.y, 0.0) * 0.22));
    col = mix(col, haze(rd), clamp(fa, 0.0, 1.0));
  }

  // drifting smoke (dithered pseudo-volumetric samples)
  float sm = 0.0;
  for(int k = 0; k < 5; k++){
    float st = 1.5 + float(k) * 3.2 + hash21(frag + float(k)) * 1.5;
    if(st > t) break;
    vec3 sp = ro + rd * st;
    float dn = noise3(sp * vec3(0.22, 0.35, 0.22) + vec3(uTime * 0.05, -uTime * 0.12, uTime * 0.03));
    sm += smoothstep(0.42, 0.9, dn) * exp(-max(sp.y, 0.0) * 0.16) * 0.2;
  }
  col = mix(col, haze(rd) * 0.95, clamp(sm * uSmoke, 0.0, 0.8));

  // god rays around the sun
  vec3 rx = normalize(cross(SUN, vec3(0.0, 1.0, 0.0))); vec3 ry = cross(rx, SUN);
  vec3 dp = rd - SUN * dot(rd, SUN);
  vec2 dir = normalize(vec2(dot(dp, rx), dot(dp, ry)) + 1e-5);
  float shafts = noise2(dir * 9.0 + uTime * 0.12) * noise2(dir * 3.5 - uTime * 0.05 + 4.0);
  col += vec3(1.0, 0.88, 0.72) * pow(sd, 3.0) * shafts * 0.55 * (0.35 + 0.65 * smoothstep(10.0, 60.0, t));

  // grade: desaturated warm film look
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 0.72) * vec3(1.06, 0.99, 0.92);
  col = 1.0 - exp(-col * 1.6);
  col = pow(col, vec3(1.08));
  vec2 q = frag / uRes;
  col *= mix(0.25, 1.0, pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.22));
  col *= 1.0 - uDim * 0.62;
  col += vec3(1.0, 0.3, 0.25) * uFlash * 0.55 + uFlash * 0.25;
  col += (hash21(frag + fract(uTime * 7.13) * 91.0) - 0.5) * 0.04;
  col *= uFade;
  fragColor = vec4(max(col, 0.0), 1.0);
  gl_FragDepth = depth;
}`;

export const PART_VS = /* glsl */ `#version 300 es
precision highp float;
in vec4 aSeed;
uniform mat4 uVP;
uniform vec3 uCam, uBurstC;
uniform float uTime, uBurst, uPx, uAspect, uDim;
uniform vec2 uMouse;
out vec3 vCol; out float vA;
void main(){
  vec3 box = vec3(34.0, 16.0, 34.0);
  float ember = step(0.84, aSeed.w);
  vec3 drift = mix(vec3(0.35, 0.04, 0.2), vec3(0.25, 1.1 + aSeed.y * 0.8, -0.15), ember);
  vec3 p = aSeed.xyz * box + drift * uTime;
  p.x += sin(uTime * 0.5 + aSeed.w * 40.0) * 0.5 * (0.4 + ember);
  p.z += cos(uTime * 0.4 + aSeed.x * 30.0) * 0.5;
  vec3 c = uCam + vec3(0.0, 3.0, 0.0);
  p = mod(p - c + box * 0.5, box) - box * 0.5 + c;
  vec3 dv = p - uBurstC; float dl = length(dv) + 1e-3;
  p += dv / dl * uBurst * 7.0 * exp(-dl * 0.12);
  vec4 clip = uVP * vec4(p, 1.0);
  if(clip.w < 0.1){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vCol = vec3(0.0); return; }
  vec2 ndc = clip.xy / clip.w;
  vec2 md = (ndc - uMouse) * vec2(uAspect, 1.0); float ml = length(md);
  ndc += (md / (ml + 1e-4)) * vec2(1.0 / uAspect, 1.0) * 0.09 * exp(-ml * ml * 14.0);
  clip.xy = ndc * clip.w;
  gl_Position = clip;
  float size = mix(0.035, 0.07, ember) * (0.5 + aSeed.w * 0.8);
  gl_PointSize = clamp(size * uPx / clip.w, 1.0, 24.0);
  vCol = mix(vec3(0.82, 0.78, 0.72), mix(vec3(1.0, 0.22, 0.08), vec3(1.0, 0.55, 0.18), aSeed.z), ember);
  float glow = exp(-ml * ml * 24.0);
  vA = mix(0.28, 0.95, ember) * (1.0 + glow * 1.8 + uBurst * 2.5) * smoothstep(34.0, 6.0, clip.w) * smoothstep(0.2, 1.2, clip.w) * (1.0 - uDim * 0.5);
}`;

export const PART_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec3 vCol; in float vA;
uniform float uFade;
out vec4 o;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0;
  float a = exp(-d * 3.0) * step(d, 1.0);
  o = vec4(vCol * a * vA * uFade, 1.0);
}`;
