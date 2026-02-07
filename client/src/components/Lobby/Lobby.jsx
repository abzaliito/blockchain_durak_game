import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { useWeb3 } from '../../context/Web3Context';
import styles from './Lobby.module.css';

export default function Lobby() {
  const { tables, joinTable, walletAddress, socket, currentTable } = useSocket();
  const { address, chipsBalance, xpBalance, buyChips, error, clearError, signer, connectWallet, isConnecting, createTableOnChain, joinTableOnChain, updateBalances } = useWeb3();
  const [buyAmount, setBuyAmount] = useState('0.01');
  const [isBuying, setIsBuying] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [pendingBlockchainJoin, setPendingBlockchainJoin] = useState(null);

  const isWalletConnected = !!signer;

  const groupedTables = {
    podkidnoy: tables.filter(t => t.gameMode === 'podkidnoy'),
    perevodnoy: tables.filter(t => t.gameMode === 'perevodnoy')
  };

  useEffect(() => {
    if (!socket) return;

    const handleJoinedTable = async (data) => {
      if (!signer) return;

      const { isFirstPlayer, blockchainTableId, stake, tableName } = data;

      if (isFirstPlayer) {
        const result = await createTableOnChain(tableName, stake);
        if (result.success && result.blockchainTableId !== null) {
          socket.emit('blockchain_table_created', { blockchainTableId: result.blockchainTableId });
        }
        setIsJoining(false);
      } else if (blockchainTableId !== null) {
        await joinTableOnChain(blockchainTableId, stake);
        setIsJoining(false);
      } else {
        setPendingBlockchainJoin({ stake });
      }
    };

    const handleBlockchainTableLinked = async (data) => {
      if (pendingBlockchainJoin && signer) {
        await joinTableOnChain(data.blockchainTableId, pendingBlockchainJoin.stake);
        setPendingBlockchainJoin(null);
        setIsJoining(false);
      }
    };

    socket.on('joined_table', handleJoinedTable);
    socket.on('blockchain_table_linked', handleBlockchainTableLinked);

    return () => {
      socket.off('joined_table', handleJoinedTable);
      socket.off('blockchain_table_linked', handleBlockchainTableLinked);
    };
  }, [socket, signer, createTableOnChain, joinTableOnChain, pendingBlockchainJoin]);

  // Refresh balances when returning to Lobby
  useEffect(() => {
    if (signer && updateBalances) {
      updateBalances();
    }
  }, [signer, updateBalances]);

  const handleJoinTable = useCallback(async (tableId, stake) => {
    if (!signer) {
      await connectWallet();
      return;
    }

    const balance = parseFloat(chipsBalance);
    if (balance < stake) {
      clearError();
      setShowBuyModal(true);
      return;
    }

    setIsJoining(true);
    joinTable(tableId);
  }, [signer, chipsBalance, connectWallet, joinTable, clearError]);

  const handleOpenModal = () => {
    clearError();
    setShowBuyModal(true);
  };

  const handleReconnect = async () => {
    clearError();
    await connectWallet();
  };

  const handleBuyChips = async () => {
    setIsBuying(true);
    clearError();

    try {
      if (!signer) {
        const connected = await connectWallet();
        if (!connected) {
          setIsBuying(false);
          return;
        }
      }

      const success = await buyChips(buyAmount);
      if (success) {
        setShowBuyModal(false);
      }
    } catch (err) {
      console.error('Buy chips error in Lobby:', err);
    }

    setIsBuying(false);
  };

  return (
    <div className={styles.lobby}>
      <div className={styles.walletBar}>
        <div className={styles.walletAddress}>
          🦊 {(address || walletAddress)?.slice(0, 6)}...{(address || walletAddress)?.slice(-4)}
          {!isWalletConnected && (
            <span className={styles.disconnectedBadge}>disconnected</span>
          )}
        </div>
        <div className={styles.balances}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceValue}>{parseFloat(chipsBalance || 0).toFixed(0)}</span>
            <span className={styles.balanceLabel}>DRC</span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.balanceValue}>{parseFloat(xpBalance || 0).toFixed(0)}</span>
            <span className={styles.balanceLabel}>XP</span>
          </div>
        </div>
        {!isWalletConnected ? (
          <button
            className={styles.reconnectBtn}
            onClick={handleReconnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : '🔗 Connect Wallet'}
          </button>
        ) : (
          <button className={styles.buyChipsBtn} onClick={handleOpenModal}>
            + Buy Chips
          </button>
        )}
      </div>

      {showBuyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBuyModal(false)}>
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Buy Chips</h3>
            <p className={styles.rate}>1 ETH = 1000 DRC</p>

            {error && (
              <div className={styles.errorBox}>
                {error}
                {error.includes('not connected') && (
                  <button
                    className={styles.reconnectInlineBtn}
                    onClick={handleReconnect}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting...' : 'Reconnect'}
                  </button>
                )}
              </div>
            )}

            {!isWalletConnected && !error && (
              <div className={styles.warningBox}>
                Wallet not connected
                <button
                  className={styles.reconnectInlineBtn}
                  onClick={handleReconnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Now'}
                </button>
              </div>
            )}

            <div className={styles.buyInputGroup}>
              <input
                type="number"
                value={buyAmount}
                onChange={e => setBuyAmount(e.target.value)}
                step="0.01"
                min="0.001"
                className={styles.buyInput}
              />
              <span className={styles.inputSuffix}>ETH</span>
            </div>
            <p className={styles.willReceive}>
              You will receive: <strong>{(parseFloat(buyAmount || 0) * 1000).toFixed(0)} DRC</strong>
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowBuyModal(false)}>
                Cancel
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleBuyChips}
                disabled={isBuying || isConnecting}
              >
                {isBuying ? 'Processing...' : 'Buy'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div
        className={styles.header}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className={styles.title}>
          <span className={styles.icon}>🃏</span>
          Durak Online
        </h1>
        <p className={styles.subtitle}>Choose a table to play</p>
      </motion.div>

      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Podkidnoy Durak</h2>
            <span className={styles.badge}>Classic</span>
          </div>
          <div className={styles.tablesGrid}>
            {groupedTables.podkidnoy.map((table, index) => (
              <TableCard key={table.id} table={table} index={index} onJoin={handleJoinTable} isJoining={isJoining} />
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Perevodnoy Durak</h2>
            <span className={styles.badge}>Transfer</span>
          </div>
          <div className={styles.tablesGrid}>
            {groupedTables.perevodnoy.map((table, index) => (
              <TableCard key={table.id} table={table} index={index} onJoin={handleJoinTable} isJoining={isJoining} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableCard({ table, index, onJoin, isJoining }) {
  const isFull = table.currentPlayers >= table.maxPlayers;
  const isInProgress = table.gameInProgress;
  const canJoin = !isFull && !isInProgress && !isJoining;

  return (
    <motion.div
      className={`${styles.tableCard} ${!canJoin ? styles.disabled : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={canJoin ? { scale: 1.02, y: -5 } : {}}
      onClick={() => canJoin && onJoin(table.id, table.stake)}
    >
      <div className={styles.tableHeader}>
        <span className={styles.tableName}>{table.maxPlayers} Players</span>
        <span className={styles.stake}>{table.stake} DRC</span>
      </div>

      <div className={styles.tableBody}>
        <div className={styles.playersInfo}>
          <div className={styles.playersCount}>
            {table.currentPlayers}/{table.maxPlayers}
          </div>
          <div className={styles.playersLabel}>players</div>
        </div>

        <div className={styles.playerSlots}>
          {Array.from({ length: table.maxPlayers }).map((_, i) => (
            <div
              key={i}
              className={`${styles.slot} ${i < table.currentPlayers ? styles.filled : ''}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.tableFooter}>
        {isInProgress ? (
          <span className={styles.statusInProgress}>Game in Progress</span>
        ) : isFull ? (
          <span className={styles.statusFull}>Table Full</span>
        ) : (
          <span className={styles.statusOpen}>Join Game →</span>
        )}
      </div>
    </motion.div>
  );
}
