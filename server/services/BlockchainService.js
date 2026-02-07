const { ethers } = require('ethers');
require('dotenv').config({ path: '.env' });

const LOBBY_ABI = [
  "function finishGame(uint256 _tableId, address _winner) external",
  "function tables(uint256) view returns (uint256 id, string name, uint256 entryFee, bool isActive, uint256 totalPot)",
  "function getPlayers(uint256 _tableId) view returns (address[])"
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.lobbyContract = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      const privateKey = process.env.PRIVATE_KEY;
      const lobbyAddress = process.env.LOBBY_ADDRESS;

      if (!privateKey || !lobbyAddress) {
        console.log('Blockchain service: Missing PRIVATE_KEY or LOBBY_ADDRESS in .env');
        return false;
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.lobbyContract = new ethers.Contract(lobbyAddress, LOBBY_ABI, this.signer);
      
      this.initialized = true;
      console.log('Blockchain service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error.message);
      return false;
    }
  }

  async finishGame(blockchainTableId, winnerAddress) {
    if (!this.initialized) {
      console.log('Blockchain service not initialized, skipping finishGame');
      return false;
    }

    if (blockchainTableId === null || blockchainTableId === undefined) {
      console.log('No blockchain table ID, skipping finishGame');
      return false;
    }

    try {
      console.log(`Calling finishGame: tableId=${blockchainTableId}, winner=${winnerAddress}`);
      const tx = await this.lobbyContract.finishGame(blockchainTableId, winnerAddress);
      await tx.wait();
      console.log(`finishGame transaction confirmed: ${tx.hash}`);
      return true;
    } catch (error) {
      console.error('finishGame error:', error.message);
      return false;
    }
  }

  async getTableInfo(blockchainTableId) {
    if (!this.initialized) return null;
    
    try {
      const table = await this.lobbyContract.tables(blockchainTableId);
      return {
        id: Number(table.id),
        name: table.name,
        entryFee: table.entryFee,
        isActive: table.isActive,
        totalPot: table.totalPot
      };
    } catch (error) {
      console.error('getTableInfo error:', error.message);
      return null;
    }
  }
}

const blockchainService = new BlockchainService();

module.exports = blockchainService;
