export const CHIPS_ABI = [
  "function buyChips() public payable",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function RATE() view returns (uint256)"
];

export const XP_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

export const LOBBY_ABI = [
  "function createTable(string memory _name, uint256 _entryFee) external",
  "function joinTable(uint256 _tableId) external",
  "function finishGame(uint256 _tableId, address _winner) external",
  "function getPlayers(uint256 _tableId) external view returns (address[] memory)",
  "function tables(uint256) view returns (uint256 id, string name, uint256 entryFee, bool isActive, uint256 totalPot)",
  "event TableCreated(uint256 tableId, string name, uint256 entryFee, address creator)",
  "event PlayerJoined(uint256 tableId, address player)",
  "event GameFinished(uint256 tableId, address winner, uint256 potWon)"
];
