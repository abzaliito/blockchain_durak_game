import { motion, AnimatePresence } from 'framer-motion';
import Card from '../Card/Card';
import { getCardId } from '../../utils/cardUtils';
import styles from './Hand.module.css';

export default function Hand({ cards, isInteractive = true }) {
  const cardCount = cards.length;
  const maxSpread = Math.min(cardCount * 45, 500);
  const cardWidth = 80;

  const getCardPosition = (index, total) => {
    const spread = Math.min(total * 45, 500);
    const offset = total > 1 ? (index / (total - 1)) * spread : spread / 2;
    const rotation = total > 1 ? ((index / (total - 1)) - 0.5) * 20 : 0;
    const lift = Math.abs(rotation) * 0.5;
    return { offset, rotation, lift };
  };
  
  return (
    <motion.div 
      className={styles.hand}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <div className={styles.cardsContainer} style={{ width: maxSpread + cardWidth }}>
        <AnimatePresence>
          {cards.map((card, index) => {
            const { offset, rotation, lift } = getCardPosition(index, cardCount);
            
            return (
              <motion.div
                key={getCardId(card)}
                className={styles.cardWrapper}
                initial={{ 
                  x: -500,
                  y: -300,
                  rotate: -180,
                  scale: 0.5,
                  opacity: 0
                }}
                animate={{ 
                  x: 0,
                  y: 0,
                  rotate: rotation,
                  scale: 1,
                  opacity: 1,
                  left: offset,
                  bottom: lift
                }}
                exit={{
                  y: -100,
                  opacity: 0,
                  scale: 0.8,
                  transition: { duration: 0.2 }
                }}
                transition={{ 
                  type: 'spring',
                  stiffness: 100,
                  damping: 15,
                  delay: index * 0.05
                }}
                style={{ zIndex: index }}
              >
                <Card card={card} isDraggable={isInteractive} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
