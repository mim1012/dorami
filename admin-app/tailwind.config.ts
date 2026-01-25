import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Custom Color Palette
      colors: {
        'primary-black': '#121212',
        'content-bg': '#1E1E1E',
        'hot-pink': '#FF007A',
        'primary-text': '#FFFFFF',
        'secondary-text': '#A0A0A0',
        'success': '#34C759',
        'error': '#FF3B30',
        'warning': '#FF9500',
        'info': '#5AC8FA',
      },

      // Typography
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'display': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'h1': ['22px', { lineHeight: '1.3', fontWeight: '700' }],
        'h2': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['14px', { lineHeight: '1.4', fontWeight: '500' }],
        'small': ['12px', { lineHeight: '1.3', fontWeight: '400' }],
      },

      // Border Radius
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'small': '4px',
        'input': '8px',
      },

      // Spacing (8px grid system)
      spacing: {
        '18': '4.5rem',  // 72px
        '22': '5.5rem',  // 88px
      },

      // Mobile-first Breakpoints
      screens: {
        'xs': '320px',   // Mobile (Small)
        'sm': '640px',   // Mobile (Large)
        'md': '768px',   // Tablet
        'lg': '1024px',  // Desktop
        'xl': '1280px',  // Desktop (Large)
        '2xl': '1536px', // Desktop (XL)
      },

      // Animation
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-hot-pink': 'pulseHotPink 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseHotPink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },

      // Box Shadow
      boxShadow: {
        'hot-pink': '0 0 20px rgba(255, 0, 122, 0.3)',
        'card': '0 4px 6px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 12px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
