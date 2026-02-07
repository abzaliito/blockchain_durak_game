import { motion, AnimatePresence } from 'framer-motion';
import Card from '../Card/Card';
import CardBack from '../Card/CardBack';
import { SUIT_SYMBOLS } from '../../utils/cardUtils';
import styles from './DeckInfo.module.css';

export default function DeckInfo({ deck, isDealing }) {
  const { cardsLeft, trumpCard, trumpSuit } = deck;
  const isRed = trumpSuit === 'hearts' || trumpSuit === 'diamonds';
  
  return (
    <motion.div 
      className={styles.deckInfo}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className={styles.trumpSection}>
        <div className={styles.label}>Trump</div>
        {trumpCard ? (
          <motion.div 
            className={styles.trumpCard}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          >
            <Card card={trumpCard} isDraggable={false} isSmall />
          </motion.div>
        ) : trumpSuit ? (
          <div className={styles.trumpSymbol}>
            <span style={{ color: isRed ? '#dc2626' : '#f8fafc' }}>
              {SUIT_SYMBOLS[trumpSuit]}
            </span>
          </div>
        ) : null}
      </div>
      
      <div className={styles.deckSection}>
        <div className={`${styles.deckStack} ${isDealing ? styles.dealing : ''}`}>
          <AnimatePresence>
            {cardsLeft > 0 && (
              <>
                <motion.div 
                  className={styles.deckCard} 
                  style={{ transform: 'rotate(-5deg)' }}
                  animate={isDealing ? { scale: [1, 0.95, 1] } : {}}
                  transition={{ repeat: isDealing ? Infinity : 0, duration: 0.3 }}
                >
                  <CardBack isSmall />
                </motion.div>
                {cardsLeft > 5 && (
                  <div className={styles.deckCard} style={{ transform: 'rotate(0deg)', marginLeft: '3px' }}>
                    <CardBack isSmall />
                  </div>
                )}
              </>
            )}
          </AnimatePresence>
          {cardsLeft === 0 && (
            <motion.div 
              className={styles.emptyDeck}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Empty
            </motion.div>
          )}
        </div>
        <motion.div 
          className={styles.deckCount}
          key={cardsLeft}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {cardsLeft} cards
        </motion.div>
      </div>
    </motion.div>
  );
}
