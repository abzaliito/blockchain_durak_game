import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import Hand from '../Hand/Hand';
import PlayArea from '../PlayArea/PlayArea';
import PlayerInfo from './PlayerInfo';
import DeckInfo from './DeckInfo';
import Card from '../Card/Card';
import { getCardId } from '../../utils/cardUtils';
import styles from './GameBoard.module.css';

export default function GameBoard() {
  const { gameState, myHand, walletAddress, attack, defend, transfer, takeCards, endAttack, pass, isDealing, leaveTable, turnTimer, turnTimeout, currentTable, setReady, readyTimer, readyTimeout } = useSocket();
  const [activeCard, setActiveCard] = useState(null);
  const [timerProgress, setTimerProgress] = useState(1);

  useEffect(() => {
    if (!readyTimer || !readyTimeout) {
      setTimerProgress(1);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - readyTimer;
      const remaining = Math.max(0, readyTimeout - elapsed);
      setTimerProgress(remaining / readyTimeout);
    }, 50);

    return () => clearInterval(interval);
  }, [readyTimer, readyTimeout]);

  if (!gameState && !currentTable) return null;

  if (!gameState && currentTable) {
    const myPlayer = currentTable.players.find(p => p.walletAddress === walletAddress);
    const readyCount = currentTable.players.filter(p => p.isReady).length;

    return (
      <div className={styles.gameBoard}>
        <div className={styles.waitingOverlay}>
          <motion.div 
            className={styles.waitingCard}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <h2>{currentTable.tableName}</h2>
            <div className={styles.waitingInfo}>
              <span className={styles.gameModeBadge}>{currentTable.gameMode}</span>
              <span className={styles.stakeBadge}>{currentTable.stake} ETH</span>
            </div>

            <div className={styles.waitingPlayers}>
              {Array.from({ length: currentTable.maxPlayers }).map((_, index) => {
                const player = currentTable.players[index];
                return (
                  <div 
                    key={index}
                    className={`${styles.waitingSlot} ${player ? styles.filled : ''} ${player?.walletAddress === walletAddress ? styles.you : ''}`}
                  >
                    {player ? (
                      <>
                        <span className={styles.waitingIcon}>{player.walletAddress === walletAddress ? '👤' : '🎭'}</span>
                        <span className={styles.waitingAddress}>
                          {player.walletAddress.slice(0, 6)}...{player.walletAddress.slice(-4)}
                          {player.walletAddress === walletAddress && <span className={styles.youTag}>You</span>}
                        </span>
                        <span className={player.isReady ? styles.readyTag : styles.notReadyTag}>
                          {player.isReady ? '✓' : '...'}
                        </span>
                      </>
                    ) : (
                      <span className={styles.emptyText}>⏳ Waiting...</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.waitingActions}>
              {!myPlayer?.isReady ? (
                <div 
                  className={`${styles.readyBtnWrapper} ${readyTimer ? styles.hasTimer : ''}`}
                  style={{ '--timer-progress': timerProgress }}
                >
                  <motion.button
                    className={styles.readyBtn}
                    onClick={setReady}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {readyTimer ? `Ready! (${Math.ceil(timerProgress * readyTimeout / 1000)}s)` : 'Ready ✓'}
                  </motion.button>
                </div>
              ) : (
                <div className={styles.waitingStatus}>
                  <div className={styles.waitingSpinner}></div>
                  {currentTable.players.length < currentTable.maxPlayers 
                    ? `Waiting for players (${currentTable.players.length}/${currentTable.maxPlayers})`
                    : `Ready: ${readyCount}/${currentTable.maxPlayers}`
                  }
                </div>
              )}
              
              <button className={styles.leaveTableBtn} onClick={leaveTable}>
                Leave Table
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const { players, attackerIndex, defenderIndex, tableCards, deck } = gameState;
  
  const myIndex = players.findIndex(p => p.walletAddress === walletAddress);
  const isAttacker = myIndex === attackerIndex;
  const isDefender = myIndex === defenderIndex;
  const canAttack = isAttacker || (tableCards.length > 0 && myIndex !== defenderIndex);
  
  const otherPlayers = players.filter(p => p.walletAddress !== walletAddress);
  
  const getPlayerPosition = (index, total) => {
    const positions = {
      1: ['top'],
      2: ['topLeft', 'topRight'],
      3: ['left', 'top', 'right'],
      4: ['topLeft', 'top', 'topRight', 'right'],
      5: ['left', 'topLeft', 'top', 'topRight', 'right']
    };
    return positions[total]?.[index] || 'top';
  };

  const handleDragStart = (event) => {
    const { active } = event;
    if (active.data.current?.card) {
      setActiveCard(active.data.current.card);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || !active.data.current?.card) return;

    const draggedCard = active.data.current.card;
    const dropZone = over.data.current;

    if (dropZone?.type === 'attack') {
      if (isDefender && gameState.gameMode === 'perevodnoy' && tableCards.length > 0) {
        const hasDefended = tableCards.some(tc => tc.defendedBy);
        const allSameRank = tableCards.every(tc => tc.card.rank === draggedCard.rank);
        
        if (!hasDefended && allSameRank) {
          transfer(draggedCard);
          return;
        }
      }
      
      if (canAttack) {
        const tableRanks = new Set(
          tableCards.flatMap(tc => [tc.card.rank, tc.defendedBy?.rank].filter(Boolean))
        );
        
        if (tableCards.length === 0 || tableRanks.has(draggedCard.rank)) {
          attack(draggedCard);
        }
      }
    } else if (dropZone?.type === 'defense' && isDefender) {
      const attackCard = dropZone.attackCard;
      
      if (!attackCard.defendedBy) {
        defend(attackCard, draggedCard);
      }
    }
  };

  const hasUndefended = tableCards.some(tc => !tc.defendedBy);
  const allDefended = tableCards.length > 0 && !hasUndefended;
  
  const isDefenderTurn = hasUndefended;
  const isAttackerTurn = !hasUndefended;

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className={styles.gameBoard}>
        <DeckInfo deck={deck} isDealing={isDealing} />
        
        <div className={styles.opponents}>
          {otherPlayers.map((player, index) => {
            const playerIdx = players.indexOf(player);
            const playerIsAttacker = playerIdx === attackerIndex;
            const playerIsDefender = playerIdx === defenderIndex;
            const isCurrentTurn = (playerIsAttacker && isAttackerTurn) || (playerIsDefender && isDefenderTurn);
            
            return (
              <PlayerInfo
                key={player.walletAddress}
                player={player}
                isAttacker={playerIsAttacker}
                isDefender={playerIsDefender}
                isCurrentTurn={isCurrentTurn}
                isYou={false}
                position={getPlayerPosition(index, otherPlayers.length)}
                turnTimer={turnTimer}
                turnTimeout={turnTimeout}
              />
            );
          })}
        </div>

        <div className={styles.mainArea}>
          <PlayArea 
            tableCards={tableCards} 
            isDefender={isDefender}
            trumpSuit={deck.trumpSuit}
            gameMode={gameState.gameMode}
          />
        </div>

        <div className={styles.actions}>
          <AnimatePresence>
            {isDefender && hasUndefended && (
              <motion.button
                className={`${styles.actionBtn} ${styles.danger}`}
                onClick={takeCards}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                Take Cards
              </motion.button>
            )}
            {canAttack && allDefended && (
              <motion.button
                className={`${styles.actionBtn} ${styles.success}`}
                onClick={endAttack}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                Bito ✓
              </motion.button>
            )}
            {canAttack && !isAttacker && tableCards.length > 0 && (
              <motion.button
                className={styles.actionBtn}
                onClick={pass}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                Pass
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <button className={styles.exitBtn} onClick={leaveTable} title="Leave game (forfeit)">
          ✕
        </button>

        <div className={styles.myInfo}>
          <PlayerInfo
            player={players[myIndex]}
            isAttacker={isAttacker}
            isDefender={isDefender}
            isCurrentTurn={(isAttacker && isAttackerTurn) || (isDefender && isDefenderTurn)}
            isYou={true}
            turnTimer={turnTimer}
            turnTimeout={turnTimeout}
          />
        </div>

        <div className={styles.handContainer}>
          <Hand cards={myHand} isInteractive={true} />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard && <Card card={activeCard} isDraggable={false} />}
        </DragOverlay>

        {gameState.state === 'finished' && (
          <motion.div 
            className={styles.gameOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className={styles.gameOverContent}
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className={styles.gameOverIcon}>🏆</div>
              <h2>Game Over!</h2>
              
              {gameState.loser && (
                <p className={styles.loser}>
                  Durak: {gameState.loser.slice(0, 8)}...{gameState.loser.slice(-4)}
                </p>
              )}
              
              {gameState.finishOrder.length > 0 && (
                <div className={styles.finishOrder}>
                  <h3>Winners:</h3>
                  {gameState.finishOrder.map((wallet, i) => (
                    <div 
                      key={wallet} 
                      className={`${styles.resultRow} ${wallet === walletAddress ? styles.you : ''}`}
                    >
                      <span className={styles.position}>#{i + 1}</span>
                      <span>{wallet.slice(0, 8)}...{wallet.slice(-4)}</span>
                      {wallet === walletAddress && <span className={styles.youBadge}>You!</span>}
                    </div>
                  ))}
                </div>
              )}
              
              <motion.button
                className={styles.leaveBtn}
                onClick={leaveTable}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Back to Lobby
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </DndContext>
  );
}
