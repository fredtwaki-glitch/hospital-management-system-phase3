import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175, // platform admin - 5173/5174 already used by staff console / patient portal
  },
});
