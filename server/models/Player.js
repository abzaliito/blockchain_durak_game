class Player {
  constructor(socketId, walletAddress) {
    this.socketId = socketId;
    this.walletAddress = walletAddress;
    this.hand = [];
    this.isReady = false;
    this.isOut = false;
    this.finishPosition = null;
  }

  addCards(cards) {
    this.hand.push(...cards);
  }

  addCard(card) {
    this.hand.push(card);
  }

  removeCard(card) {
    const index = this.hand.findIndex(
      c => c.suit === card.suit && c.rank === card.rank
    );
    if (index !== -1) {
      return this.hand.splice(index, 1)[0];
    }
    return null;
  }

  hasCard(card) {
    return this.hand.some(
      c => c.suit === card.suit && c.rank === card.rank
    );
  }

  getCardByRank(rank) {
    return this.hand.filter(c => c.rank === rank);
  }

  getCardsCount() {
    return this.hand.length;
  }

  hasCards() {
    return this.hand.length > 0;
  }

  sortHand(trumpSuit) {
    this.hand.sort((a, b) => {
      if (a.suit === trumpSuit && b.suit !== trumpSuit) return 1;
      if (a.suit !== trumpSuit && b.suit === trumpSuit) return -1;
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return a.value - b.value;
    });
  }

  setOut(position) {
    this.isOut = true;
    this.finishPosition = position;
  }

  reset() {
    this.hand = [];
    this.isReady = false;
    this.isOut = false;
    this.finishPosition = null;
  }

  toJSON(hideCards = false) {
    return {
      socketId: this.socketId,
      walletAddress: this.walletAddress,
      cardsCount: this.hand.length,
      hand: hideCards ? [] : this.hand.map(c => c.toJSON()),
      isReady: this.isReady,
      isOut: this.isOut,
      finishPosition: this.finishPosition
    };
  }
}

module.exports = Player;
