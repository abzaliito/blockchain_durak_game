export const CONTRACTS = {
  CHIPS_ADDRESS: import.meta.env.VITE_CHIPS_ADDRESS || '',
  XP_ADDRESS: import.meta.env.VITE_XP_ADDRESS || '',
  LOBBY_ADDRESS: import.meta.env.VITE_LOBBY_ADDRESS || '',
  RPC_URL: import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545',
  CHAIN_ID: parseInt(import.meta.env.VITE_CHAIN_ID || '31337'),
};

export const CHIPS_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function claimFreeChips() external',
  'function hasClaimed(address) view returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function buyChips() payable',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const XP_ABI = [
  'function balanceOf(address) view returns (uint256)',
];

export const LOBBY_ABI = [
  'function createTable(string name, uint256 entryFee) external returns (uint256)',
  'function joinTable(uint256 tableId) external',
  'function leaveTable(uint256 tableId) external',
  'function finishGame(uint256 tableId, address winner) external',
  'event TableCreated(uint256 indexed tableId, string name, uint256 entryFee, address creator)',
  'event PlayerJoined(uint256 indexed tableId, address player)',
];
