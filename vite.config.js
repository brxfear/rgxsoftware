import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Yerel geliştirmede /api/* isteklerini api/ klasöründeki Vercel fonksiyonlarına yönlendirir.
// Canlıda (Vercel) bu eklenti kullanılmaz; fonksiyonları Vercel kendisi çalıştırır.
const vercelApiDev = (env) => ({
  name: 'vercel-api-dev',
  apply: 'serve',
  configureServer(server) {
    // Sunucu tarafı env değişkenleri (.env) — VITE_ öneki olmayanlar dahil
    for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v
    if (!process.env.SITE_URL) process.env.SITE_URL = 'http://localhost:5173'

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://localhost')
      const match = url.pathname.match(/^\/api\/([a-z0-9-]+)\/?$/i)
      if (!match) return next()

      let mod
      try {
        mod = await server.ssrLoadModule(`/api/${match[1]}.js`)
      } catch {
        res.statusCode = 404
        return res.end('Not found')
      }

      req.query = Object.fromEntries(url.searchParams)
      const type = req.headers['content-type'] || ''
      const wantsRaw = mod.config?.api?.bodyParser === false
      if (!wantsRaw && req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString('utf8')
        if (type.includes('application/json')) {
          try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = raw }
        } else if (type.includes('application/x-www-form-urlencoded')) {
          req.body = Object.fromEntries(new URLSearchParams(raw))
        } else {
          req.body = raw
        }
      }

      res.status = (code) => { res.statusCode = code; return res }
      res.json = (data) => {
        if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(data))
        return res
      }
      res.send = (data) => {
        if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) return res.json(data)
        res.end(data)
        return res
      }

      try {
        await mod.default(req, res)
      } catch (err) {
        console.error(`[api/${match[1]}]`, err)
        if (!res.headersSent) res.status(500).json({ error: 'Sunucu hatası (yerel).' })
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), vercelApiDev(env)],
  }
})
