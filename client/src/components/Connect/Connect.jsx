import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { useWeb3 } from '../../context/Web3Context';
import styles from './Connect.module.css';

export default function Connect() {
  const { connect } = useSocket();
  const { 
    address, 
    isConnected, 
    isConnecting, 
    error, 
    connectWallet, 
    claimFreeChips,
    chipsBalance,
    xpBalance,
    hasClaimed,
    clearError,
    isMetaMaskAvailable 
  } = useWeb3();
  
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Auto-claim chips when connected and not yet claimed
  useEffect(() => {
    const autoClaim = async () => {
      if (isConnected && !hasClaimed && !isClaiming && chipsBalance === '0') {
        setIsClaiming(true);
        const success = await claimFreeChips();
        if (success) {
          setClaimSuccess(true);
        }
        setIsClaiming(false);
      }
    };
    
    autoClaim();
  }, [isConnected, hasClaimed, chipsBalance, claimFreeChips, isClaiming]);

  const handleConnect = async () => {
    clearError();
    const walletAddress = await connectWallet();
    if (walletAddress) {
      // Connection successful, chips will be claimed automatically
    }
  };

  const handleEnterGame = () => {
    if (address) {
      connect(address);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (balance) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    return num.toFixed(0);
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
            <span>100 Free Chips</span>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {claimSuccess && (
          <motion.div 
            className={styles.success}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            🎉 100 DRC credited to your wallet!
          </motion.div>
        )}

        {!isConnected ? (
          <div className={styles.form}>
            <motion.button
              className={styles.connectBtn}
              onClick={handleConnect}
              disabled={isConnecting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isConnecting ? (
                <span className={styles.loading}>Connecting...</span>
              ) : (
                <>
                  <span className={styles.metamaskIcon}>🦊</span>
                  Connect MetaMask
                </>
              )}
            </motion.button>

            {!isMetaMaskAvailable && (
              <p className={styles.hint}>
                MetaMask not detected. Install the extension or open in MetaMask mobile browser.
              </p>
            )}
          </div>
        ) : (
          <div className={styles.walletInfo}>
            <div className={styles.addressBox}>
              <span className={styles.addressLabel}>Connected</span>
              <span className={styles.address}>{formatAddress(address)}</span>
            </div>

            <div className={styles.balances}>
              <div className={styles.balanceItem}>
                <span className={styles.balanceIcon}>💰</span>
                <span className={styles.balanceValue}>{formatBalance(chipsBalance)}</span>
                <span className={styles.balanceLabel}>DRC</span>
              </div>
              <div className={styles.balanceItem}>
                <span className={styles.balanceIcon}>⭐</span>
                <span className={styles.balanceValue}>{formatBalance(xpBalance)}</span>
                <span className={styles.balanceLabel}>XP</span>
              </div>
            </div>

            {isClaiming && (
              <div className={styles.claiming}>
                Claiming free chips...
              </div>
            )}

            <motion.button
              className={styles.enterBtn}
              onClick={handleEnterGame}
              disabled={isClaiming || parseFloat(chipsBalance) === 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isClaiming ? 'Getting chips...' : 'Enter Game'}
            </motion.button>
          </div>
        )}
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
