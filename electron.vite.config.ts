import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        // node-pty est un module natif optionnel : jamais bundlé, toujours
        // requis depuis node_modules au runtime (et tolérant à son absence).
        external: ['node-pty'],
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    build: {
      // Découpe le bundle en chunks logiques (au lieu d'un seul gros fichier) :
      // les libs tierces changent rarement → meilleur cache, build plus lisible.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') },
        output: {
          // Code applicatif dans « index » ; les libs tierces réparties en
          // chunks stables (xterm et lucide isolés car volumineux, le reste
          // — react, zustand, virtualiseur, panneaux — dans « vendor »).
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('@xterm')) return 'xterm'
            if (id.includes('lucide-react')) return 'icons'
            return 'vendor'
          }
        }
      }
    }
  }
})
