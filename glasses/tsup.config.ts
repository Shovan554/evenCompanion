import { defineConfig } from 'tsup'

// The output runs inside the Even App WebView, which has no module resolver or
// node_modules. So we must INLINE the SDK (and anything else) into a single
// browser bundle — by default tsup marks `dependencies` external, which would
// leave a bare `import ... from "@evenrealities/even_hub_sdk"` that the WebView
// cannot resolve. `noExternal` forces it to be bundled in.
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'es2020',
  platform: 'browser',
  noExternal: [/@evenrealities\//],
  clean: true,
  outDir: 'dist',
  // Copy the WebView HTML entry alongside the bundle after a successful build.
  onSuccess: 'cp index.html dist/index.html',
})
