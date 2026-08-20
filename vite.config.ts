import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageMetadata from './package.json'

const [majorVersion, minorVersion] = packageMetadata.version.split('.')
const releaseLabel = 'V' + majorVersion + '.' + minorVersion + ' · ' + packageMetadata.releaseChannel

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
    __APP_RELEASE_LABEL__: JSON.stringify(releaseLabel),
  },
  build: {
    target: 'es2020',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})

