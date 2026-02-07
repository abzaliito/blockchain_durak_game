const SUITS = {
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
  SPADES: 'spades'
};

const RANKS = {
  SIX: { name: '6', value: 6 },
  SEVEN: { name: '7', value: 7 },
  EIGHT: { name: '8', value: 8 },
  NINE: { name: '9', value: 9 },
  TEN: { name: '10', value: 10 },
  JACK: { name: 'J', value: 11 },
  QUEEN: { name: 'Q', value: 12 },
  KING: { name: 'K', value: 13 },
  ACE: { name: 'A', value: 14 }
};

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank.name;
    this.value = rank.value;
  }

  canBeat(otherCard, trumpSuit) {
    if (this.suit === trumpSuit && otherCard.suit !== trumpSuit) {
      return true;
    }

    if (this.suit !== trumpSuit && otherCard.suit === trumpSuit) {
      return false;
    }

    if (this.suit !== otherCard.suit) {
      return false;
    }

    return this.value > otherCard.value;
  }

  toJSON() {
    return {
      suit: this.suit,
      rank: this.rank,
      value: this.value
    };
  }
}

module.exports = {
  Card,
  SUITS,
  RANKS
};
