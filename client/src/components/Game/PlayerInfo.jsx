import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CardBack from '../Card/CardBack';
import styles from './PlayerInfo.module.css';

export default function PlayerInfo({ player, isAttacker, isDefender, isCurrentTurn, isYou, position, turnTimer, turnTimeout }) {
  const shortWallet = player.walletAddress.slice(0, 6) + '...' + player.walletAddress.slice(-4);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!isCurrentTurn || !turnTimer || !turnTimeout) {
      setProgress(1);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - turnTimer;
      const remaining = Math.max(0, turnTimeout - elapsed);
      setProgress(remaining / turnTimeout);
    }, 50);

    return () => clearInterval(interval);
  }, [isCurrentTurn, turnTimer, turnTimeout]);
  
  return (
    <motion.div 
      className={`${styles.playerInfo} ${styles[position]} ${isYou ? styles.you : ''} ${isCurrentTurn ? styles.activeTurn : ''}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      style={isCurrentTurn ? { '--timer-progress': progress } : {}}
    >
      <div className={styles.avatar}>
        {isYou ? '👤' : '🎭'}
      </div>
      
      <div className={styles.details}>
        <div className={styles.name}>
          {shortWallet}
          {isYou && <span className={styles.youBadge}>You</span>}
        </div>
        
        <div className={styles.status}>
          {isAttacker && <span className={styles.attackerBadge}>⚔️ Attacker</span>}
          {isDefender && <span className={styles.defenderBadge}>🛡️ Defender</span>}
          {player.isOut && <span className={styles.outBadge}>✅ #{player.finishPosition}</span>}
        </div>
      </div>
      
      {!player.isOut && (
        <div className={styles.cards}>
          <CardBack isSmall count={player.cardsCount} />
          <span className={styles.cardCount}>{player.cardsCount}</span>
        </div>
      )}
    </motion.div>
  );
}
