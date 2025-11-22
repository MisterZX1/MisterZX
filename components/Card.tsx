import React from 'react';
import { CardData, CardType } from '../types';

interface CardProps {
  card: CardData;
  isSpymaster: boolean;
  onClick: () => void;
  disabled: boolean;
}

const Card: React.FC<CardProps> = ({ card, isSpymaster, onClick, disabled }) => {

  // Styles for the Back Face (Revealed)
  const getRevealedClasses = (type: CardType) => {
    switch (type) {
      case CardType.RED: return 'bg-brand-red text-white border-brand-red';
      case CardType.BLUE: return 'bg-brand-blue text-white border-brand-blue';
      case CardType.NEUTRAL: return 'bg-brand-neutral text-gray-600 border-brand-neutral';
      case CardType.ASSASSIN: return 'bg-brand-assassin text-white border-brand-assassin';
      default: return '';
    }
  };

  // Styles for the Front Face (Unrevealed)
  const getUnrevealedClasses = (type: CardType, spymaster: boolean) => {
    if (spymaster) {
      switch (type) {
        case CardType.RED: return 'bg-red-100 text-red-900 border-red-200';
        case CardType.BLUE: return 'bg-blue-100 text-blue-900 border-blue-200';
        case CardType.NEUTRAL: return 'bg-brand-beige text-amber-900 border-amber-200';
        case CardType.ASSASSIN: return 'bg-gray-200 text-gray-900 border-gray-400';
      }
    }
    return 'bg-white text-gray-800 border-gray-200 hover:shadow-lg hover:border-gray-300';
  };

  const handleInteraction = () => {
    if (!card.revealed && !disabled) {
      onClick();
    }
  };

  return (
    <div 
      className={`
        perspective-1000 relative aspect-[4/3] select-none
        ${(!card.revealed && !disabled) ? 'cursor-pointer' : 'cursor-default'}
      `}
      onClick={handleInteraction}
    >
      <div 
        className={`
          w-full h-full transition-transform duration-700 transform-style-3d
          ${card.revealed ? 'rotate-y-180' : 'hover:-translate-y-1'}
        `}
      >
        
        {/* FRONT FACE (Unrevealed) */}
        <div 
          className={`
            absolute inset-0 backface-hidden
            rounded-lg border-b-4 border-r-2 shadow-sm
            flex items-center justify-center p-2
            text-center font-bold text-sm sm:text-base md:text-lg
            transition-colors duration-300
            ${getUnrevealedClasses(card.type, isSpymaster)}
          `}
        >
          {/* Spymaster Indicator Icons (Top Left) */}
          {isSpymaster && (
             <div className="absolute top-1 left-1 w-3 h-3 rounded-full opacity-50"
                style={{
                  backgroundColor: 
                    card.type === CardType.RED ? '#e11d48' :
                    card.type === CardType.BLUE ? '#2563eb' :
                    card.type === CardType.ASSASSIN ? '#171717' : 'transparent'
                }}
             />
          )}
          
          <span className="break-words leading-tight z-10">
            {card.word}
          </span>
        </div>

        {/* BACK FACE (Revealed) */}
        <div 
          className={`
            absolute inset-0 backface-hidden rotate-y-180
            rounded-lg border-b-4 border-r-2 shadow-sm
            flex items-center justify-center p-2
            text-center font-bold text-sm sm:text-base md:text-lg
            ${getRevealedClasses(card.type)}
          `}
        >
           {/* Texture overlay for style */}
           <div className="absolute inset-0 bg-white/5 pointer-events-none rounded-lg"></div>
           
           <span className={`break-words leading-tight z-10 ${card.type === CardType.ASSASSIN ? 'line-through' : ''}`}>
            {card.word}
          </span>
        </div>

      </div>
    </div>
  );
};

export default Card;