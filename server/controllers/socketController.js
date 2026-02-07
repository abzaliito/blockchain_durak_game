const { tables } = require('../config/tables');
const GameService = require('../services/GameService');
const blockchainService = require('../services/BlockchainService');

const connectedPlayers = new Map();
const tableStates = new Map();
const activeGames = new Map();
const disconnectTimeouts = new Map();
const turnTimers = new Map();
const readyTimers = new Map();
const RECONNECT_TIMEOUT = 30000;
const TURN_TIMEOUT = 20000;
const READY_TIMEOUT = 15000;

function initializeTables() {
  tables.forEach(table => {
    tableStates.set(table.id, {
      ...table,
      players: [],
      readyPlayers: new Set(),
      gameInProgress: false,
      blockchainTableId: null
    });
  });
}

function startReadyTimer(io, tableId) {
  clearReadyTimer(tableId);
  
  const tableState = tableStates.get(tableId);
  if (!tableState || tableState.gameInProgress) return;

  const startTime = Date.now();

  io.to(tableId).emit('ready_timer_start', {
    timeout: READY_TIMEOUT,
    startTime
  });

  const timerId = setTimeout(() => {
    handleReadyTimeout(io, tableId);
  }, READY_TIMEOUT);

  readyTimers.set(tableId, { timerId, startTime });
}

function clearReadyTimer(tableId) {
  const timer = readyTimers.get(tableId);
  if (timer) {
    clearTimeout(timer.timerId);
    readyTimers.delete(tableId);
  }
}

function handleReadyTimeout(io, tableId) {
  const tableState = tableStates.get(tableId);
  if (!tableState || tableState.gameInProgress) return;

  const notReadyPlayers = tableState.players.filter(p => !tableState.readyPlayers.has(p.socketId));

  notReadyPlayers.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.socketId);
    if (playerSocket) {
      const player = connectedPlayers.get(p.socketId);
      if (player) {
        tableState.players = tableState.players.filter(tp => tp.socketId !== p.socketId);
        tableState.readyPlayers.delete(p.socketId);
        playerSocket.leave(tableId);
        player.currentTableId = null;

        playerSocket.emit('kicked_not_ready', { tableId });
        
        io.to(tableId).emit('player_left', {
          walletAddress: p.walletAddress,
          playersCount: tableState.players.length,
          reason: 'not_ready'
        });

        console.log(`Player ${p.walletAddress} kicked from table ${tableId} for not being ready`);
      }
    }
  });

  if (tableState.players.length === tableState.maxPlayers &&
      tableState.readyPlayers.size === tableState.maxPlayers) {
    startGame(io, tableState);
  } else if (tableState.players.length < tableState.maxPlayers) {
    io.to(tableId).emit('ready_timer_cancelled');
  }
}

function setupSocketHandlers(io) {
  initializeTables();

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('auth', (data) => handleAuth(socket, data));
    socket.on('get_tables', () => handleGetTables(socket));
    socket.on('join_table', (data) => handleJoinTable(io, socket, data));
    socket.on('leave_table', () => handleLeaveTable(io, socket));
    socket.on('player_ready', () => handlePlayerReady(io, socket));
    socket.on('blockchain_table_created', (data) => handleBlockchainTableCreated(io, socket, data));

    socket.on('attack', (data) => handleAttack(io, socket, data));
    socket.on('defend', (data) => handleDefend(io, socket, data));
    socket.on('transfer', (data) => handleTransfer(io, socket, data));
    socket.on('take_cards', () => handleTakeCards(io, socket));
    socket.on('end_attack', () => handleEndAttack(io, socket));
    socket.on('pass', () => handlePass(io, socket));

    socket.on('disconnect', () => handleDisconnect(io, socket));
  });
}

function handleAuth(socket, data) {
  const { walletAddress } = data;

  if (!walletAddress) {
    socket.emit('auth_error', { message: 'Wallet address required' });
    return;
  }

  const wallet = walletAddress.toLowerCase();

  connectedPlayers.set(socket.id, {
    socketId: socket.id,
    walletAddress: wallet,
    currentTableId: null
  });

  socket.emit('auth_success', {
    message: 'Authenticated successfully',
    walletAddress: wallet
  });

  const activeSession = findActiveSession(wallet);
  if (activeSession) {
    socket.emit('active_session_found', {
      tableId: activeSession.tableId,
      gameInProgress: activeSession.gameInProgress
    });
  }

  console.log(`Player authenticated: ${walletAddress}`);
}

function findActiveSession(walletAddress) {
  for (const [tableId, tableState] of tableStates) {
    const playerInTable = tableState.players.find(p => p.walletAddress === walletAddress);
    if (playerInTable) {
      return {
        tableId,
        gameInProgress: tableState.gameInProgress,
        tableState
      };
    }
  }
  return null;
}

function handleGetTables(socket) {
  const tablesInfo = [];

  tableStates.forEach((state) => {
    tablesInfo.push({
      id: state.id,
      name: state.name,
      maxPlayers: state.maxPlayers,
      currentPlayers: state.players.length,
      stake: state.stake,
      gameMode: state.gameMode,
      gameInProgress: state.gameInProgress
    });
  });

  socket.emit('tables_list', tablesInfo);
}

function handleJoinTable(io, socket, data) {
  const player = connectedPlayers.get(socket.id);

  if (!player) {
    socket.emit('error', { message: 'Not authenticated' });
    return;
  }

  const { tableId } = data;
  const tableState = tableStates.get(tableId);

  if (!tableState) {
    socket.emit('error', { message: 'Table not found' });
    return;
  }

  const existingPlayer = tableState.players.find(p => p.walletAddress === player.walletAddress);
  
  if (existingPlayer && tableState.gameInProgress) {
    const existingTimeout = disconnectTimeouts.get(player.walletAddress);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      disconnectTimeouts.delete(player.walletAddress);
    }

    existingPlayer.socketId = socket.id;
    player.currentTableId = tableId;
    socket.join(tableId);

    const gameService = activeGames.get(tableId);
    if (gameService) {
      const gamePlayer = gameService.game.players.find(p => p.walletAddress === player.walletAddress);
      if (gamePlayer) {
        gamePlayer.socketId = socket.id;
      }

      socket.emit('game_reconnected', {
        tableId: tableState.id,
        tableName: tableState.name,
        gameState: gameService.getGameState(),
        yourHand: gameService.getPlayerState(socket.id)
      });

      socket.to(tableId).emit('player_reconnected', {
        walletAddress: player.walletAddress
      });

      console.log(`Player ${player.walletAddress} reconnected to game at table ${tableId}`);
    }
    return;
  }

  if (tableState.gameInProgress) {
    socket.emit('error', { message: 'Game already in progress' });
    return;
  }

  if (tableState.players.length >= tableState.maxPlayers) {
    socket.emit('error', { message: 'Table is full' });
    return;
  }

  const alreadyAtTable = tableState.players.some(p => p.walletAddress === player.walletAddress);
  if (alreadyAtTable) {
    socket.emit('error', { message: 'Already at this table' });
    return;
  }

  if (player.currentTableId) {
    leaveCurrentTable(io, socket, player);
  }

  tableState.players.push({
    socketId: socket.id,
    walletAddress: player.walletAddress
  });

  player.currentTableId = tableId;
  socket.join(tableId);

  socket.emit('joined_table', {
    tableId: tableState.id,
    tableName: tableState.name,
    gameMode: tableState.gameMode,
    maxPlayers: tableState.maxPlayers,
    stake: tableState.stake,
    players: tableState.players.map(p => ({
      walletAddress: p.walletAddress,
      isReady: tableState.readyPlayers.has(p.socketId)
    })),
    blockchainTableId: tableState.blockchainTableId,
    isFirstPlayer: tableState.players.length === 1
  });

  socket.to(tableId).emit('player_joined', {
    walletAddress: player.walletAddress,
    playersCount: tableState.players.length
  });

  if (tableState.players.length === tableState.maxPlayers) {
    startReadyTimer(io, tableId);
  }

  console.log(`Player ${player.walletAddress} joined table ${tableId}`);
}

function handleLeaveTable(io, socket) {
  const player = connectedPlayers.get(socket.id);

  if (!player || !player.currentTableId) {
    return;
  }

  leaveCurrentTable(io, socket, player);
}

function leaveCurrentTable(io, socket, player) {
  const tableId = player.currentTableId;
  const tableState = tableStates.get(tableId);

  if (!tableState) return;

  if (tableState.gameInProgress) {
    const gameService = activeGames.get(tableId);
    if (gameService) {
      const result = gameService.handlePlayerDisconnect(socket.id);
      if (result) {
        const gameState = gameService.getGameState();
        
        if (result.gameEnded) {
          io.to(tableId).emit('game_ended', {
            gameState,
            loser: gameState.loser,
            finishOrder: gameState.finishOrder,
            reason: 'player_left'
          });
          
          if (tableState.blockchainTableId !== null) {
            const winner = gameState.finishOrder?.[0] || 
              gameState.players.find(p => p.walletAddress !== gameState.loser)?.walletAddress;
            if (winner) {
              blockchainService.finishGame(tableState.blockchainTableId, winner);
            }
          }
          
          endGame(io, tableId);
        } else {
          io.to(tableId).emit('player_disconnected', {
            walletAddress: player.walletAddress,
            gameEnded: false,
            gameState
          });
        }
      }
    }
  }

  tableState.players = tableState.players.filter(p => p.socketId !== socket.id);
  tableState.readyPlayers.delete(socket.id);

  if (tableState.players.length < tableState.maxPlayers) {
    clearReadyTimer(tableId);
    io.to(tableId).emit('ready_timer_cancelled');
  }

  socket.leave(tableId);
  player.currentTableId = null;

  socket.to(tableId).emit('player_left', {
    walletAddress: player.walletAddress,
    playersCount: tableState.players.length
  });

  socket.emit('left_table');

  console.log(`Player ${player.walletAddress} left table ${tableId}`);
}

function handlePlayerReady(io, socket) {
  const player = connectedPlayers.get(socket.id);

  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not at a table' });
    return;
  }

  const tableState = tableStates.get(player.currentTableId);

  if (!tableState || tableState.gameInProgress) {
    socket.emit('error', { message: 'Cannot ready now' });
    return;
  }

  tableState.readyPlayers.add(socket.id);

  io.to(player.currentTableId).emit('player_ready_update', {
    walletAddress: player.walletAddress,
    readyCount: tableState.readyPlayers.size,
    totalPlayers: tableState.players.length,
    requiredPlayers: tableState.maxPlayers
  });

  if (tableState.players.length === tableState.maxPlayers &&
      tableState.readyPlayers.size === tableState.maxPlayers) {
    clearReadyTimer(player.currentTableId);
    startGame(io, tableState);
  }
}

function startGame(io, tableState) {
  tableState.gameInProgress = true;

  const gameService = GameService.createGame(
    tableState.id,
    tableState.gameMode,
    tableState.players
  );

  activeGames.set(tableState.id, gameService);

  const gameState = gameService.start();

  tableState.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.socketId);
    if (playerSocket) {
      playerSocket.emit('game_started', {
        gameState,
        yourHand: gameService.getPlayerState(p.socketId),
        turnTimeout: TURN_TIMEOUT
      });
    }
  });

  startTurnTimer(io, tableState.id);
  console.log(`Game started at table ${tableState.id}`);
}

function startTurnTimer(io, tableId) {
  clearTurnTimer(tableId);
  
  const gameService = activeGames.get(tableId);
  if (!gameService || gameService.game.state !== 'playing') return;

  const turnStartTime = Date.now();
  
  io.to(tableId).emit('turn_timer_start', {
    timeout: TURN_TIMEOUT,
    startTime: turnStartTime
  });

  const timerId = setTimeout(() => {
    handleTurnTimeout(io, tableId);
  }, TURN_TIMEOUT);

  turnTimers.set(tableId, { timerId, startTime: turnStartTime });
}

function clearTurnTimer(tableId) {
  const timer = turnTimers.get(tableId);
  if (timer) {
    clearTimeout(timer.timerId);
    turnTimers.delete(tableId);
  }
}

function handleTurnTimeout(io, tableId) {
  const gameService = activeGames.get(tableId);
  const tableState = tableStates.get(tableId);
  
  if (!gameService || !tableState || gameService.game.state !== 'playing') return;

  const { defenderIndex, attackerIndex, tableCards } = gameService.game;
  const hasUndefended = tableCards.some(tc => !tc.defendedBy);
  
  if (tableCards.length === 0) {
    const attacker = gameService.game.players[attackerIndex];
    if (attacker && attacker.hand.length > 0) {
      const randomCard = attacker.hand[0];
      const result = gameService.attack(attacker.socketId, randomCard);
      
      if (result.success) {
        io.to(tableId).emit('auto_action', { 
          action: 'attack', 
          walletAddress: attacker.walletAddress,
          reason: 'timeout'
        });
        broadcastGameUpdate(io, tableId, 'card_played', {
          action: 'attack',
          walletAddress: attacker.walletAddress,
          card: result.card,
          auto: true
        });
      }
    }
  } else if (hasUndefended) {
    const defender = gameService.game.players[defenderIndex];
    if (defender) {
      const result = gameService.takeCards(defender.socketId);
      
      if (result.success) {
        io.to(tableId).emit('auto_action', { 
          action: 'take_cards', 
          walletAddress: defender.walletAddress,
          reason: 'timeout'
        });
        
        if (result.gameEnded) {
          broadcastGameEnd(io, tableId);
          return;
        } else {
          broadcastGameUpdate(io, tableId, 'cards_taken', {
            walletAddress: defender.walletAddress,
            cardsTaken: result.cardsTaken,
            auto: true
          });
        }
      }
    }
  } else {
    const attacker = gameService.game.players[attackerIndex];
    if (attacker) {
      const result = gameService.endAttack(attacker.socketId);
      
      if (result.success) {
        io.to(tableId).emit('auto_action', { 
          action: 'end_attack', 
          walletAddress: attacker.walletAddress,
          reason: 'timeout'
        });
        
        if (result.gameEnded) {
          broadcastGameEnd(io, tableId);
          return;
        } else {
          broadcastGameUpdate(io, tableId, 'attack_ended', {
            walletAddress: attacker.walletAddress,
            auto: true
          });
        }
      }
    }
  }

  startTurnTimer(io, tableId);
}

function handleAttack(io, socket, data) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not in a game' });
    return;
  }

  const gameService = activeGames.get(player.currentTableId);
  if (!gameService) {
    socket.emit('error', { message: 'Game not found' });
    return;
  }

  const result = gameService.attack(socket.id, data.card);

  if (!result.success) {
    socket.emit('action_error', { action: 'attack', message: result.error });
    return;
  }

  if (result.gameEnded) {
    broadcastGameEnd(io, player.currentTableId);
  } else {
    broadcastGameUpdate(io, player.currentTableId, 'card_played', {
      action: 'attack',
      walletAddress: player.walletAddress,
      card: result.card
    });
  }
}

function handleDefend(io, socket, data) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not in a game' });
    return;
  }

  const gameService = activeGames.get(player.currentTableId);
  if (!gameService) {
    socket.emit('error', { message: 'Game not found' });
    return;
  }

  const result = gameService.defend(socket.id, data.attackCard, data.defenseCard);

  if (!result.success) {
    socket.emit('action_error', { action: 'defend', message: result.error });
    return;
  }

  if (result.gameEnded) {
    broadcastGameEnd(io, player.currentTableId);
  } else {
    broadcastGameUpdate(io, player.currentTableId, 'card_played', {
      action: 'defend',
      walletAddress: player.walletAddress,
      attackCard: result.attackCard,
      defenseCard: result.defenseCard
    });
  }
}

function handleTransfer(io, socket, data) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not in a game' });
    return;
  }

  const gameService = activeGames.get(player.currentTableId);
  if (!gameService) {
    socket.emit('error', { message: 'Game not found' });
    return;
  }

  const result = gameService.transfer(socket.id, data.card);

  if (!result.success) {
    socket.emit('action_error', { action: 'transfer', message: result.error });
    return;
  }

  broadcastGameUpdate(io, player.currentTableId, 'card_transferred', {
    walletAddress: player.walletAddress,
    card: result.card,
    newDefenderWallet: result.newDefenderWallet
  });
}

function handleTakeCards(io, socket) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not in a game' });
    return;
  }

  const gameService = activeGames.get(player.currentTableId);
  if (!gameService) {
    socket.emit('error', { message: 'Game not found' });
    return;
  }

  const result = gameService.takeCards(socket.id);

  if (!result.success) {
    socket.emit('action_error', { action: 'take_cards', message: result.error });
    return;
  }

  if (result.gameEnded) {
    broadcastGameEnd(io, player.currentTableId);
  } else {
    broadcastGameUpdate(io, player.currentTableId, 'cards_taken', {
      walletAddress: player.walletAddress,
      cardsTaken: result.cardsTaken
    });
  }
}

function handleEndAttack(io, socket) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not in a game' });
    return;
  }

  const gameService = activeGames.get(player.currentTableId);
  if (!gameService) {
    socket.emit('error', { message: 'Game not found' });
    return;
  }

  const result = gameService.endAttack(socket.id);

  if (!result.success) {
    socket.emit('action_error', { action: 'end_attack', message: result.error });
    return;
  }

  if (result.gameEnded) {
    broadcastGameEnd(io, player.currentTableId);
  } else {
    broadcastGameUpdate(io, player.currentTableId, 'attack_ended', {
      walletAddress: player.walletAddress
    });
  }
}

function handlePass(io, socket) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) {
    socket.emit('error', { message: 'Not in a game' });
    return;
  }

  const gameService = activeGames.get(player.currentTableId);
  if (!gameService) {
    socket.emit('error', { message: 'Game not found' });
    return;
  }

  const result = gameService.pass(socket.id);

  if (!result.success) {
    socket.emit('action_error', { action: 'pass', message: result.error });
    return;
  }

  io.to(player.currentTableId).emit('player_passed', {
    walletAddress: player.walletAddress
  });
}

function broadcastGameUpdate(io, tableId, eventName, eventData) {
  const gameService = activeGames.get(tableId);
  if (!gameService) return;

  const tableState = tableStates.get(tableId);
  if (!tableState) return;

  const gameState = gameService.getGameState();

  tableState.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.socketId);
    if (playerSocket) {
      playerSocket.emit(eventName, {
        ...eventData,
        gameState,
        yourHand: gameService.getPlayerState(p.socketId),
        turnTimeout: TURN_TIMEOUT
      });
    }
  });

  startTurnTimer(io, tableId);
}

async function broadcastGameEnd(io, tableId) {
  const gameService = activeGames.get(tableId);
  if (!gameService) return;

  const tableState = tableStates.get(tableId);
  const gameState = gameService.getGameState();

  io.to(tableId).emit('game_ended', {
    gameState,
    loser: gameState.loser,
    finishOrder: gameState.finishOrder
  });

  if (tableState && tableState.blockchainTableId !== null) {
    const winner = gameState.finishOrder && gameState.finishOrder.length > 0 
      ? gameState.finishOrder[0] 
      : gameState.players.find(p => p.walletAddress !== gameState.loser)?.walletAddress;
    
    if (winner) {
      blockchainService.finishGame(tableState.blockchainTableId, winner);
    }
  }

  endGame(io, tableId);
}

function endGame(io, tableId) {
  clearTurnTimer(tableId);
  
  const tableState = tableStates.get(tableId);

  if (tableState) {
    tableState.gameInProgress = false;
    tableState.readyPlayers.clear();
    tableState.blockchainTableId = null;
  }

  activeGames.delete(tableId);

  console.log(`Game ended at table ${tableId}`);
}

function handleBlockchainTableCreated(io, socket, data) {
  const player = connectedPlayers.get(socket.id);
  if (!player || !player.currentTableId) return;

  const tableState = tableStates.get(player.currentTableId);
  if (!tableState) return;

  tableState.blockchainTableId = data.blockchainTableId;
  console.log(`Blockchain table ${data.blockchainTableId} linked to server table ${player.currentTableId}`);
  
  io.to(player.currentTableId).emit('blockchain_table_linked', {
    blockchainTableId: data.blockchainTableId
  });
}

function handleDisconnect(io, socket) {
  const player = connectedPlayers.get(socket.id);

  if (player) {
    const tableId = player.currentTableId;
    const tableState = tableId ? tableStates.get(tableId) : null;

    if (tableState && tableState.gameInProgress) {
      console.log(`Player ${player.walletAddress} disconnected during game, waiting for reconnect...`);
      
      socket.to(tableId).emit('player_temporarily_disconnected', {
        walletAddress: player.walletAddress
      });

      const timeoutId = setTimeout(() => {
        console.log(`Player ${player.walletAddress} did not reconnect, removing from game`);
        
        const currentPlayer = Array.from(connectedPlayers.values())
          .find(p => p.walletAddress === player.walletAddress);
        
        if (!currentPlayer || currentPlayer.currentTableId !== tableId) {
          const gameService = activeGames.get(tableId);
          if (gameService) {
            const result = gameService.handlePlayerDisconnect(socket.id);
            if (result) {
              const gameState = gameService.getGameState();
              io.to(tableId).emit('player_disconnected', {
                walletAddress: player.walletAddress,
                gameEnded: result.gameEnded,
                gameState
              });

              if (result.gameEnded) {
                if (tableState.blockchainTableId !== null) {
                  const winner = gameState.finishOrder?.[0] || 
                    gameState.players.find(p => p.walletAddress !== gameState.loser)?.walletAddress;
                  if (winner) {
                    blockchainService.finishGame(tableState.blockchainTableId, winner);
                  }
                }
                endGame(io, tableId);
              }
            }
          }

          tableState.players = tableState.players.filter(p => p.walletAddress !== player.walletAddress);
        }

        disconnectTimeouts.delete(player.walletAddress);
      }, RECONNECT_TIMEOUT);

      disconnectTimeouts.set(player.walletAddress, timeoutId);
    } else {
      if (player.currentTableId) {
        leaveCurrentTable(io, socket, player);
      }
    }

    connectedPlayers.delete(socket.id);
    console.log(`Player disconnected: ${player.walletAddress}`);
  } else {
    console.log(`Socket disconnected: ${socket.id}`);
  }
}

module.exports = {
  setupSocketHandlers,
  connectedPlayers,
  tableStates,
  activeGames
};
