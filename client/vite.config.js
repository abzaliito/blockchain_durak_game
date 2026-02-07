import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')
  
  return {
    plugins: [react()],
    define: {
      __CHIPS_ADDRESS__: JSON.stringify(env.CHIPS_ADDRESS),
      __XP_ADDRESS__: JSON.stringify(env.XP_ADDRESS),
      __LOBBY_ADDRESS__: JSON.stringify(env.LOBBY_ADDRESS),
      __RPC_URL__: JSON.stringify(env.RPC_URL || 'http://127.0.0.1:8545'),
      __CHAIN_ID__: JSON.stringify(env.CHAIN_ID || '31337'),
    }
  }
})
