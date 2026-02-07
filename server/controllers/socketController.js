const { tables } = require('../config/tables');
const GameService = require('../services/GameService');

const connectedPlayers = new Map();
const tableStates = new Map();
const activeGames = new Map();

function initializeTables() {
  tables.forEach(table => {
    tableStates.set(table.id, {
      ...table,
      players: [],
      readyPlayers: new Set(),
      gameInProgress: false
    });
  });
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

  connectedPlayers.set(socket.id, {
    socketId: socket.id,
    walletAddress: walletAddress.toLowerCase(),
    currentTableId: null
  });

  socket.emit('auth_success', {
    message: 'Authenticated successfully',
    walletAddress: walletAddress.toLowerCase()
  });

  console.log(`Player authenticated: ${walletAddress}`);
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
    }))
  });

  socket.to(tableId).emit('player_joined', {
    walletAddress: player.walletAddress,
    playersCount: tableState.players.length
  });

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
        io.to(tableId).emit('player_disconnected', {
          walletAddress: player.walletAddress,
          gameEnded: result.gameEnded,
          gameState: gameService.getGameState()
        });

        if (result.gameEnded) {
          endGame(io, tableId);
        }
      }
    }
  }

  tableState.players = tableState.players.filter(p => p.socketId !== socket.id);
  tableState.readyPlayers.delete(socket.id);

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
        yourHand: gameService.getPlayerState(p.socketId)
      });
    }
  });

  console.log(`Game started at table ${tableState.id}`);
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

  broadcastGameUpdate(io, player.currentTableId, 'card_played', {
    action: 'attack',
    walletAddress: player.walletAddress,
    card: result.card
  });
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

  broadcastGameUpdate(io, player.currentTableId, 'card_played', {
    action: 'defend',
    walletAddress: player.walletAddress,
    attackCard: result.attackCard,
    defenseCard: result.defenseCard
  });
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

  broadcastGameUpdate(io, player.currentTableId, 'cards_taken', {
    walletAddress: player.walletAddress,
    cardsTaken: result.cardsTaken
  });
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
        yourHand: gameService.getPlayerState(p.socketId)
      });
    }
  });
}

function broadcastGameEnd(io, tableId) {
  const gameService = activeGames.get(tableId);
  if (!gameService) return;

  const gameState = gameService.getGameState();

  io.to(tableId).emit('game_ended', {
    gameState,
    loser: gameState.loser,
    finishOrder: gameState.finishOrder
  });

  endGame(io, tableId);
}

function endGame(io, tableId) {
  const tableState = tableStates.get(tableId);

  if (tableState) {
    tableState.gameInProgress = false;
    tableState.readyPlayers.clear();
  }

  activeGames.delete(tableId);

  console.log(`Game ended at table ${tableId}`);
}

function handleDisconnect(io, socket) {
  const player = connectedPlayers.get(socket.id);

  if (player) {
    if (player.currentTableId) {
      leaveCurrentTable(io, socket, player);
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
