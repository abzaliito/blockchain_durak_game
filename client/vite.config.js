import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd() + '/..', '')
  
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_CHIPS_ADDRESS': JSON.stringify(process.env.CHIPS_ADDRESS || fileEnv.CHIPS_ADDRESS || ''),
      'import.meta.env.VITE_XP_ADDRESS': JSON.stringify(process.env.XP_ADDRESS || fileEnv.XP_ADDRESS || ''),
      'import.meta.env.VITE_LOBBY_ADDRESS': JSON.stringify(process.env.LOBBY_ADDRESS || fileEnv.LOBBY_ADDRESS || ''),
      'import.meta.env.VITE_RPC_URL': JSON.stringify(process.env.RPC_URL || fileEnv.RPC_URL || 'http://127.0.0.1:8545'),
      'import.meta.env.VITE_CHAIN_ID': JSON.stringify(process.env.CHAIN_ID || fileEnv.CHAIN_ID || '31337'),
    },
    server: {
      port: 5173,
      host: true,
    }
  }
})
