import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WebApp from '@twa-dev/sdk'
import App from './App'
import './index.css'

// Initialise Telegram WebApp
WebApp.ready()
WebApp.expand()

// Apply Telegram theme to CSS variables
function applyTgTheme() {
  const p = WebApp.themeParams
  const root = document.documentElement.style
  if (p.bg_color)           root.setProperty('--tg-bg',           p.bg_color)
  if (p.secondary_bg_color) root.setProperty('--tg-secondary',    p.secondary_bg_color)
  if (p.text_color)         root.setProperty('--tg-text',         p.text_color)
  if (p.hint_color)         root.setProperty('--tg-hint',         p.hint_color)
  if (p.link_color)         root.setProperty('--tg-link',         p.link_color)
  if (p.button_color)       root.setProperty('--tg-button',       p.button_color)
  if (p.button_text_color)  root.setProperty('--tg-button-text',  p.button_text_color)
  if (p.header_bg_color)    root.setProperty('--tg-header',       p.header_bg_color)
  if (p.accent_text_color)  root.setProperty('--tg-accent',       p.accent_text_color)
  if (p.section_bg_color)   root.setProperty('--tg-bg',           p.section_bg_color)
  // Derived
  root.setProperty('--tg-border',  p.hint_color ? p.hint_color + '30' : '#e5e5e5')
  root.setProperty('--tg-success', '#4cd964')
  root.setProperty('--tg-warning', '#ff9500')
  root.setProperty('--tg-danger',  '#ff3b30')
}

applyTgTheme()
WebApp.onEvent('themeChanged', applyTgTheme)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,       // cache is fresh for 30s
      refetchOnWindowFocus: true,
      // No global refetchInterval — only queries that need it set it explicitly
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
