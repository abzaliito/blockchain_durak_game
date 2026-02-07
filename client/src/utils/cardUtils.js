export const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

export const SUIT_COLORS = {
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#1e293b',
  spades: '#1e293b'
};

export function getCardId(card) {
  return `${card.rank}-${card.suit}`;
}

export function isSameCard(card1, card2) {
  if (!card1 || !card2) return false;
  return card1.rank === card2.rank && card1.suit === card2.suit;
}

export function canCardBeat(defenseCard, attackCard, trumpSuit) {
  if (defenseCard.suit === trumpSuit && attackCard.suit !== trumpSuit) {
    return true;
  }
  if (defenseCard.suit !== trumpSuit && attackCard.suit === trumpSuit) {
    return false;
  }
  if (defenseCard.suit !== attackCard.suit) {
    return false;
  }
  return defenseCard.value > attackCard.value;
}

export function getValidDefenseCards(hand, attackCard, trumpSuit) {
  return hand.filter(card => canCardBeat(card, attackCard, trumpSuit));
}
