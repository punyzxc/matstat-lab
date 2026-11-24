import type { Frame, RendererFactory } from './plate-canvas';

const tau = Math.PI * 2;
type Vec = [number, number, number];
function unit(x: number, y: number, z: number): Vec {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}
function cross(a: Vec, b: Vec): Vec {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// The centreline winds twice around a torus and three times through its hole.
function vertex(u: number, v: number) {
  const a = u * tau,
    b = v * tau,
    ring = 1.85 + 0.78 * Math.cos(3 * a),
    dr = -2.34 * Math.sin(3 * a);
  const x = ring * Math.cos(2 * a),
    y = ring * Math.sin(2 * a),
    z = 1.06 * Math.sin(3 * a);
  const tangent = unit(
    dr * Math.cos(2 * a) - 2 * ring * Math.sin(2 * a),
    dr * Math.sin(2 * a) + 2 * ring * Math.cos(2 * a),
    3.18 * Math.cos(3 * a),
  );
  const n = unit(tangent[1], -tangent[0], 0),
    bAxis = cross(tangent, n);
  const twist = 0.58 * Math.sin(2 * a + 0.43) + 0.29 * Math.cos(3 * a);
  const major = n.map((q, i) => q * Math.cos(twist) + bAxis[i] * Math.sin(twist));
  const minor = n.map((q, i) => -q * Math.sin(twist) + bAxis[i] * Math.cos(twist));
  const wide = 0.65 + 0.16 * Math.cos(3 * a + 0.32),
    thin = 0.31 + 0.09 * Math.cos(2 * a - 0.35);
  const offset = major.map((q, i) => q * wide * Math.cos(b) + minor[i] * thin * Math.sin(b));
  const normal = unit(
    ...(major.map((q, i) => (q * Math.cos(b)) / wide + (minor[i] * Math.sin(b)) / thin) as Vec),
  );
  return [x + offset[0], y + offset[1], z + offset[2], ...normal, u, v];
}
function geometry() {
  const rows = 240,
    cols = 48,
    vertices = [],
    indices = [];
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j <= cols; j++) vertices.push(...vertex(i / rows, j / cols));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j,
        b = a + cols + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const particleOffset = vertices.length / 8;
  let seed = 41;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // A low-density sheath follows the same surface normal as the engraved tube.
  for (let i = 0; i < 13000; i++) {
    const u = random(),
      v = random(),
      p = vertex(u, v);
    const jet = Math.pow(0.5 + 0.5 * Math.cos(tau * (u - 0.16)), 4);
    const lift = (0.02 + Math.pow(random(), 2.2) * 0.86) * (0.25 + jet * 1.8);
    vertices.push(
      p[0] + p[3] * lift,
      p[1] + p[4] * lift,
      p[2] + p[5] * lift,
      p[3],
      p[4],
      p[5],
      u,
      0.15 + 0.69 * random(),
    );
  }
  // A ruled particle wave provides a second depth plane behind the specimen.
  for (let row = 0; row < 53; row++)
    for (let j = 0; j < 115; j++) {
      const x = -5.8 + (11.6 * (j + random() * 0.55)) / 115,
        band = row / 52;
      const y =
        -0.7 + 0.33 * Math.sin(x * 1.4 + band * 2.3) + 0.53 * Math.cos(0.7 * x - band * 2.4) + band * 0.72;
      vertices.push(
        x,
        y,
        -2.55 + band * 0.48,
        0,
        1,
        0,
        x / 12 + 0.5,
        (0.21 + 0.45 * random()) * Math.pow(Math.sin((Math.PI * j) / 115), 0.6),
      );
    }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    particleOffset,
    particleCount: vertices.length / 8 - particleOffset,
  };
}
const camera = (f: Frame) => ({
  yaw: -0.25 + f.yaw + 0.24 * Math.sin(f.time * 0.14),
  pitch: -0.5 + 0.11 * Math.sin(f.time * 0.17),
  roll: -0.57 + 0.038 * Math.sin(f.time * 0.12),
  scale: Math.min(f.width / (f.width < 500 ? 9.7 : 7.85), f.height / 6.48),
});
const vert = `#version 300 es
  precision highp float; precision highp int;
  layout(location=0) in vec3 pos;
  layout(location=1) in vec3 normal;
  layout(location=2) in vec2 tex;
  uniform vec3 angle;
  uniform vec2 scale;
  uniform int particles; uniform float time; uniform float density; out float opacity;
  out vec3 N;
  out vec2 uv;
  out float depth;
  vec3 turn(vec3 p) {
    vec3 c=cos(angle),s=sin(angle);
    p=vec3(p.x*c.x+p.z*s.x,p.y,p.z*c.x-p.x*s.x);
    p=vec3(p.x,p.y*c.y-p.z*s.y,p.z*c.y+p.y*s.y);
    return vec3(p.x*c.z-p.y*s.z,p.y*c.z+p.x*s.z,p.z);
  }
  void main() {
    vec3 point=pos;
    if(particles==1) point+=normal*.045*sin(time*.64+tex.x*21.);
    vec3 p=turn(point);
    if(particles==1 && pos.z < -2.0) p=vec3(pos.x,point.y+.10*sin(time*.37+pos.x),pos.z);
    opacity=tex.y;gl_PointSize=density*(.75+.85*tex.y);
    N=turn(normal); uv=tex; depth=p.z;
    gl_Position=vec4(p.xy*scale*vec2(1.34,1.)/(1.-p.z*.055),-p.z*.12,1.);
  }`;
const frag = `#version 300 es
  precision highp float; precision highp int;
  in vec3 N; in vec2 uv; in float depth;
  uniform float time; uniform float mesh;
  uniform int particles; uniform float cue; in float opacity;
  out vec4 color;
  float line(float x,float weight){
    float d=abs(fract(x+.5)-.5);
    float aa=max(.012,fwidth(x)*.52);
    return 1.-smoothstep(weight-aa,weight+aa,d);
  }
  void main() {
    if(particles==1){
      float edge=1.-smoothstep(.15,.52,length(gl_PointCoord-.5));
      color=vec4(vec3(.86),opacity*edge);return;
    }
    vec3 n=normalize(N), light=normalize(vec3(-.55,.85,.70));
    float lambert=max(0.,dot(n,light)), rim=pow(1.-abs(n.z),1.65);
    float spec=pow(max(0.,dot(n,normalize(vec3(-.34,.67,1.25)))),8.);
    float illumination=.17+.73*lambert+.34*rim+.40*spec;
    float ribs=uv.x*282.+.48*sin(uv.y*6.283+uv.x*12.);
    float strands=uv.y*79.+uv.x*5.+2.1*sin(uv.x*6.283);
    float rib=line(ribs,.095);
    float thread=line(strands,.12);
    float etched=.24*rib+.77*thread+.72*rib*thread;
    float pattern=mix(etched,.88*line(uv.x*72.,.075)+.64*line(uv.y*25.+uv.x*3.,.055),mesh);
    float paper=(.025+.09*lambert+.10*rim+.24*spec)*mix(1.,.55,mesh);
    float silver=(paper+pattern*illumination)*(.81+.085*depth);
    float filament=line(uv.y*10.+uv.x*2.,.009);
    silver+=filament*(.08+.18*spec);
    float scan=pow(max(0.,cos(6.283*(uv.x-time*.032-.16))),55.);
    silver+=scan*(.035+.11*rib)*lambert;
    float band=abs(fract(uv.x-cue+.5)-.5);
    float marker=1.-smoothstep(.0013,.0032,band);
    color=vec4(mix(vec3(clamp(silver,0.,1.)),vec3(.95,.91,.47)*(.55+.45*lambert),marker),1.);
  }`;

export const wovenPlate: RendererFactory = (canvas) => {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    depth: true,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  const program = gl.createProgram()!;
  const shaders: WebGLShader[] = [];
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vert],
    [gl.FRAGMENT_SHADER, frag],
  ] as const) {
    const shader = gl.createShader(type)!;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  shaders.forEach((shader) => gl.deleteShader(shader));
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const data = geometry();
  const vertices = gl.createBuffer(),
    indices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  [3, 3, 2].forEach((sz, i) => {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, sz, gl.FLOAT, false, 32, [0, 12, 24][i]);
  });
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const angle = uniform('angle'),
    scale = uniform('scale'),
    time = uniform('time'),
    mesh = uniform('mesh');
  const particleMode = uniform('particles'),
    density = uniform('density'),
    cue = uniform('cue');
  return {
    draw(f) {
      const c = camera(f);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform3f(angle, c.yaw, c.pitch, c.roll);
      gl.uniform2f(scale, (2 * c.scale) / f.width, (2 * c.scale) / f.height);
      gl.uniform1f(time, f.time);
      gl.uniform1f(mesh, f.mesh ? 1 : 0);
      gl.uniform1i(particleMode, 0);
      gl.uniform1f(density, f.dpr);
      gl.uniform1f(cue, f.cue);
      gl.drawElements(gl.TRIANGLES, data.indices.length, gl.UNSIGNED_SHORT, 0);
      gl.uniform1i(particleMode, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, data.particleOffset, data.particleCount);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    },
    dispose() {
      gl.deleteBuffer(vertices);
      gl.deleteBuffer(indices);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
};

export const etchedPlate: RendererFactory = (canvas) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rows = 132,
    cols = 24;
  const rings = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => vertex(i / rows, j / cols)),
  );
  return {
    draw(f) {
      ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      ctx.clearRect(0, 0, f.width, f.height);
      const c = camera(f),
        ca = Math.cos(c.yaw),
        sa = Math.sin(c.yaw),
        cb = Math.cos(c.pitch),
        sb = Math.sin(c.pitch),
        cr = Math.cos(c.roll),
        sr = Math.sin(c.roll);
      function turn(x: number, y: number, z: number) {
        const a = x * ca + z * sa,
          b = z * ca - x * sa,
          y2 = y * cb - b * sb;
        return [a * cr - y2 * sr, y2 * cr + a * sr, b * cb + y * sb];
      }
      const projected = rings.map((row) =>
        row.map((p) => {
          const [x, y, z] = turn(p[0], p[1], p[2]),
            normal = turn(p[3], p[4], p[5]),
            k = c.scale / (1 - z * 0.055);
          const light = Math.max(0, -0.36 * normal[0] + 0.65 * normal[1] + 0.6 * normal[2]);
          return {
            x: f.width / 2 + x * k * 1.34,
            y: f.height / 2 - y * k,
            z,
            light,
            front: normal[2] > -0.15,
          };
        }),
      );
      const faces = [];
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          const a = projected[i][j];
          if (!a.front) continue;
          const next = projected[(i + 1) % rows],
            jj = (j + 1) % cols,
            b = next[j],
            d = projected[i][jj],
            e = next[jj];
          faces.push({ a, b, d, e, idx: i, depth: (a.z + b.z + d.z + e.z) * 0.25 });
        }
      faces.sort((a, b) => a.depth - b.depth);
      for (const { a, b, d, e, idx } of faces) {
        const grey = Math.floor(10 + 46 * a.light);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(e.x, e.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
        ctx.fill();
        ctx.strokeStyle =
          Math.abs(idx / rows - f.cue) < 0.004 ? '#e8e485' : `rgba(239,239,239,${0.19 + 0.55 * a.light})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(a.x, a.y);
        if (f.mesh) ctx.lineTo(b.x, b.y);
        ctx.lineWidth = 0.72;
        ctx.stroke();
      }
    },
  };
};
