const Deck = require('./Deck');
const Player = require('./Player');

const GAME_STATE = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

const CARDS_PER_PLAYER = 6;

class Game {
  constructor(tableId, gameMode, playerDataList) {
    this.tableId = tableId;
    this.gameMode = gameMode;
    this.state = GAME_STATE.WAITING;

    this.deck = new Deck();
    this.players = [];
    this.activePlayers = [];

    this.attackerIndex = 0;
    this.defenderIndex = 1;
    this.currentAttackerIndex = 0;

    this.tableCards = [];
    this.discardPile = [];

    this.finishOrder = [];
    this.loser = null;

    this.initPlayers(playerDataList);
  }

  initPlayers(playerDataList) {
    playerDataList.forEach(data => {
      const player = new Player(data.socketId, data.walletAddress);
      this.players.push(player);
      this.activePlayers.push(player);
    });
  }

  getPlayerBySocketId(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  getPlayerIndex(socketId) {
    return this.players.findIndex(p => p.socketId === socketId);
  }

  getAttacker() {
    return this.players[this.attackerIndex];
  }

  getDefender() {
    return this.players[this.defenderIndex];
  }

  getUndefendedCards() {
    return this.tableCards.filter(tc => !tc.defendedBy);
  }

  getAllTableCardRanks() {
    const ranks = new Set();
    this.tableCards.forEach(tc => {
      ranks.add(tc.card.rank);
      if (tc.defendedBy) {
        ranks.add(tc.defendedBy.rank);
      }
    });
    return ranks;
  }

  addToTable(card, attackerIndex) {
    this.tableCards.push({
      card,
      attackerIndex,
      defendedBy: null
    });
  }

  clearTable() {
    this.tableCards = [];
  }

  moveTableToDiscard() {
    this.tableCards.forEach(tc => {
      this.discardPile.push(tc.card);
      if (tc.defendedBy) {
        this.discardPile.push(tc.defendedBy);
      }
    });
    this.clearTable();
  }

  collectTableCards() {
    const allCards = [];
    this.tableCards.forEach(tc => {
      allCards.push(tc.card);
      if (tc.defendedBy) {
        allCards.push(tc.defendedBy);
      }
    });
    return allCards;
  }

  removeFromActivePlayers(player) {
    this.activePlayers = this.activePlayers.filter(p => p !== player);
  }

  getNextActivePlayerIndex(currentIndex) {
    let nextIndex = currentIndex;
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
      if (this.activePlayers.includes(this.players[nextIndex])) {
        return nextIndex;
      }
    } while (nextIndex !== currentIndex);
    return currentIndex;
  }

  getPlayerState(socketId) {
    const player = this.getPlayerBySocketId(socketId);
    if (!player) return null;

    return {
      hand: player.hand.map(c => c.toJSON()),
      cardsCount: player.getCardsCount(),
      isOut: player.isOut,
      finishPosition: player.finishPosition
    };
  }

  toJSON() {
    return {
      tableId: this.tableId,
      gameMode: this.gameMode,
      state: this.state,
      deck: this.deck.toJSON(),
      players: this.players.map(p => p.toJSON(true)),
      attackerIndex: this.attackerIndex,
      defenderIndex: this.defenderIndex,
      currentAttackerIndex: this.currentAttackerIndex,
      tableCards: this.tableCards.map(tc => ({
        card: tc.card.toJSON(),
        attackerIndex: tc.attackerIndex,
        defendedBy: tc.defendedBy ? tc.defendedBy.toJSON() : null
      })),
      finishOrder: this.finishOrder.map(p => p.walletAddress),
      loser: this.loser ? this.loser.walletAddress : null
    };
  }
}

module.exports = {
  Game,
  GAME_STATE,
  CARDS_PER_PLAYER
};
