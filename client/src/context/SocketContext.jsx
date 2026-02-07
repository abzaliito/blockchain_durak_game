import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
const STORAGE_KEY = 'durak_session';

function saveSession(wallet, tableId = null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet, tableId, timestamp: Date.now() }));
}

function loadSession() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    if (Date.now() - session.timestamp > 3600000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [tables, setTables] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDealing, setIsDealing] = useState(false);
  const [turnTimer, setTurnTimer] = useState(null);
  const [turnTimeout, setTurnTimeout] = useState(20000);
  const [readyTimer, setReadyTimer] = useState(null);
  const [readyTimeout, setReadyTimeout] = useState(15000);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev.slice(-50), { message, type, time: new Date() }]);
  }, []);

  const connect = useCallback((wallet) => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      addLog('Connected to server', 'success');
      newSocket.emit('auth', { walletAddress: wallet });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setGameState(null);
      setCurrentTable(null);
      addLog('Disconnected from server', 'error');
    });

    newSocket.on('auth_success', (data) => {
      setWalletAddress(data.walletAddress);
      saveSession(data.walletAddress);
      addLog('Authenticated successfully', 'success');
      newSocket.emit('get_tables');
    });

    newSocket.on('active_session_found', (data) => {
      addLog('Found active session, reconnecting...', 'info');
      newSocket.emit('join_table', { tableId: data.tableId });
    });

    newSocket.on('game_reconnected', (data) => {
      setCurrentTable({
        tableId: data.tableId,
        tableName: data.tableName
      });
      setGameState(data.gameState);
      setMyHand(data.yourHand?.hand || []);
      saveSession(wallet, data.tableId);
      addLog('Reconnected to game!', 'success');
    });

    newSocket.on('player_reconnected', (data) => {
      addLog(`${data.walletAddress.slice(0, 8)}... reconnected`, 'success');
    });

    newSocket.on('player_temporarily_disconnected', (data) => {
      addLog(`${data.walletAddress.slice(0, 8)}... connection lost, waiting...`, 'error');
    });

    newSocket.on('auth_error', (data) => {
      setError(data.message);
      addLog('Auth error: ' + data.message, 'error');
    });

    newSocket.on('error', (data) => {
      setError(data.message);
      addLog('Error: ' + data.message, 'error');
    });

    newSocket.on('action_error', (data) => {
      addLog(`${data.action}: ${data.message}`, 'error');
    });

    newSocket.on('tables_list', (data) => {
      setTables(data);
    });

    newSocket.on('joined_table', (data) => {
      setCurrentTable(data);
      saveSession(wallet, data.tableId);
      addLog('Joined: ' + data.tableName, 'success');
    });

    newSocket.on('left_table', () => {
      setCurrentTable(null);
      setGameState(null);
      setMyHand([]);
      addLog('Left table', 'info');
    });

    newSocket.on('player_joined', (data) => {
      setCurrentTable(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: [...prev.players, { walletAddress: data.walletAddress, isReady: false }]
        };
      });
      addLog('Player joined: ' + data.walletAddress.slice(0, 10) + '...', 'info');
    });

    newSocket.on('player_left', (data) => {
      setCurrentTable(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.walletAddress !== data.walletAddress)
        };
      });
      addLog('Player left: ' + data.walletAddress.slice(0, 10) + '...', 'info');
    });

    newSocket.on('player_ready_update', (data) => {
      setCurrentTable(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.walletAddress === data.walletAddress ? { ...p, isReady: true } : p
          )
        };
      });
      addLog(`Ready: ${data.readyCount}/${data.requiredPlayers}`, 'info');
    });

    newSocket.on('ready_timer_start', (data) => {
      setReadyTimer(data.startTime);
      setReadyTimeout(data.timeout);
      addLog('15 seconds to get ready!', 'warning');
    });

    newSocket.on('ready_timer_cancelled', () => {
      setReadyTimer(null);
    });

    newSocket.on('kicked_not_ready', () => {
      setCurrentTable(null);
      setReadyTimer(null);
      addLog('Kicked for not being ready in time', 'error');
    });

    newSocket.on('game_started', (data) => {
      setReadyTimer(null);
      setGameState(data.gameState);
      setIsDealing(true);
      setMyHand([]);
      
      const cards = data.yourHand.hand;
      cards.forEach((card, index) => {
        setTimeout(() => {
          setMyHand(prev => [...prev, card]);
          if (index === cards.length - 1) {
            setTimeout(() => setIsDealing(false), 300);
          }
        }, index * 200);
      });
      
      addLog('Game started!', 'success');
    });

    newSocket.on('card_played', (data) => {
      setGameState(data.gameState);
      setMyHand(data.yourHand.hand);
    });

    newSocket.on('card_transferred', (data) => {
      setGameState(data.gameState);
      setMyHand(data.yourHand.hand);
      addLog('Card transferred', 'info');
    });

    newSocket.on('cards_taken', (data) => {
      setGameState(data.gameState);
      setMyHand(data.yourHand.hand);
      addLog(`${data.walletAddress.slice(0, 10)}... took cards`, 'info');
    });

    newSocket.on('attack_ended', (data) => {
      setGameState(data.gameState);
      setMyHand(data.yourHand.hand);
      addLog('Round complete', 'success');
    });

    newSocket.on('player_disconnected', (data) => {
      setGameState(data.gameState);
      addLog('Player disconnected', 'error');
    });

    newSocket.on('turn_timer_start', (data) => {
      setTurnTimer(Date.now());
      setTurnTimeout(data.timeout);
    });

    newSocket.on('auto_action', (data) => {
      addLog(`Auto: ${data.walletAddress.slice(0, 10)}... - ${data.action}`, 'warning');
    });

    newSocket.on('game_ended', (data) => {
      setGameState(data.gameState);
      setTurnTimer(null);
      addLog(`Game over! Loser: ${data.loser?.slice(0, 10)}...`, 'success');
    });

    setSocket(newSocket);
  }, [addLog]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setWalletAddress(null);
      setCurrentTable(null);
      setGameState(null);
      setMyHand([]);
      clearSession();
    }
  }, [socket]);

  useEffect(() => {
    const session = loadSession();
    if (session && session.wallet && !socket) {
      connect(session.wallet);
    }
  }, []);

  const refreshTables = useCallback(() => {
    if (socket) socket.emit('get_tables');
  }, [socket]);

  const joinTable = useCallback((tableId) => {
    if (socket) socket.emit('join_table', { tableId });
  }, [socket]);

  const leaveTable = useCallback(() => {
    if (socket) {
      socket.emit('leave_table');
      saveSession(walletAddress, null);
    }
  }, [socket, walletAddress]);

  const setReady = useCallback(() => {
    if (socket) socket.emit('player_ready');
  }, [socket]);

  const attack = useCallback((card) => {
    if (socket) socket.emit('attack', { card });
  }, [socket]);

  const defend = useCallback((attackCard, defenseCard) => {
    if (socket) socket.emit('defend', { attackCard, defenseCard });
  }, [socket]);

  const transfer = useCallback((card) => {
    if (socket) socket.emit('transfer', { card });
  }, [socket]);

  const takeCards = useCallback(() => {
    if (socket) socket.emit('take_cards');
  }, [socket]);

  const endAttack = useCallback(() => {
    if (socket) socket.emit('end_attack');
  }, [socket]);

  const pass = useCallback(() => {
    if (socket) socket.emit('pass');
  }, [socket]);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
    };
  }, [socket]);

  const value = {
    socket,
    isConnected,
    walletAddress,
    tables,
    currentTable,
    gameState,
    myHand,
    error,
    logs,
    isDealing,
    turnTimer,
    turnTimeout,
    readyTimer,
    readyTimeout,
    connect,
    disconnect,
    refreshTables,
    joinTable,
    leaveTable,
    setReady,
    attack,
    defend,
    transfer,
    takeCards,
    endAttack,
    pass
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
