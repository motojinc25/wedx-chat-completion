import path from "path"
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'

// Port configuration from environment variables
const FRONTEND_PORT = Number(process.env.VITE_FRONTEND_PORT) || 5173
const BACKEND_PORT = Number(process.env.VITE_BACKEND_PORT) || 8000

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __APP_MODE__: JSON.stringify(process.env.VITE_APP_MODE || 'development'),
  },
  server: {
    port: FRONTEND_PORT,
    host: '127.0.0.1', // Bind to localhost only for security
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
        // Add security headers to proxy requests
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Remove sensitive headers from proxy requests
            proxyReq.removeHeader('x-forwarded-host')
            proxyReq.removeHeader('x-forwarded-proto')

            // Add security headers
            proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest')
            proxyReq.setHeader('Cache-Control', 'no-cache')
          })
        },
      },
    },
    // Security headers for dev server
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/shared/components/ui/',
        'dist/',
      ],
    },
  },
})
