import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Заявки уходят в систему управления (проект aquastone-managment): запросы /api проксируются на её сервер.
// Адрес сервера — переменная MANAGEMENT_API_URL в .env (по умолчанию http://127.0.0.1:3001).
// Если менеджер или директор вошёл в систему управления в этом же браузере (тот же хост, например localhost),
// конструктор узнаёт его по сессии и отправляет заявку без формы контактов.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.MANAGEMENT_API_URL || 'http://127.0.0.1:3001'
  const proxy = { '/api': { target, changeOrigin: true, xfwd: true } }
  return {
    // На рабочем сервере конструктор открывается по адресу /constructor/ (см. aquastone-managment/DEPLOY.md):
    // собирайте его командой  CONSTRUCTOR_BASE=/constructor/ npm run build  (в Windows PowerShell: $env:CONSTRUCTOR_BASE='/constructor/'; npm run build).
    base: env.CONSTRUCTOR_BASE || '/',
    // Демо для GitHub Pages: VITE_LOCAL_CALC=true — расчёт в браузере (src/calc). В обычной сборке — false,
    // и код с ценами вырезается из сборки.
    define: { __LOCAL_CALC__: JSON.stringify(env.VITE_LOCAL_CALC === 'true') },
    plugins: [react()],
    server: { port: 5174, proxy },
    preview: { port: 4174, proxy },
  }
})
