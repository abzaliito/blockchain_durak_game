const Deck = require('./Deck');
const Player = require('./Player');
const { GAME_MODE } = require('../config/tables');

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
    this.defendedCards = [];
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

  start() {
    this.state = GAME_STATE.PLAYING;
    this.deck.setTrump();
    this.dealInitialCards();
    this.determineFirstAttacker();
    this.defenderIndex = this.getNextActivePlayerIndex(this.attackerIndex);
    this.currentAttackerIndex = this.attackerIndex;

    return this.getGameState();
  }

  dealInitialCards() {
    this.players.forEach(player => {
      const cards = this.deck.drawCards(CARDS_PER_PLAYER);
      player.addCards(cards);
      player.sortHand(this.deck.trumpSuit);
    });
  }

  determineFirstAttacker() {
    let lowestTrump = null;
    let lowestTrumpPlayerIndex = 0;

    this.players.forEach((player, index) => {
      player.hand.forEach(card => {
        if (card.suit === this.deck.trumpSuit) {
          if (!lowestTrump || card.value < lowestTrump.value) {
            lowestTrump = card;
            lowestTrumpPlayerIndex = index;
          }
        }
      });
    });

    this.attackerIndex = lowestTrumpPlayerIndex;
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

  getPrevActivePlayerIndex(currentIndex) {
    let prevIndex = currentIndex;
    do {
      prevIndex = (prevIndex - 1 + this.players.length) % this.players.length;
      if (this.activePlayers.includes(this.players[prevIndex])) {
        return prevIndex;
      }
    } while (prevIndex !== currentIndex);
    return currentIndex;
  }

  attack(socketId, card) {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId);
    const player = this.players[playerIndex];

    if (!player || player.isOut) {
      return { success: false, error: 'Invalid player' };
    }

    if (!this.canPlayerAttack(playerIndex)) {
      return { success: false, error: 'Not your turn to attack' };
    }

    if (!this.isValidAttackCard(card)) {
      return { success: false, error: 'Invalid attack card' };
    }

    const defender = this.players[this.defenderIndex];
    const maxCards = Math.min(6, defender.getCardsCount());

    if (this.tableCards.length >= maxCards) {
      return { success: false, error: 'Cannot add more cards' };
    }

    const removedCard = player.removeCard(card);
    if (!removedCard) {
      return { success: false, error: 'Card not in hand' };
    }

    this.tableCards.push({
      card: removedCard,
      attackerIndex: playerIndex,
      defendedBy: null
    });

    this.currentAttackerIndex = playerIndex;
    this.checkPlayerOut(player);

    return { success: true, card: removedCard.toJSON() };
  }

  canPlayerAttack(playerIndex) {
    if (this.tableCards.length === 0) {
      return playerIndex === this.attackerIndex;
    }

    if (playerIndex === this.defenderIndex) {
      return false;
    }

    return this.activePlayers.includes(this.players[playerIndex]);
  }

  isValidAttackCard(card) {
    if (this.tableCards.length === 0) {
      return true;
    }

    const tableRanks = new Set();
    this.tableCards.forEach(tc => {
      tableRanks.add(tc.card.rank);
      if (tc.defendedBy) {
        tableRanks.add(tc.defendedBy.rank);
      }
    });

    return tableRanks.has(card.rank);
  }

  defend(socketId, attackCard, defenseCard) {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId);
    const player = this.players[playerIndex];

    if (!player || playerIndex !== this.defenderIndex) {
      return { success: false, error: 'Not your turn to defend' };
    }

    const tableEntry = this.tableCards.find(
      tc => tc.card.suit === attackCard.suit &&
            tc.card.rank === attackCard.rank &&
            !tc.defendedBy
    );

    if (!tableEntry) {
      return { success: false, error: 'Attack card not found or already defended' };
    }

    if (!player.hasCard(defenseCard)) {
      return { success: false, error: 'Defense card not in hand' };
    }

    const defCard = player.hand.find(
      c => c.suit === defenseCard.suit && c.rank === defenseCard.rank
    );

    if (!defCard.canBeat(tableEntry.card, this.deck.trumpSuit)) {
      return { success: false, error: 'Card cannot beat the attack card' };
    }

    const removedCard = player.removeCard(defenseCard);
    tableEntry.defendedBy = removedCard;

    this.checkPlayerOut(player);

    return { success: true, attackCard: attackCard, defenseCard: removedCard.toJSON() };
  }

  transfer(socketId, card) {
    if (this.gameMode !== GAME_MODE.PEREVODNOY) {
      return { success: false, error: 'Transfer not allowed in this game mode' };
    }

    const playerIndex = this.players.findIndex(p => p.socketId === socketId);
    const player = this.players[playerIndex];

    if (!player || playerIndex !== this.defenderIndex) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.tableCards.some(tc => tc.defendedBy)) {
      return { success: false, error: 'Cannot transfer after defending' };
    }

    const canTransfer = this.tableCards.every(tc => tc.card.rank === card.rank);
    if (!canTransfer) {
      return { success: false, error: 'Card rank must match all attack cards' };
    }

    const nextDefenderIndex = this.getNextActivePlayerIndex(this.defenderIndex);
    const nextDefender = this.players[nextDefenderIndex];

    if (this.tableCards.length + 1 > nextDefender.getCardsCount()) {
      return { success: false, error: 'Next player has too few cards' };
    }

    const removedCard = player.removeCard(card);
    if (!removedCard) {
      return { success: false, error: 'Card not in hand' };
    }

    this.tableCards.push({
      card: removedCard,
      attackerIndex: playerIndex,
      defendedBy: null
    });

    this.defenderIndex = nextDefenderIndex;
    this.checkPlayerOut(player);

    return {
      success: true,
      card: removedCard.toJSON(),
      newDefenderIndex: this.defenderIndex
    };
  }

  takeCards(socketId) {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId);
    const player = this.players[playerIndex];

    if (!player || playerIndex !== this.defenderIndex) {
      return { success: false, error: 'Not your turn' };
    }

    const allCards = [];
    this.tableCards.forEach(tc => {
      allCards.push(tc.card);
      if (tc.defendedBy) {
        allCards.push(tc.defendedBy);
      }
    });

    player.addCards(allCards);
    player.sortHand(this.deck.trumpSuit);

    this.tableCards = [];

    this.drawCardsForPlayers();

    this.attackerIndex = this.getNextActivePlayerIndex(this.defenderIndex);
    this.defenderIndex = this.getNextActivePlayerIndex(this.attackerIndex);
    this.currentAttackerIndex = this.attackerIndex;

    return { success: true, cardsTaken: allCards.length };
  }

  endAttack(socketId) {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId);

    if (!this.canPlayerAttack(playerIndex)) {
      return { success: false, error: 'Not your turn' };
    }

    const undefended = this.tableCards.filter(tc => !tc.defendedBy);
    if (undefended.length > 0) {
      return { success: false, error: 'There are undefended cards' };
    }

    this.tableCards.forEach(tc => {
      this.discardPile.push(tc.card);
      this.discardPile.push(tc.defendedBy);
    });
    this.tableCards = [];

    this.drawCardsForPlayers();

    this.attackerIndex = this.defenderIndex;
    this.defenderIndex = this.getNextActivePlayerIndex(this.attackerIndex);
    this.currentAttackerIndex = this.attackerIndex;

    const gameEnded = this.checkGameEnd();

    return { success: true, gameEnded };
  }

  drawCardsForPlayers() {
    const drawOrder = [];
    let idx = this.attackerIndex;

    do {
      if (this.activePlayers.includes(this.players[idx])) {
        drawOrder.push(idx);
      }
      idx = (idx + 1) % this.players.length;
    } while (idx !== this.attackerIndex);

    drawOrder.forEach(playerIdx => {
      const player = this.players[playerIdx];
      while (player.getCardsCount() < CARDS_PER_PLAYER && !this.deck.isEmpty()) {
        const card = this.deck.drawCard();
        if (card) {
          player.addCard(card);
        }
      }
      player.sortHand(this.deck.trumpSuit);
    });
  }

  checkPlayerOut(player) {
    if (!player.hasCards() && this.deck.isEmpty()) {
      player.setOut(this.finishOrder.length + 1);
      this.finishOrder.push(player);
      this.activePlayers = this.activePlayers.filter(p => p !== player);
    }
  }

  checkGameEnd() {
    const playersWithCards = this.activePlayers.filter(p => p.hasCards());

    if (playersWithCards.length <= 1) {
      this.state = GAME_STATE.FINISHED;

      if (playersWithCards.length === 1) {
        this.loser = playersWithCards[0];
        this.loser.setOut(this.players.length);
      }

      return true;
    }

    return false;
  }

  getPlayerState(socketId) {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player) return null;

    return {
      hand: player.hand.map(c => c.toJSON()),
      cardsCount: player.getCardsCount(),
      isOut: player.isOut,
      finishPosition: player.finishPosition
    };
  }

  getGameState() {
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
  GAME_STATE
};
