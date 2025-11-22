import React from 'react';
import { CardData } from '../types';
import Card from './Card';

interface GameBoardProps {
  cards: CardData[];
  isSpymaster: boolean;
  onCardClick: (id: number) => void;
  isGameOver: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ cards, isSpymaster, onCardClick, isGameOver }) => {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4 w-full max-w-4xl mx-auto p-2 sm:p-4">
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          isSpymaster={isSpymaster}
          onClick={() => onCardClick(card.id)}
          disabled={isGameOver}
        />
      ))}
    </div>
  );
};

export default GameBoard;
