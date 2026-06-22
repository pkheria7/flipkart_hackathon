/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          dusk: 'var(--civic-dusk)',
          ivory: 'var(--civic-ivory)',
          mist: 'var(--civic-mist)',
          navy: 'var(--civic-navy)',
          ink: 'var(--civic-ink)',
          graphite: 'var(--civic-graphite)',
          white: 'var(--civic-white)',
        },
        btp: {
          blue: 'var(--btp-blue)',
          signal: 'var(--btp-signal)',
          cyan: 'var(--btp-cyan)',
        },
        status: {
          structural: 'var(--status-structural)',
          amber: 'var(--status-amber)',
          route: 'var(--status-route)',
          seasonal: 'var(--status-seasonal)',
          cleared: 'var(--status-cleared)',
          pending: 'var(--status-amber)',
          approved: 'var(--btp-signal)',
          dispatched: 'var(--btp-cyan)',
          recurrence: 'var(--status-seasonal)',
          responsive: 'var(--btp-cyan)',
        },
        glass: {
          white: 'var(--glass-white-bg)',
          navy: 'var(--glass-navy-bg)',
        },
        glow: {
          blue: 'var(--color-glow)',
          amber: 'rgba(245, 158, 11, 0.35)',
          red: 'rgba(214, 40, 40, 0.32)',
        },
        border: {
          civic: 'var(--glass-border)',
        },
        theme: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          primary: 'var(--color-primary)',
          accent: 'var(--color-accent)',
          text: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
        shell: {
          DEFAULT: 'var(--shell-fg)',
          muted: 'var(--shell-fg-muted)',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        glass: 'var(--shadow-glass)',
        command: 'var(--shadow-command)',
        'glow-cyan': 'var(--shadow-glow-cyan)',
        'glow-amber': 'var(--shadow-glow-amber)',
        'glow-red': 'var(--shadow-glow-red)',
        panel: '0 2px 12px rgba(11, 58, 111, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'civic-gradient': 'linear-gradient(180deg, #F7F2E8 0%, #EAF3F8 100%)',
        'command-gradient': 'linear-gradient(135deg, #08111F 0%, #0B3A6F 100%)',
        'dusk-gradient':
          'radial-gradient(ellipse 70% 55% at 12% -5%, rgba(34,211,238,0.12), transparent 60%), radial-gradient(ellipse 65% 55% at 88% 8%, rgba(11,58,111,0.45), transparent 62%), radial-gradient(ellipse 90% 60% at 50% 108%, rgba(20,108,148,0.16), transparent 70%), linear-gradient(180deg, #06111F 0%, #08111F 48%, #0B1F33 100%)',
        'grid-map':
          'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%230B3A6F\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z\'/%3E%3C/g%3E%3C/svg%3E")',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'route-beam': 'routeBeam 4s ease-in-out infinite',
        'aurora-drift': 'auroraDrift 18s ease-in-out infinite',
        'float-slow': 'floatSlow 7s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3.5s ease-in-out infinite',
      },
      keyframes: {
        routeBeam: {
          '0%, 100%': { strokeDashoffset: '200' },
          '50%': { strokeDashoffset: '0' },
        },
        auroraDrift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.55' },
          '50%': { transform: 'translate3d(4%, -3%, 0) scale(1.12)', opacity: '0.8' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
