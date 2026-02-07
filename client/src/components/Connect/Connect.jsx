import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { useWeb3 } from '../../context/Web3Context';
import styles from './Connect.module.css';

export default function Connect() {
  const { connect } = useSocket();
  const { connectWallet, address, chipsBalance, isConnecting, error, buyChips } = useWeb3();
  const [buyAmount, setBuyAmount] = useState('0.01');
  const [isBuying, setIsBuying] = useState(false);

  const handleConnectMetaMask = async () => {
    const walletAddress = await connectWallet();
    if (walletAddress) {
      connect(walletAddress);
    }
  };

  const handleBuyChips = async () => {
    setIsBuying(true);
    await buyChips(buyAmount);
    setIsBuying(false);
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
            <span>Blockchain Stakes</span>
          </div>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {!address ? (
          <motion.button
            className={styles.connectBtn}
            onClick={handleConnectMetaMask}
            disabled={isConnecting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isConnecting ? 'Connecting...' : '🦊 Connect MetaMask'}
          </motion.button>
        ) : (
          <div className={styles.walletInfo}>
            <div className={styles.addressDisplay}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
            
            <div className={styles.balances}>
              <div className={styles.balance}>
                <span className={styles.balanceLabel}>Chips</span>
                <span className={styles.balanceValue}>{parseFloat(chipsBalance).toFixed(0)} DRC</span>
              </div>
            </div>

            <div className={styles.buySection}>
              <div className={styles.buyInput}>
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  step="0.01"
                  min="0.001"
                  className={styles.input}
                />
                <span className={styles.inputSuffix}>ETH</span>
              </div>
              <button 
                className={styles.buyBtn}
                onClick={handleBuyChips}
                disabled={isBuying}
              >
                {isBuying ? '...' : 'Buy Chips'}
              </button>
            </div>

            <motion.button
              className={styles.playBtn}
              onClick={() => connect(address)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Play Now
            </motion.button>
          </div>
        )}

        <p className={styles.hint}>
          Connect MetaMask to play with real stakes
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
