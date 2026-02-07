const GAME_MODE = {
  PODKIDNOY: 'podkidnoy',
  PEREVODNOY: 'perevodnoy'
};

const tables = [
  {
    id: 'table_2p_low_podkidnoy',
    name: '2 player table - Low stake',
    maxPlayers: 2,
    stake: 10,
    gameMode: GAME_MODE.PODKIDNOY
  },
  {
    id: 'table_2p_mid_podkidnoy',
    name: '2 player table - Medium stake',
    maxPlayers: 2,
    stake: 25,
    gameMode: GAME_MODE.PODKIDNOY
  },
  {
    id: 'table_2p_high_podkidnoy',
    name: '2 player table - High stake',
    maxPlayers: 2,
    stake: 50,
    gameMode: GAME_MODE.PODKIDNOY
  },
  {
    id: 'table_3p_low_podkidnoy',
    name: '3 player table - Low stake',
    maxPlayers: 3,
    stake: 10,
    gameMode: GAME_MODE.PODKIDNOY
  },
  {
    id: 'table_4p_low_podkidnoy',
    name: '4 player table - Low stake',
    maxPlayers: 4,
    stake: 10,
    gameMode: GAME_MODE.PODKIDNOY
  },
  {
    id: 'table_2p_low_perevodnoy',
    name: '2 player table - Perevodnoy',
    maxPlayers: 2,
    stake: 10,
    gameMode: GAME_MODE.PEREVODNOY
  },
  {
    id: 'table_3p_low_perevodnoy',
    name: '3 player table - Perevodnoy',
    maxPlayers: 3,
    stake: 10,
    gameMode: GAME_MODE.PEREVODNOY
  }
];

module.exports = {
  tables,
  GAME_MODE
};
