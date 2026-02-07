const { Card, SUITS, RANKS } = require('./Card');

class Deck {
  constructor() {
    this.cards = [];
    this.trumpCard = null;
    this.trumpSuit = null;
    this.init();
  }

  init() {
    this.cards = [];

    Object.values(SUITS).forEach(suit => {
      Object.values(RANKS).forEach(rank => {
        this.cards.push(new Card(suit, rank));
      });
    });

    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  drawCard() {
    if (this.cards.length === 0) {
      return null;
    }
    return this.cards.pop();
  }

  drawCards(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const card = this.drawCard();
      if (card) {
        drawn.push(card);
      }
    }
    return drawn;
  }

  setTrump() {
    if (this.cards.length > 0) {
      this.trumpCard = this.cards[0];
      this.trumpSuit = this.trumpCard.suit;
    }
    return this.trumpCard;
  }

  takeTrumpCard() {
    if (this.trumpCard && this.cards.length > 0) {
      const card = this.cards.shift();
      this.trumpCard = null;
      return card;
    }
    return null;
  }

  getCardsCount() {
    return this.cards.length;
  }

  isEmpty() {
    return this.cards.length === 0;
  }

  toJSON() {
    return {
      cardsLeft: this.cards.length,
      trumpCard: this.trumpCard ? this.trumpCard.toJSON() : null,
      trumpSuit: this.trumpSuit
    };
  }
}

module.exports = Deck;
