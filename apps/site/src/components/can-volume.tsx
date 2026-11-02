'use client';
import Image from 'next/image';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * How a card held up close is turned: `turn` — its lean around the upright axis, −1 (face to the left) to 1 (face to the
 * right), the sway included; `light` — where the light is across the card, 0–1. The big view (`CardInspector`) provides
 * it; a card anywhere else has none and keeps its flat photo.
 */
export type CanPoseReader = () => { turn: number; light: number };
export const CanPose = createContext<CanPoseReader | null>(null);

/**
 * The most the label turns around the can, in radians (about 23°). A card faced to the right shows the can's left side:
 * the label slides right, and what was round the left edge comes into view.
 */
const MAX_TURN = .4;
/** A photo at least this much taller than wide is taken for a can or a bottle; packs and boxes stay flat. */
const TALL = 1.55;

const VERTEX = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
/**
 * The photo wrapped round a cylinder. The outline stays as it is (alpha from the photo as it stands); each row is its own
 * circle, between the row's left and right edge from `rows` (the lid and the neck are narrower than the body), and the
 * label is read from where it would be after turning by `turn` — sin(asin(x) + turn). The edges darken with the surface's
 * slant, and the highlight stays where the light is while the label slides under it, as on a can turned in the hand.
 */
const FRAGMENT = `precision mediump float;
varying vec2 v;
uniform sampler2D tex;
uniform sampler2D rows;
uniform vec4 rect;
uniform float turn;
uniform float glint;
void main(){
  vec2 uv=(vec2(v.x,1.-v.y)-rect.xy)/rect.zw;
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)discard;
  vec4 here=texture2D(tex,uv);
  if(here.a<.004)discard;
  vec2 edge=texture2D(rows,vec2(.5,uv.y)).ra;
  float width=max(edge.y-edge.x,.002);
  float phi=asin(clamp((uv.x-edge.x)/width,0.,1.)*2.-1.);
  vec4 there=texture2D(tex,vec2(edge.x+(sin(phi+turn)*.5+.5)*width,uv.y));
  vec3 c=mix(here.rgb,there.rgb,smoothstep(.2,.8,there.a));
  c*=mix(.78,1.,pow(cos(phi),.6));
  c+=exp(-pow((phi-glint)/.2,2.))*.26+exp(-pow((phi-1.2)/.12,2.))*.08;
  gl_FragColor=vec4(c*here.a,here.a);
}`;

function program(gl: WebGLRenderingContext) {
  const shader = (type: number, source: string) => {
    const made = gl.createShader(type);
    if (!made) return null;
    gl.shaderSource(made, source);
    gl.compileShader(made);
    return gl.getShaderParameter(made, gl.COMPILE_STATUS) ? made : null;
  };
  const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const linked = vertex && fragment ? gl.createProgram() : null;
  if (!linked) return null;
  gl.attachShader(linked, vertex!);
  gl.attachShader(linked, fragment!);
  gl.linkProgram(linked);
  return gl.getProgramParameter(linked, gl.LINK_STATUS) ? linked : null;
}

/** Each row's left and right edge of the can, 0–255 across the photo: the circle that row is wrapped round. */
function rowEdges(image: HTMLImageElement): Uint8Array {
  const width = image.naturalWidth, height = image.naturalHeight;
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const context = scratch.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const edges = new Uint8Array(height * 2);
  for (let y = 0; y < height; y++) {
    let left = 0, right = width - 1;
    while (left < width && pixels[(y * width + left) * 4 + 3]! < 128) left++;
    while (right > left && pixels[(y * width + right) * 4 + 3]! < 128) right--;
    if (left >= width) left = right = 0;
    edges[y * 2] = Math.round(left / (width - 1) * 255);
    edges[y * 2 + 1] = Math.round(right / (width - 1) * 255);
  }
  return edges;
}

function texture(gl: WebGLRenderingContext, unit: number) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  for (const [name, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, name, value);
}

/**
 * A cut-out can that looks round. Inside the big view a tiny WebGL shader draws it over its photo: the label turns round
 * the can with the card's lean and sway, and the highlight stays put while the label slides under it. One small canvas,
 * one texture and one draw per frame, only while the big view is open; and it eases toward the lean, so a jerky finger
 * does not make it jump. Anywhere else — no big view around it, no WebGL, reduced motion, a photo that was not cut
 * (the server says so in `X-Can-Cut`) or a pack rather than a can — it is the photo as it was.
 */
export function CanVolume({ src }: { src: string }) {
  const pose = useContext(CanPose);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [round, setRound] = useState(false);

  useEffect(() => {
    const node = canvas.current;
    if (!pose || !node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stopped = false, frame = 0, url = '';
    let context: WebGLRenderingContext | null = null;
    const image = new window.Image();
    const lost = (event: Event) => { event.preventDefault(); stopped = true; cancelAnimationFrame(frame); setRound(false); };
    node.addEventListener('webglcontextlost', lost);

    void fetch(src).then(async response => {
      if (stopped || !response.ok || response.headers.get('X-Can-Cut') !== '1') return;
      url = URL.createObjectURL(await response.blob());
      image.onload = start;
      image.src = url;
    }).catch(() => undefined);

    function start() {
      if (stopped || image.naturalHeight / image.naturalWidth < TALL) return;
      const gl = context = node!.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
      const linked = gl && program(gl);
      if (!gl || !linked) return;
      gl.useProgram(linked);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const at = gl.getAttribLocation(linked, 'p');
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      texture(gl, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      texture(gl, 1);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, 1, image.naturalHeight, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, rowEdges(image));
      gl.uniform1i(gl.getUniformLocation(linked, 'tex'), 0);
      gl.uniform1i(gl.getUniformLocation(linked, 'rows'), 1);
      const rect = gl.getUniformLocation(linked, 'rect'), turnAt = gl.getUniformLocation(linked, 'turn'), glintAt = gl.getUniformLocation(linked, 'glint');

      let width = 0, height = 0, turn = 0, light = .5, drawnTurn = NaN, drawnLight = NaN, drawnAt = 0;
      function fit() {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        width = Math.max(1, Math.round(node!.clientWidth * ratio));
        height = Math.max(1, Math.round(node!.clientHeight * ratio));
        if (node!.width === width && node!.height === height) return false;
        node!.width = width;
        node!.height = height;
        // Like object-fit: contain — the photo as large as it fits, centred.
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const across = image.naturalWidth * scale / width, down = image.naturalHeight * scale / height;
        gl!.viewport(0, 0, width, height);
        gl!.uniform4f(rect, (1 - across) / 2, (1 - down) / 2, across, down);
        return true;
      }
      function tick(time: number) {
        if (stopped) return;
        const goal = pose!();
        turn += (Math.max(-1, Math.min(1, goal.turn)) - turn) * .2;
        light += (goal.light - light) * .2;
        const moved = Math.max(Math.abs(turn - drawnTurn), Math.abs(light - drawnLight));
        // A fast lean is drawn every frame; the slow sway, about 30 times a second.
        if (fit() || !(moved < .02) || (moved > .001 && time - drawnAt > 30)) {
          gl!.clearColor(0, 0, 0, 0);
          gl!.clear(gl!.COLOR_BUFFER_BIT);
          gl!.uniform1f(turnAt, -turn * MAX_TURN);
          gl!.uniform1f(glintAt, -.45 + (light - .5) * 1.2);
          gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
          drawnTurn = turn;
          drawnLight = light;
          drawnAt = time;
        }
        frame = requestAnimationFrame(tick);
      }
      const first = pose!();
      turn = first.turn;
      light = first.light;
      frame = requestAnimationFrame(tick);
      setRound(true);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      node.removeEventListener('webglcontextlost', lost);
      // A closed view gives its context back at once: a browser keeps only a few, and the garbage collector is in no hurry.
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, pose]);

  // The photo stays under the canvas: its shadow is drawn once, and the canvas, the same shape, covers its face.
  return <>
    <Image src={src} width={320} height={480} sizes="320px" unoptimized alt="" draggable={false} />
    {pose && <canvas ref={canvas} className="can-volume" hidden={!round} aria-hidden="true" />}
  </>;
}
