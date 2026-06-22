export type CapabilityReport = {
  webgpu: boolean;
  wasm: boolean;
  simd: boolean;
  threads: boolean;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  userAgent: string;
};

type NavigatorWithMemory = Navigator & { deviceMemory?: number; gpu?: unknown };

const SIMD_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00,
  0x01, 0x7b, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0c,
  0x00, 0x00, 0x00, 0x00, 0x0b
]);

export function detectCapabilities(): CapabilityReport {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      webgpu: false,
      wasm: false,
      simd: false,
      threads: false,
      hardwareConcurrency: 0,
      deviceMemory: null,
      screen: { width: 0, height: 0, colorDepth: 0, pixelRatio: 1 },
      userAgent: 'server'
    };
  }

  const nav = navigator as NavigatorWithMemory;
  const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function';
  let simd = false;

  if (hasWasm) {
    try {
      simd = WebAssembly.validate(SIMD_PROBE);
    } catch {
      simd = false;
    }
  }

  return {
    webgpu: 'gpu' in nav,
    wasm: hasWasm,
    simd,
    threads: typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated === true,
    hardwareConcurrency: nav.hardwareConcurrency ?? 0,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1
    },
    userAgent: nav.userAgent
  };
}
