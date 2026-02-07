import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { SUIT_SYMBOLS, SUIT_COLORS, getCardId } from '../../utils/cardUtils';
import styles from './Card.module.css';

export default function Card({ card, isDraggable = true, isSmall = false, style = {}, isNew = false }) {
  const cardId = getCardId(card);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cardId,
    data: { card },
    disabled: !isDraggable
  });

  const dragStyle = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: 1000,
  } : {};

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <motion.div
      ref={setNodeRef}
      className={`${styles.card} ${isSmall ? styles.small : ''} ${isDragging ? styles.dragging : ''} ${isDraggable ? styles.draggable : ''} ${isRed ? styles.red : styles.black}`}
      style={{ ...style, ...dragStyle }}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      initial={isNew ? { scale: 0, rotateY: 180 } : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      whileHover={isDraggable ? { y: -10, scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' } : {}}
      whileTap={isDraggable ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className={styles.cardInner}>
        <div className={styles.shine} />
        
        <div className={`${styles.corner} ${styles.topLeft}`}>
          <span className={styles.rank} style={{ color: isRed ? SUIT_COLORS.hearts : SUIT_COLORS.clubs }}>
            {card.rank}
          </span>
          <span className={styles.suit} style={{ color: isRed ? SUIT_COLORS.hearts : SUIT_COLORS.clubs }}>
            {suitSymbol}
          </span>
        </div>
        
        <div className={styles.center}>
          <span style={{ color: isRed ? SUIT_COLORS.hearts : SUIT_COLORS.clubs, fontSize: isSmall ? '2rem' : '3rem' }}>
            {suitSymbol}
          </span>
        </div>
        
        <div className={`${styles.corner} ${styles.bottomRight}`}>
          <span className={styles.rank} style={{ color: isRed ? SUIT_COLORS.hearts : SUIT_COLORS.clubs }}>
            {card.rank}
          </span>
          <span className={styles.suit} style={{ color: isRed ? SUIT_COLORS.hearts : SUIT_COLORS.clubs }}>
            {suitSymbol}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
