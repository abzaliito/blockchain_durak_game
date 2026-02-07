import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import styles from './Connect.module.css';

export default function Connect() {
  const { connect, isConnected } = useSocket();
  const [wallet, setWallet] = useState('');

  const handleConnect = () => {
    const address = wallet.trim() || `0x${Math.random().toString(16).slice(2, 42)}`;
    connect(address);
  };

  const generateRandomWallet = () => {
    setWallet(`0x${Math.random().toString(16).slice(2, 42)}`);
  };

  return (
    <div className={styles.connect}>
      <motion.div 
        className={styles.card}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        <div className={styles.logo}>🃏</div>
        <h1 className={styles.title}>Durak Online</h1>
        <p className={styles.subtitle}>The classic Russian card game</p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>⚔️</span>
            <span>Podkidnoy & Perevodnoy</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>👥</span>
            <span>2-6 Players</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>💎</span>
            <span>ETH Stakes</span>
          </div>
        </div>

        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Enter wallet address or leave empty"
              className={styles.input}
            />
            <button 
              type="button" 
              className={styles.randomBtn}
              onClick={generateRandomWallet}
              title="Generate random"
            >
              🎲
            </button>
          </div>

          <motion.button
            className={styles.connectBtn}
            onClick={handleConnect}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Enter Game
          </motion.button>
        </div>

        <p className={styles.hint}>
          For testing, you can use any address or generate random
        </p>
      </motion.div>

      <div className={styles.background}>
        {['♠', '♥', '♦', '♣'].map((suit, i) => (
          <motion.span
            key={suit}
            className={styles.floatingSuit}
            style={{ 
              left: `${20 + i * 20}%`,
              color: suit === '♥' || suit === '♦' ? '#dc2626' : '#64748b'
            }}
            animate={{ 
              y: [0, -30, 0],
              rotate: [0, 10, -10, 0],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5
            }}
          >
            {suit}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
