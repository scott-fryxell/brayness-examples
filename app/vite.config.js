import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative base so the build works from any folder, including /s/<id>/.
export default defineConfig({ base: './', plugins: [vue()] })
