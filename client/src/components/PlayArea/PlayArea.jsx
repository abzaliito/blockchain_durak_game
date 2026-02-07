import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../Card/Card';
import styles from './PlayArea.module.css';

function AttackSlot({ card, index, onDefend }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `defense-slot-${index}`,
    data: { type: 'defense', attackCard: card, index }
  });

  return (
    <div className={styles.cardPair}>
      <div className={styles.attackCard}>
        <Card card={card} isDraggable={false} isSmall />
      </div>
      <div 
        ref={setNodeRef}
        className={`${styles.defenseSlot} ${isOver ? styles.dropHover : ''}`}
      >
        {card.defendedBy ? (
          <Card card={card.defendedBy} isDraggable={false} isSmall />
        ) : (
          <div className={styles.emptySlot}>
            <span>Drop to defend</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayArea({ tableCards = [], isDefender, trumpSuit, gameMode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'attack-zone',
    data: { type: 'attack' }
  });

  const hasUndefended = tableCards.some(tc => !tc.defendedBy);
  const hasDefended = tableCards.some(tc => tc.defendedBy);
  const canTransfer = gameMode === 'perevodnoy' && isDefender && hasUndefended && !hasDefended;

  return (
    <div className={styles.playArea}>
      <div className={styles.tableInfo}>
        {tableCards.length === 0 ? (
          <span className={styles.hint}>Drag a card here to attack</span>
        ) : hasUndefended && isDefender ? (
          <span className={styles.hint}>
            {canTransfer ? 'Defend, transfer or take cards' : 'Defend or take cards'}
          </span>
        ) : null}
      </div>
      
      <div 
        ref={setNodeRef}
        className={`${styles.table} ${isOver ? styles.dropHover : ''}`}
      >
        <AnimatePresence>
          {tableCards.length === 0 ? (
            <motion.div 
              className={styles.emptyTable}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className={styles.dropZone}>
                <span>⚔️</span>
              </div>
            </motion.div>
          ) : (
            <div className={styles.cardPairs}>
              {tableCards.map((tc, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <AttackSlot 
                    card={{ ...tc.card, defendedBy: tc.defendedBy }}
                    index={index}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
