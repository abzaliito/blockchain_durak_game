import { SocketProvider, useSocket } from './context/SocketContext';
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
  const { isConnected, currentTable, socket } = useSocket();

  const hasSession = localStorage.getItem('durak_session');
  
  if (!isConnected && hasSession && socket === null) {
    return <LoadingScreen />;
  }

  if (!isConnected) {
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
    <SocketProvider>
      <BackgroundSuits />
      <AppContent />
    </SocketProvider>
  );
}

export default App;
