/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tg: {
          bg:          'var(--tg-bg)',
          secondary:   'var(--tg-secondary)',
          text:        'var(--tg-text)',
          hint:        'var(--tg-hint)',
          link:        'var(--tg-link)',
          button:      'var(--tg-button)',
          'button-text':'var(--tg-button-text)',
          header:      'var(--tg-header)',
          accent:      'var(--tg-accent)',
          success:     'var(--tg-success)',
          warning:     'var(--tg-warning)',
          danger:      'var(--tg-danger)',
          border:      'var(--tg-border)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'skeleton':   'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.6' } },
        skeleton:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      borderRadius: { xl: '1rem', '2xl': '1.25rem', '3xl': '1.5rem' },
    },
  },
  plugins: [],
}
