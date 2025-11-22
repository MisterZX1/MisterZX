export enum CardType {
  RED = 'RED',
  BLUE = 'BLUE',
  NEUTRAL = 'NEUTRAL',
  ASSASSIN = 'ASSASSIN',
}

export enum Team {
  RED = 'RED',
  BLUE = 'BLUE',
}

export type UserRole = 'RED_MASTER' | 'BLUE_MASTER' | 'RED_OPERATIVE' | 'BLUE_OPERATIVE';

export interface CardData {
  id: number;
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface GameState {
  roomId: string;
  cards: CardData[];
  currentTurn: Team;
  winner: Team | null;
  redScore: number;
  blueScore: number;
  isGameOver: boolean;
  log: string[];
  timerDuration: number; // Seconds per turn, 0 for unlimited
}

export interface ClueResponse {
  clue: string;
  count: number;
  explanation?: string;
}