import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-black': '#121212',
        'content-bg': '#1E1E1E',
        'hot-pink': '#FF007A',
        'primary-text': '#FFFFFF',
        'secondary-text': '#A0A0A0',
        'success': '#34C759',
        'error': '#FF3B30',
      },
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
