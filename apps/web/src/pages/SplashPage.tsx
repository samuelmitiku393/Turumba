import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import WebApp from '@twa-dev/sdk'
import { authApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

export default function SplashPage() {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated, token } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isAuthenticated && token) {
      navigate('/dashboard', { replace: true })
      return
    }

    async function login() {
      try {
        const initData = WebApp.initData
        if (!initData) {
          // Dev fallback: allow bypass via URL param ?dev=1
          if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1') {
            setErrorMsg('Dev mode: open inside Telegram or use a real initData.')
            setStatus('error')
            return
          }
          setErrorMsg('Please open this app inside Telegram.')
          setStatus('error')
          return
        }
        const { user, token } = await authApi.login(initData)
        setAuth(user, token)
        navigate('/dashboard', { replace: true })
      } catch (err: unknown) {
        console.error(err)
        const msg = err instanceof Error ? err.message : 'Authentication failed'
        setErrorMsg(msg)
        setStatus('error')
      }
    }

    login()
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg, var(--tg-bg) 0%, var(--tg-secondary) 100%)' }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo */}
        <motion.div
          className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{ background: 'var(--tg-button)' }}
          animate={{ rotate: status === 'loading' ? [0, 5, -5, 0] : 0 }}
          transition={{ repeat: status === 'loading' ? Infinity : 0, duration: 3, ease: 'easeInOut' }}
        >
          <span className="text-4xl">📢</span>
        </motion.div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--tg-text)] mb-1">Turumba</h1>
          <p className="text-sm text-[var(--tg-hint)]">Marketing Ad Manager</p>
        </div>

        {status === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--tg-button)' }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </div>
            <p className="text-xs text-[var(--tg-hint)]">Authenticating…</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 text-center max-w-xs"
          >
            <p className="text-sm text-red-500 font-medium mb-2">⚠️ Authentication Failed</p>
            <p className="text-xs text-[var(--tg-hint)]">{errorMsg}</p>
            <button
              onClick={() => { setStatus('loading'); window.location.reload() }}
              className="btn-primary mt-4 w-full"
            >
              Retry
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
