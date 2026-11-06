import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { superadminDeleteEscola } from './scripts/superadmin-delete-escola-core.mjs'
import { getSuperAdminUsageStats } from './scripts/superadmin-usage-stats-core.mjs'

/**
 * Dev-only API: eliminates school + responsável auth accounts.
 * Production should rely on migration 20261102_delete_escola_with_responsavel.sql
 * and/or the Edge Function superadmin-delete-escola.
 */
function superadminDeleteEscolaApi(): Plugin {
    return {
        name: 'superadmin-delete-escola-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.method === 'OPTIONS' && req.url?.startsWith('/api/superadmin-delete-escola')) {
                    res.statusCode = 204
                    res.setHeader('Access-Control-Allow-Origin', '*')
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
                    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
                    res.end()
                    return
                }

                if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/superadmin-delete-escola') {
                    next()
                    return
                }

                try {
                    const env = loadEnv(server.config.mode, server.config.root, '')
                    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
                    const serviceKey =
                        env.SUPABASE_SECRET_KEY ||
                        env.SUPABASE_SERVICE_ROLE_KEY ||
                        process.env.SUPABASE_SECRET_KEY ||
                        process.env.SUPABASE_SERVICE_ROLE_KEY ||
                        ''
                    const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

                    const chunks: Uint8Array[] = []
                    for await (const chunk of req) {
                        chunks.push(chunk instanceof Uint8Array ? chunk : new TextEncoder().encode(String(chunk)))
                    }
                    const total = chunks.reduce((n, c) => n + c.length, 0)
                    const merged = new Uint8Array(total)
                    let offset = 0
                    for (const c of chunks) {
                        merged.set(c, offset)
                        offset += c.length
                    }
                    const body = JSON.parse(new TextDecoder().decode(merged) || '{}')
                    const authHeader = String(req.headers.authorization || '')
                    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()

                    if (!url || !serviceKey) {
                        res.statusCode = 500
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ success: false, error: 'Server misconfigured (missing Supabase secrets)' }))
                        return
                    }
                    if (!accessToken) {
                        res.statusCode = 401
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ success: false, error: 'Não autenticado' }))
                        return
                    }

                    const result = await superadminDeleteEscola({
                        url,
                        serviceKey,
                        anonKey,
                        accessToken,
                        escolaId: String(body.escola_id || ''),
                        motivo: String(body.motivo || ''),
                        createBackup: body.create_backup !== false,
                    })

                    res.statusCode = result.status || (result.success ? 200 : 500)
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(result))
                } catch (err) {
                    res.statusCode = 500
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({
                        success: false,
                        error: err instanceof Error ? err.message : String(err),
                    }))
                }
            })
        },
    }
}

/**
 * Dev-only API: estatísticas de utilização SUPERADMIN (service role).
 * Produção: aplicar supabase/migrations/20261106_superadmin_system_usage_stats.sql
 */
function superadminUsageStatsApi(): Plugin {
    return {
        name: 'superadmin-usage-stats-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.method === 'OPTIONS' && req.url?.startsWith('/api/superadmin-usage-stats')) {
                    res.statusCode = 204
                    res.setHeader('Access-Control-Allow-Origin', '*')
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
                    res.end()
                    return
                }

                const pathOnly = req.url?.split('?')[0]
                if (
                    (req.method !== 'GET' && req.method !== 'POST') ||
                    pathOnly !== '/api/superadmin-usage-stats'
                ) {
                    next()
                    return
                }

                try {
                    const env = loadEnv(server.config.mode, server.config.root, '')
                    const url =
                        env.SUPABASE_URL ||
                        env.VITE_SUPABASE_URL ||
                        process.env.SUPABASE_URL ||
                        process.env.VITE_SUPABASE_URL ||
                        ''
                    const serviceKey =
                        env.SUPABASE_SECRET_KEY ||
                        env.SUPABASE_SERVICE_ROLE_KEY ||
                        process.env.SUPABASE_SECRET_KEY ||
                        process.env.SUPABASE_SERVICE_ROLE_KEY ||
                        ''
                    const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
                    const authHeader = String(req.headers.authorization || '')
                    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()

                    let diasActividade = 14
                    let limiteEscolas = 200
                    if (req.method === 'POST') {
                        const chunks: Uint8Array[] = []
                        for await (const chunk of req) {
                            chunks.push(
                                chunk instanceof Uint8Array
                                    ? chunk
                                    : new TextEncoder().encode(String(chunk)),
                            )
                        }
                        const total = chunks.reduce((n, c) => n + c.length, 0)
                        const merged = new Uint8Array(total)
                        let offset = 0
                        for (const c of chunks) {
                            merged.set(c, offset)
                            offset += c.length
                        }
                        const body = JSON.parse(new TextDecoder().decode(merged) || '{}')
                        diasActividade = Number(body.dias_actividade) || 14
                        limiteEscolas = Number(body.limite_escolas) || 200
                    } else {
                        const q = new URL(req.url || '', 'http://localhost').searchParams
                        diasActividade = Number(q.get('dias_actividade')) || 14
                        limiteEscolas = Number(q.get('limite_escolas')) || 200
                    }

                    if (!url || !serviceKey) {
                        res.statusCode = 500
                        res.setHeader('Content-Type', 'application/json')
                        res.end(
                            JSON.stringify({
                                success: false,
                                error: 'Server misconfigured (missing Supabase secrets)',
                            }),
                        )
                        return
                    }

                    const result = await getSuperAdminUsageStats({
                        url,
                        serviceKey,
                        anonKey,
                        accessToken,
                        diasActividade,
                        limiteEscolas,
                    })

                    res.statusCode = result.status || (result.success ? 200 : 500)
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(result))
                } catch (err) {
                    res.statusCode = 500
                    res.setHeader('Content-Type', 'application/json')
                    res.end(
                        JSON.stringify({
                            success: false,
                            error: err instanceof Error ? err.message : String(err),
                        }),
                    )
                }
            })
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        superadminDeleteEscolaApi(),
        superadminUsageStatsApi(),
        VitePWA({
            registerType: 'prompt',
            injectRegister: 'auto',
            includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png', 'favicon.png'],
            manifest: {
                name: 'EduGest Angola',
                short_name: 'EduGest',
                description: 'Sistema de Gestão Escolar para Professores Angolanos',
                theme_color: '#2563eb',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 ano
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        })
    ],
    server: {
        port: 3000,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        // Optimize chunk splitting for better caching
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks - cached separately from app code
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-supabase': ['@supabase/supabase-js'],
                    'vendor-charts': ['recharts'],
                    'vendor-pdf': ['jspdf', 'jspdf-autotable'],
                    'vendor-utils': ['date-fns', 'zustand', 'papaparse', 'xlsx', 'jszip'],
                }
            }
        },
        // Increase chunk size warning limit (we're intentionally splitting)
        chunkSizeWarningLimit: 500,
    },
})
