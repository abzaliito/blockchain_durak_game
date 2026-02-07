const { tables } = require('../config/tables');

const connectedPlayers = new Map();

const tableStates = new Map();

function initializeTables() {
  tables.forEach(table => {
    tableStates.set(table.id, {
      ...table,
      players: [],
      readyPlayers: new Set(),
      gameInProgress: false,
      game: null
    });
  });
}

function setupSocketHandlers(io) {
  initializeTables();

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('auth', (data) => {
      handleAuth(socket, data);
    });

    socket.on('get_tables', () => {
      handleGetTables(socket);
    });

    socket.on('join_table', (data) => {
      handleJoinTable(io, socket, data);
    });

    socket.on('leave_table', () => {
      handleLeaveTable(io, socket);
    });

    socket.on('player_ready', () => {
      handlePlayerReady(io, socket);
    });

    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
    });
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

  tableStates.forEach((state, id) => {
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
    players: tableState.players.map(p => ({
      walletAddress: p.walletAddress,
      isReady: tableState.readyPlayers.has(p.socketId)
    }))
  });

  socket.to(tableId).emit('player_joined', {
    walletAddress: player.walletAddress
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

  tableState.players = tableState.players.filter(p => p.socketId !== socket.id);
  tableState.readyPlayers.delete(socket.id);

  socket.leave(tableId);
  player.currentTableId = null;

  socket.to(tableId).emit('player_left', {
    walletAddress: player.walletAddress
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

  if (!tableState) return;

  if (tableState.gameInProgress) {
    socket.emit('error', { message: 'Game already in progress' });
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

  io.to(tableState.id).emit('game_starting', {
    tableId: tableState.id,
    players: tableState.players.map(p => p.walletAddress),
    gameMode: tableState.gameMode
  });

  console.log(`Game starting at table ${tableState.id}`);
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
  tableStates
};
