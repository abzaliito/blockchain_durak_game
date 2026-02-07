import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import styles from './Lobby.module.css';

export default function Lobby() {
  const { tables, joinTable } = useSocket();

  const groupedTables = {
    podkidnoy: tables.filter(t => t.gameMode === 'podkidnoy'),
    perevodnoy: tables.filter(t => t.gameMode === 'perevodnoy')
  };

  return (
    <div className={styles.lobby}>
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
              <TableCard key={table.id} table={table} index={index} onJoin={joinTable} />
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
              <TableCard key={table.id} table={table} index={index} onJoin={joinTable} />
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
      onClick={() => canJoin && onJoin(table.id)}
    >
      <div className={styles.tableHeader}>
        <span className={styles.tableName}>{table.maxPlayers} Players</span>
        <span className={styles.stake}>{table.stake} ETH</span>
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
