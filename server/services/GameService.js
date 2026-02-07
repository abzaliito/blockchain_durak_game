const { Game, GAME_STATE, CARDS_PER_PLAYER } = require('../models/Game');
const { GAME_MODE } = require('../config/tables');

class GameService {
  constructor(game) {
    this.game = game;
  }

  static createGame(tableId, gameMode, playerDataList) {
    const game = new Game(tableId, gameMode, playerDataList);
    return new GameService(game);
  }

  start() {
    this.game.state = GAME_STATE.PLAYING;
    this.game.deck.setTrump();
    this.dealInitialCards();
    this.determineFirstAttacker();
    this.game.defenderIndex = this.game.getNextActivePlayerIndex(this.game.attackerIndex);
    this.game.currentAttackerIndex = this.game.attackerIndex;

    return this.game.toJSON();
  }

  dealInitialCards() {
    this.game.players.forEach(player => {
      const cards = this.game.deck.drawCards(CARDS_PER_PLAYER);
      player.addCards(cards);
      player.sortHand(this.game.deck.trumpSuit);
    });
  }

  determineFirstAttacker() {
    let lowestTrump = null;
    let lowestTrumpPlayerIndex = 0;

    this.game.players.forEach((player, index) => {
      player.hand.forEach(card => {
        if (card.suit === this.game.deck.trumpSuit) {
          if (!lowestTrump || card.value < lowestTrump.value) {
            lowestTrump = card;
            lowestTrumpPlayerIndex = index;
          }
        }
      });
    });

    this.game.attackerIndex = lowestTrumpPlayerIndex;
  }

  attack(socketId, card) {
    const playerIndex = this.game.getPlayerIndex(socketId);
    const player = this.game.players[playerIndex];

    if (!player || player.isOut) {
      return { success: false, error: 'Invalid player' };
    }

    if (!this.canPlayerAttack(playerIndex)) {
      return { success: false, error: 'Not your turn to attack' };
    }

    if (!this.isValidAttackCard(card)) {
      return { success: false, error: 'Invalid attack card' };
    }

    const defender = this.game.getDefender();
    const maxCards = Math.min(6, defender.getCardsCount());

    if (this.game.tableCards.length >= maxCards) {
      return { success: false, error: 'Cannot add more cards' };
    }

    const removedCard = player.removeCard(card);
    if (!removedCard) {
      return { success: false, error: 'Card not in hand' };
    }

    this.game.addToTable(removedCard, playerIndex);
    this.game.currentAttackerIndex = playerIndex;
    this.checkPlayerOut(player);

    return { success: true, card: removedCard.toJSON() };
  }

  canPlayerAttack(playerIndex) {
    if (this.game.tableCards.length === 0) {
      return playerIndex === this.game.attackerIndex;
    }

    if (playerIndex === this.game.defenderIndex) {
      return false;
    }

    return this.game.activePlayers.includes(this.game.players[playerIndex]);
  }

  isValidAttackCard(card) {
    if (this.game.tableCards.length === 0) {
      return true;
    }

    const tableRanks = this.game.getAllTableCardRanks();
    return tableRanks.has(card.rank);
  }

  defend(socketId, attackCard, defenseCard) {
    const playerIndex = this.game.getPlayerIndex(socketId);
    const player = this.game.players[playerIndex];

    if (!player || playerIndex !== this.game.defenderIndex) {
      return { success: false, error: 'Not your turn to defend' };
    }

    const tableEntry = this.game.tableCards.find(
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

    if (!defCard.canBeat(tableEntry.card, this.game.deck.trumpSuit)) {
      return { success: false, error: 'Card cannot beat the attack card' };
    }

    const removedCard = player.removeCard(defenseCard);
    tableEntry.defendedBy = removedCard;

    this.checkPlayerOut(player);

    return { success: true, attackCard, defenseCard: removedCard.toJSON() };
  }

  transfer(socketId, card) {
    if (this.game.gameMode !== GAME_MODE.PEREVODNOY) {
      return { success: false, error: 'Transfer not allowed in this game mode' };
    }

    const playerIndex = this.game.getPlayerIndex(socketId);
    const player = this.game.players[playerIndex];

    if (!player || playerIndex !== this.game.defenderIndex) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.game.tableCards.some(tc => tc.defendedBy)) {
      return { success: false, error: 'Cannot transfer after defending' };
    }

    const canTransfer = this.game.tableCards.every(tc => tc.card.rank === card.rank);
    if (!canTransfer) {
      return { success: false, error: 'Card rank must match all attack cards' };
    }

    const nextDefenderIndex = this.game.getNextActivePlayerIndex(this.game.defenderIndex);
    const nextDefender = this.game.players[nextDefenderIndex];

    if (this.game.tableCards.length + 1 > nextDefender.getCardsCount()) {
      return { success: false, error: 'Next player has too few cards' };
    }

    const removedCard = player.removeCard(card);
    if (!removedCard) {
      return { success: false, error: 'Card not in hand' };
    }

    this.game.addToTable(removedCard, playerIndex);
    this.game.defenderIndex = nextDefenderIndex;
    this.checkPlayerOut(player);

    return {
      success: true,
      card: removedCard.toJSON(),
      newDefenderIndex: this.game.defenderIndex,
      newDefenderWallet: nextDefender.walletAddress
    };
  }

  takeCards(socketId) {
    const playerIndex = this.game.getPlayerIndex(socketId);
    const player = this.game.players[playerIndex];

    if (!player || playerIndex !== this.game.defenderIndex) {
      return { success: false, error: 'Not your turn' };
    }

    const allCards = this.game.collectTableCards();
    player.addCards(allCards);
    player.sortHand(this.game.deck.trumpSuit);

    this.game.clearTable();
    this.drawCardsForPlayers();

    this.game.attackerIndex = this.game.getNextActivePlayerIndex(this.game.defenderIndex);
    this.game.defenderIndex = this.game.getNextActivePlayerIndex(this.game.attackerIndex);
    this.game.currentAttackerIndex = this.game.attackerIndex;

    return { success: true, cardsTaken: allCards.length };
  }

  endAttack(socketId) {
    const playerIndex = this.game.getPlayerIndex(socketId);

    if (!this.canPlayerAttack(playerIndex)) {
      return { success: false, error: 'Not your turn' };
    }

    const undefended = this.game.getUndefendedCards();
    if (undefended.length > 0) {
      return { success: false, error: 'There are undefended cards' };
    }

    this.game.moveTableToDiscard();
    this.drawCardsForPlayers();

    this.game.attackerIndex = this.game.defenderIndex;
    this.game.defenderIndex = this.game.getNextActivePlayerIndex(this.game.attackerIndex);
    this.game.currentAttackerIndex = this.game.attackerIndex;

    const gameEnded = this.checkGameEnd();

    return { success: true, gameEnded };
  }

  pass(socketId) {
    const playerIndex = this.game.getPlayerIndex(socketId);

    if (!this.canPlayerAttack(playerIndex)) {
      return { success: false, error: 'Not your turn' };
    }

    if (playerIndex === this.game.attackerIndex) {
      return { success: false, error: 'Main attacker cannot pass' };
    }

    return { success: true };
  }

  drawCardsForPlayers() {
    const drawOrder = this.getDrawOrder();

    drawOrder.forEach(playerIdx => {
      const player = this.game.players[playerIdx];
      while (player.getCardsCount() < CARDS_PER_PLAYER && !this.game.deck.isEmpty()) {
        const card = this.game.deck.drawCard();
        if (card) {
          player.addCard(card);
        }
      }
      player.sortHand(this.game.deck.trumpSuit);
    });
  }

  getDrawOrder() {
    const drawOrder = [];
    let idx = this.game.attackerIndex;

    do {
      if (this.game.activePlayers.includes(this.game.players[idx])) {
        drawOrder.push(idx);
      }
      idx = (idx + 1) % this.game.players.length;
    } while (idx !== this.game.attackerIndex);

    return drawOrder;
  }

  checkPlayerOut(player) {
    if (!player.hasCards() && this.game.deck.isEmpty()) {
      player.setOut(this.game.finishOrder.length + 1);
      this.game.finishOrder.push(player);
      this.game.removeFromActivePlayers(player);
      return true;
    }
    return false;
  }

  checkGameEnd() {
    const playersWithCards = this.game.activePlayers.filter(p => p.hasCards());

    if (playersWithCards.length <= 1) {
      this.game.state = GAME_STATE.FINISHED;

      if (playersWithCards.length === 1) {
        this.game.loser = playersWithCards[0];
        this.game.loser.setOut(this.game.players.length);
      }

      return true;
    }

    return false;
  }

  handlePlayerDisconnect(socketId) {
    const player = this.game.getPlayerBySocketId(socketId);
    if (!player || player.isOut) return null;

    player.setOut(this.game.players.length);
    this.game.removeFromActivePlayers(player);

    const playerIndex = this.game.getPlayerIndex(socketId);

    if (playerIndex === this.game.defenderIndex) {
      const allCards = this.game.collectTableCards();
      this.game.discardPile.push(...allCards, ...player.hand);
      player.hand = [];
      this.game.clearTable();

      this.game.attackerIndex = this.game.getNextActivePlayerIndex(playerIndex);
      this.game.defenderIndex = this.game.getNextActivePlayerIndex(this.game.attackerIndex);
    } else if (playerIndex === this.game.attackerIndex) {
      this.game.attackerIndex = this.game.getNextActivePlayerIndex(playerIndex);
      if (this.game.defenderIndex === this.game.attackerIndex) {
        this.game.defenderIndex = this.game.getNextActivePlayerIndex(this.game.attackerIndex);
      }
    }

    this.game.currentAttackerIndex = this.game.attackerIndex;

    this.game.discardPile.push(...player.hand);
    player.hand = [];

    const gameEnded = this.checkGameEnd();

    return {
      disconnectedPlayer: player.walletAddress,
      gameEnded,
      newAttackerIndex: this.game.attackerIndex,
      newDefenderIndex: this.game.defenderIndex
    };
  }

  getGameState() {
    return this.game.toJSON();
  }

  getPlayerState(socketId) {
    return this.game.getPlayerState(socketId);
  }
}

module.exports = GameService;
