import { SocketProvider, useSocket } from './context/SocketContext';
import { Web3Provider } from './context/Web3Context';
import Connect from './components/Connect/Connect';
import Lobby from './components/Lobby/Lobby';
import GameBoard from './components/Game/GameBoard';
import { motion } from 'framer-motion';
import './App.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <motion.div
        className="loading-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div 
          className="loading-icon"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          🃏
        </motion.div>
        <p>Reconnecting...</p>
      </motion.div>
    </div>
  );
}

function AppContent() {
  const { isConnected: isSocketConnected, currentTable, socket } = useSocket();

  const hasSession = localStorage.getItem('durak_session');
  
  // Show loading if trying to reconnect
  if (!isSocketConnected && hasSession && socket === null) {
    return <LoadingScreen />;
  }

  // Show Connect screen if not connected to socket
  if (!isSocketConnected) {
    return <Connect />;
  }

  if (currentTable) {
    return <GameBoard />;
  }

  return <Lobby />;
}

function BackgroundSuits() {
  return (
    <div className="bg-suits">
      <span className="bg-suit">♥</span>
      <span className="bg-suit">♠</span>
      <span className="bg-suit">♦</span>
      <span className="bg-suit">♣</span>
      <span className="bg-suit">♥</span>
      <span className="bg-suit">♠</span>
      <span className="bg-suit">♦</span>
      <span className="bg-suit">♣</span>
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <SocketProvider>
        <BackgroundSuits />
        <AppContent />
      </SocketProvider>
    </Web3Provider>
  );
}

export default App;
