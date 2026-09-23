// Silent WebGL capability probe. Returns a plain object or null and never
// logs: on a machine without WebGL the console must stay clean.

export function probeWebGL({ allowSoftware = false } = {}) {
  // Feature-detect before creating anything, so a browser with WebGL disabled
  // by policy returns here without touching a canvas.
  if (typeof WebGLRenderingContext === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const attrs = {
    // A software rasteriser reports as unsupported, so the Canvas 2D tier takes
    // over. Canvas 2D is faster than emulated WebGL. (allowSoftware exists only
    // for QA screenshots of tier 1 on GPU-less machines, via ?tier=1.)
    failIfMajorPerformanceCaveat: !allowSoftware,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
  };

  let gl = null;
  try {
    // getContext can throw, not only return null.
    gl = canvas.getContext('webgl', attrs);
  } catch {
    return null;
  }
  if (!gl) return null;

  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  let renderer = '';
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
  } catch { /* informational only */ }

  // Release the probe context immediately: browsers cap live contexts, and a
  // leaked probe silently kills a later one.
  try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ }

  const soft = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  const tier = (soft && !allowSoftware) || maxTexture < 2048 ? 'low' : 'ok';
  return { maxTexture, renderer, tier };
}
