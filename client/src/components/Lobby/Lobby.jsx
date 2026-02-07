import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { useWeb3 } from '../../context/Web3Context';
import styles from './Lobby.module.css';

export default function Lobby() {
  const { tables, joinTable, disconnect } = useSocket();
  const { address, chipsBalance, xpBalance, disconnectWallet } = useWeb3();

  const formatBalance = (balance) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    return num.toFixed(0);
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleJoinTable = (tableId, stake) => {
    const balance = parseFloat(chipsBalance);
    if (balance < stake) {
      alert(`Not enough chips! You need ${stake} DRC but have ${formatBalance(chipsBalance)} DRC`);
      return;
    }
    joinTable(tableId);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    disconnect();
  };

  const groupedTables = {
    podkidnoy: tables.filter(t => t.gameMode === 'podkidnoy'),
    perevodnoy: tables.filter(t => t.gameMode === 'perevodnoy')
  };

  return (
    <div className={styles.lobby}>
      <motion.div 
        className={styles.walletBar}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className={styles.walletAddress}>
          <span className={styles.walletIcon}>🦊</span>
          <span>{formatAddress(address)}</span>
        </div>
        <div className={styles.walletBalances}>
          <div className={styles.walletBalance}>
            <span>💰</span>
            <span className={styles.balanceNum}>{formatBalance(chipsBalance)}</span>
            <span className={styles.balanceLabel}>DRC</span>
          </div>
          <div className={styles.walletBalance}>
            <span>⭐</span>
            <span className={styles.balanceNum}>{formatBalance(xpBalance)}</span>
            <span className={styles.balanceLabel}>XP</span>
          </div>
        </div>
        <button className={styles.disconnectBtn} onClick={handleDisconnect}>
          Disconnect
        </button>
      </motion.div>

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
              <TableCard key={table.id} table={table} index={index} onJoin={handleJoinTable} />
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
              <TableCard key={table.id} table={table} index={index} onJoin={handleJoinTable} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableCard({ table, index, onJoin }) {
  const isFull = table.currentPlayers >= table.maxPlayers;
  const isInProgress = table.gameInProgress;
  const canJoin = !isFull && !isInProgress;

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
