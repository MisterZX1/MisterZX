import React, { useState, useEffect, useCallback } from 'react';
import {
  CardData,
  CardType,
  Team,
  GameState,
  UserRole
} from './types';
import {
  ARABIC_WORDS,
  TOTAL_CARDS,
  RED_CARDS_COUNT,
  BLUE_CARDS_COUNT,
  ASSASSIN_CARDS_COUNT,
  NEUTRAL_CARDS_COUNT
} from './constants';
import GameBoard from './components/GameBoard';
import Confetti from './components/Confetti';
import { generateAIWords } from './services/geminiService';
import { playSound } from './services/soundService';

// Simple seeded random number generator for "syncing" boards via room ID
const seededRandom = (seed: number) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  // --- State ---
  const [roomId, setRoomId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>(''); // New: Player Name
  const [isSetup, setIsSetup] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Setup config
  const [timerSetting, setTimerSetting] = useState<number>(0); // 0 = unlimited
  
  // New Role State replacing simple isSpymaster
  const [userRole, setUserRole] = useState<UserRole>('RED_OPERATIVE');
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [customTheme, setCustomTheme] = useState<string>('');
  const [showRules, setShowRules] = useState<boolean>(false);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Manual Clue State
  const [manualClue, setManualClue] = useState<string>('');
  const [manualClueCount, setManualClueCount] = useState<number>(1);

  // Derived state for view logic
  const isSpymaster = userRole === 'RED_MASTER' || userRole === 'BLUE_MASTER';

  // --- Logic to Initialize Game ---

  // Initialize Room ID from URL or generate new one
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    } else {
      // Generate random ID: 7 chars
      setRoomId(Math.random().toString(36).substring(2, 9));
    }
  }, []);

  const getShareLink = () => {
     if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('room', roomId);
        return url.toString();
     }
     return '';
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initializeGame = useCallback(async (seedString: string, useAI: boolean, theme: string, duration: number) => {
    if (!playerName.trim()) {
        alert("الرجاء إدخال الاسم المستعار قبل البدء");
        return;
    }
    
    setLoading(true);
    
    // 1. Generate Seed ID from string
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
      seed = (seed << 5) - seed + seedString.charCodeAt(i);
      seed |= 0;
    }
    seed = Math.abs(seed);

    // 2. Select Words
    let selectedWords: string[] = [];

    if (useAI && theme && process.env.API_KEY) {
      // If AI is requested, we fetch new words. 
      const aiWords = await generateAIWords(theme);
      if (aiWords.length === TOTAL_CARDS) {
        selectedWords = aiWords;
      } else {
        // Fallback if AI fails
        const shuffledDict = [...ARABIC_WORDS].sort(() => 0.5 - seededRandom(seed++));
        selectedWords = shuffledDict.slice(0, TOTAL_CARDS);
      }
    } else {
      // Standard Deterministic Mode
      const shuffledDict = [...ARABIC_WORDS].sort(() => 0.5 - seededRandom(seed++));
      selectedWords = shuffledDict.slice(0, TOTAL_CARDS);
    }

    // 3. Assign Types
    const types: CardType[] = [
      ...Array(RED_CARDS_COUNT).fill(CardType.RED),
      ...Array(BLUE_CARDS_COUNT).fill(CardType.BLUE),
      ...Array(ASSASSIN_CARDS_COUNT).fill(CardType.ASSASSIN),
      ...Array(NEUTRAL_CARDS_COUNT).fill(CardType.NEUTRAL),
    ];

    let typeSeed = seed + 100;
    const shuffledTypes = types.sort(() => 0.5 - seededRandom(typeSeed++));

    // 4. Build Cards
    const newCards: CardData[] = selectedWords.map((word, index) => ({
      id: index,
      word,
      type: shuffledTypes[index],
      revealed: false,
    }));

    setGameState({
      roomId: seedString,
      cards: newCards,
      currentTurn: Team.RED,
      winner: null,
      redScore: RED_CARDS_COUNT,
      blueScore: BLUE_CARDS_COUNT,
      isGameOver: false,
      log: ["بدأت اللعبة! دور الفريق الأحمر."],
      timerDuration: duration
    });

    setManualClue('');
    setManualClueCount(1);
    setLoading(false);
    setIsSetup(false);
  }, [playerName]);

  // --- Role Change Logic ---
  const getRoleName = (role: UserRole) => {
    switch(role) {
      case 'RED_MASTER': return 'قائد الفريق الأحمر';
      case 'BLUE_MASTER': return 'قائد الفريق الأزرق';
      case 'RED_OPERATIVE': return 'لاعب الفريق الأحمر';
      case 'BLUE_OPERATIVE': return 'لاعب الفريق الأزرق';
      default: return role;
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (userRole === newRole) return;

    setUserRole(newRole);

    if (gameState && !isSetup) {
        const roleName = getRoleName(newRole);
        const logEntry = `قام ${playerName || 'لاعب'} بتغيير مكانه إلى: ${roleName}`;
        setGameState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                log: [logEntry, ...prev.log]
            };
        });
    }
  };

  // --- Timer Logic ---
  
  // Reset timer when turn changes
  useEffect(() => {
    if (gameState && gameState.timerDuration > 0 && !gameState.isGameOver) {
      setTimeLeft(gameState.timerDuration);
    }
  }, [gameState?.currentTurn, gameState?.timerDuration, gameState?.isGameOver]);

  // Helper to safely end turn (needed for timer effect)
  const endTurn = useCallback((isTimeout = false) => {
    setGameState(prevState => {
      if (!prevState || prevState.isGameOver) return prevState;
      const nextTurn = prevState.currentTurn === Team.RED ? Team.BLUE : Team.RED;
      
      const message = isTimeout 
        ? `⏰ انتهى الوقت! انتقل الدور للفريق ${prevState.currentTurn === Team.RED ? 'الأزرق' : 'الأحمر'}.`
        : `الفريق ${prevState.currentTurn === Team.RED ? 'الأحمر' : 'الأزرق'} أنهى دوره.`;
      
      if (isTimeout) playSound('WRONG');

      return {
        ...prevState,
        currentTurn: nextTurn,
        log: [message, ...prevState.log]
      };
    });
  }, []);

  // Countdown Effect
  useEffect(() => {
    if (!gameState || gameState.isGameOver || gameState.timerDuration <= 0) return;
    if (timeLeft <= 0) return;

    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [gameState, timeLeft]);

  // Handle Timeout Trigger
  useEffect(() => {
    if (gameState && !gameState.isGameOver && gameState.timerDuration > 0 && timeLeft === 0) {
       endTurn(true);
    }
  }, [timeLeft, gameState, endTurn]);


  // --- Game Interactions ---

  const handleCardClick = (id: number) => {
    // Spymasters cannot click/reveal cards
    if (!gameState || gameState.isGameOver || isSpymaster) return;

    const clickedCard = gameState.cards.find(c => c.id === id);
    if (!clickedCard || clickedCard.revealed) return;

    // Play generic flip sound immediately
    playSound('FLIP');

    const newCards = gameState.cards.map(c => 
      c.id === id ? { ...c, revealed: true } : c
    );

    let newRedScore = gameState.redScore;
    let newBlueScore = gameState.blueScore;
    let winner = gameState.winner;
    let isGameOver = gameState.isGameOver;
    let currentTurn = gameState.currentTurn;
    const log = [...gameState.log];

    // Game Logic
    if (clickedCard.type === CardType.ASSASSIN) {
      // Immediate Loss
      playSound('LOSE');
      winner = currentTurn === Team.RED ? Team.BLUE : Team.RED;
      isGameOver = true;
      log.unshift(`الفريق ${currentTurn === Team.RED ? 'الأحمر' : 'الأزرق'} كشف القاتل! انتهت اللعبة.`);
    } else if (clickedCard.type === CardType.NEUTRAL) {
      // End Turn
      playSound('WRONG');
      log.unshift(`الفريق ${currentTurn === Team.RED ? 'الأحمر' : 'الأزرق'} اختار كلمة محايدة (${clickedCard.word}). انتهى الدور.`);
      currentTurn = currentTurn === Team.RED ? Team.BLUE : Team.RED;
    } else if (clickedCard.type === CardType.RED) {
      newRedScore--;
      if (currentTurn === Team.RED) {
        log.unshift(`الفريق الأحمر وجد عميلاً! (${clickedCard.word})`);
        if (newRedScore === 0) {
          winner = Team.RED;
          isGameOver = true;
          playSound('WIN');
          log.unshift("الفريق الأحمر فاز!");
        } else {
          playSound('CORRECT');
        }
      } else {
        // Blue picked Red
        playSound('WRONG');
        log.unshift(`الفريق الأزرق ساعد الفريق الأحمر وكشف (${clickedCard.word})! انتهى الدور.`);
        currentTurn = Team.RED; 
        if (newRedScore === 0) {
             winner = Team.RED;
             isGameOver = true;
             playSound('WIN');
             log.unshift("الفريق الأحمر فاز!");
        }
      }
    } else if (clickedCard.type === CardType.BLUE) {
      newBlueScore--;
      if (currentTurn === Team.BLUE) {
        log.unshift(`الفريق الأزرق وجد عميلاً! (${clickedCard.word})`);
        if (newBlueScore === 0) {
          winner = Team.BLUE;
          isGameOver = true;
          playSound('WIN');
          log.unshift("الفريق الأزرق فاز!");
        } else {
          playSound('CORRECT');
        }
      } else {
        // Red picked Blue
        playSound('WRONG');
        log.unshift(`الفريق الأحمر ساعد الفريق الأزرق وكشف (${clickedCard.word})! انتهى الدور.`);
        currentTurn = Team.BLUE;
         if (newBlueScore === 0) {
          winner = Team.BLUE;
          isGameOver = true;
          playSound('WIN');
          log.unshift("الفريق الأزرق فاز!");
        }
      }
    }

    setGameState({
      ...gameState,
      cards: newCards,
      redScore: newRedScore,
      blueScore: newBlueScore,
      winner,
      isGameOver,
      currentTurn,
      log
    });
  };

  const submitClue = () => {
    if (!gameState || !manualClue.trim()) return;

    const teamName = gameState.currentTurn === Team.RED ? 'الأحمر' : 'الأزرق';
    // Add player name to the clue log
    const logEntry = `القائد ${playerName} (${teamName}) قدم تلميحاً: ${manualClue} (${manualClueCount})`;

    setGameState({
      ...gameState,
      log: [logEntry, ...gameState.log]
    });
    setManualClue('');
    setManualClueCount(1);
  };

  // --- Render Helpers ---

  if (isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200">
          <h1 className="text-4xl font-black text-center mb-2 text-brand-blue">أسماء حركية</h1>
          <p className="text-center text-gray-500 mb-8">النسخة العربية - Codenames</p>
          
          <div className="space-y-6">
            {/* Player Name Input */}
            <div>
               <label className="block text-sm font-bold mb-2 text-gray-700">الاسم المستعار (مطلوب)</label>
               <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="ادخل اسمك هنا"
                  className="w-full p-3 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-brand-blue focus:outline-none"
                />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">رابط الغرفة (شارك هذا الرابط مع أصدقائك)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={getShareLink()}
                  className="w-full p-3 border border-gray-300 rounded-lg text-left bg-gray-50 text-gray-600 text-sm font-mono dir-ltr focus:outline-none"
                />
                <button 
                    onClick={copyLink}
                    className={`px-4 py-3 rounded-lg font-bold text-white transition-all ${copied ? 'bg-green-600' : 'bg-brand-blue hover:bg-blue-700'}`}
                >
                    {copied ? 'تم!' : 'نسخ'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">عند فتح الرابط، سيدخل أصدقاؤك نفس الغرفة تلقائياً.</p>
            </div>

            <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-bold mb-2 text-gray-700">مؤقت الدور</label>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'غير محدود', val: 0 },
                        { label: '60 ثانية', val: 60 },
                        { label: '120 ثانية', val: 120 },
                        { label: '180 ثانية', val: 180 },
                    ].map((opt) => (
                        <button
                            key={opt.val}
                            onClick={() => setTimerSetting(opt.val)}
                            className={`p-2 rounded-lg text-sm font-bold border transition-all ${
                                timerSetting === opt.val 
                                ? 'bg-brand-blue text-white border-brand-blue' 
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-bold mb-2 text-gray-700">موضوع مخصص (اختياري - يتطلب AI)</label>
              <input
                type="text"
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-brand-blue focus:outline-none"
                placeholder="مثال: حيوانات، فضاء، مطبخ..."
              />
            </div>

            <button
              onClick={() => initializeGame(roomId, !!customTheme, customTheme, timerSetting)}
              disabled={loading || !roomId.trim() || !playerName.trim()}
              className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all shadow-md ${loading || !playerName.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-blue hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'}`}
            >
              {loading ? 'جاري التحضير...' : 'ابدأ اللعب'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const turnColor = gameState.currentTurn === Team.RED ? 'text-brand-red' : 'text-brand-blue';
  const turnBg = gameState.currentTurn === Team.RED ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200';
  const isCurrentSpymaster = (userRole === 'RED_MASTER' && gameState.currentTurn === Team.RED) || 
                             (userRole === 'BLUE_MASTER' && gameState.currentTurn === Team.BLUE);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24" dir="rtl">
      
      {/* Celebration Confetti */}
      {gameState.winner && <Confetti winner={gameState.winner} />}

      {/* TOP BAR: SPYMASTERS */}
      <div className="bg-slate-800 text-white p-2 shadow-lg relative z-40">
        <div className="max-w-5xl mx-auto flex justify-between gap-4">
          <button
            onClick={() => handleRoleChange('RED_MASTER')}
            className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all flex flex-col items-center justify-center ${
              userRole === 'RED_MASTER' 
                ? 'bg-brand-red ring-2 ring-white shadow-inner' 
                : 'bg-slate-700 hover:bg-red-900 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-2">
                <span className="text-2xl">🕵️‍♂️</span>
                <span>قائد الأحمر</span>
            </div>
            {userRole === 'RED_MASTER' && (
                <span className="text-xs text-red-100 mt-1 font-normal">({playerName})</span>
            )}
          </button>
          <button
            onClick={() => handleRoleChange('BLUE_MASTER')}
            className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all flex flex-col items-center justify-center ${
              userRole === 'BLUE_MASTER' 
                ? 'bg-brand-blue ring-2 ring-white shadow-inner' 
                : 'bg-slate-700 hover:bg-blue-900 opacity-70 hover:opacity-100'
            }`}
          >
             <div className="flex items-center gap-2">
                <span className="text-2xl">🕵️‍♂️</span>
                <span>قائد الأزرق</span>
            </div>
            {userRole === 'BLUE_MASTER' && (
                <span className="text-xs text-blue-100 mt-1 font-normal">({playerName})</span>
            )}
          </button>
        </div>
      </div>

      {/* Sub-Header: Score & Tools */}
      <header className="bg-white shadow-sm z-20 border-b border-gray-200 relative">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-800">أسماء حركية</h1>
                <span className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-500 font-mono">{gameState.roomId}</span>
            </div>
            
            <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-center">
                <div className="text-center">
                    <div className="text-3xl font-black text-brand-red leading-none">{gameState.redScore}</div>
                    <div className="text-xs text-red-600 font-bold">أحمر</div>
                </div>
                <div className="text-2xl font-thin text-gray-300">|</div>
                <div className="text-center">
                    <div className="text-3xl font-black text-brand-blue leading-none">{gameState.blueScore}</div>
                    <div className="text-xs text-blue-600 font-bold">أزرق</div>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => { setIsSetup(true); setGameState(null); }}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                    خروج
                </button>
            </div>
        </div>
      </header>

      {/* Game Status Bar */}
      <div className={`max-w-2xl mx-auto mt-4 mb-4 p-4 rounded-xl border-2 shadow-sm transition-colors duration-500 relative z-10 ${gameState.winner ? (gameState.winner === Team.RED ? 'bg-red-100 border-red-300' : 'bg-blue-100 border-blue-300') : turnBg}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
            <div className="flex-1">
                {gameState.winner ? (
                    <h2 className="text-2xl font-bold">
                        🎉 فاز الفريق <span className={gameState.winner === Team.RED ? 'text-red-700' : 'text-blue-700'}>{gameState.winner === Team.RED ? 'الأحمر' : 'الأزرق'}</span>!
                    </h2>
                ) : (
                    <div className="flex items-center gap-4">
                         <h2 className="text-xl font-bold">
                            دور: <span className={turnColor}>{gameState.currentTurn === Team.RED ? 'الفريق الأحمر' : 'الفريق الأزرق'}</span>
                        </h2>
                        {/* Timer Display */}
                        {gameState.timerDuration > 0 && (
                             <div className={`flex items-center gap-1 font-mono text-xl font-bold ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                                <span>⏱</span>
                                <span>{formatTime(timeLeft)}</span>
                             </div>
                        )}
                    </div>
                )}
            </div>

            {!gameState.winner && (
                <div className="flex gap-2">
                    <button
                        onClick={() => endTurn(false)}
                        className="bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 shadow-sm"
                    >
                        إنهاء الدور
                    </button>
                </div>
            )}
        </div>
        
        {/* Spymaster Manual Clue Input */}
        {isCurrentSpymaster && !gameState.winner && (
            <div className="mt-3 pt-3 border-t border-black/10 w-full animate-in fade-in">
                <p className="text-xs mb-2 font-bold opacity-60">أنت تلعب بصفتك القائد: {playerName}</p>
                <form 
                    onSubmit={(e) => { e.preventDefault(); submitClue(); }}
                    className="flex gap-2 items-stretch"
                >
                    <input 
                        type="text" 
                        value={manualClue}
                        onChange={(e) => setManualClue(e.target.value)}
                        placeholder="اكتب التلميح هنا..."
                        className="flex-1 p-2 rounded-lg border border-gray-300 text-right focus:ring-2 focus:ring-brand-blue outline-none"
                    />
                    <select
                        value={manualClueCount}
                        onChange={(e) => setManualClueCount(Number(e.target.value))}
                        className="p-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-brand-blue outline-none w-16 text-center font-bold"
                    >
                        {[1,2,3,4,5,6,7,8,9].map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                    <button 
                        type="submit"
                        disabled={!manualClue.trim()}
                        className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        إرسال
                    </button>
                </form>
            </div>
        )}
      </div>

      {/* Board */}
      <main className="pb-20 relative z-0">
        <GameBoard
            cards={gameState.cards}
            isSpymaster={isSpymaster}
            onCardClick={handleCardClick}
            isGameOver={gameState.isGameOver}
        />
      </main>

      {/* BOTTOM BAR: OPERATIVES */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
        <div className="max-w-5xl mx-auto flex justify-between gap-4">
          <button
            onClick={() => handleRoleChange('RED_OPERATIVE')}
            className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center border-2 ${
              userRole === 'RED_OPERATIVE'
                ? 'bg-red-50 border-brand-red text-brand-red shadow-sm scale-[1.02]'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
             <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <span>لاعب أحمر</span>
            </div>
             {userRole === 'RED_OPERATIVE' && (
                <span className="text-xs mt-0.5 font-normal opacity-80">({playerName})</span>
            )}
          </button>
          <button
            onClick={() => handleRoleChange('BLUE_OPERATIVE')}
            className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center border-2 ${
              userRole === 'BLUE_OPERATIVE'
                ? 'bg-blue-50 border-brand-blue text-brand-blue shadow-sm scale-[1.02]'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
             <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <span>لاعب أزرق</span>
            </div>
            {userRole === 'BLUE_OPERATIVE' && (
                <span className="text-xs mt-0.5 font-normal opacity-80">({playerName})</span>
            )}
          </button>
        </div>
      </div>

      {/* Log / History - Moved slightly down to account for bottom bar padding */}
      <div className="max-w-4xl mx-auto px-4 mt-4 mb-8 relative z-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-bold text-gray-500 text-sm mb-2">سجل اللعبة</h3>
            <div className="max-h-32 overflow-y-auto space-y-2 text-sm text-gray-600 custom-scrollbar">
                {gameState.log.map((entry, i) => (
                    <div key={i} className="border-b border-gray-50 pb-1 last:border-0">{entry}</div>
                ))}
            </div>
        </div>
      </div>

      {/* Instructions Modal (Simple) */}
      <div className="fixed bottom-24 left-4 z-40">
         <button 
            onClick={() => setShowRules(!showRules)}
            className="bg-white text-gray-600 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 font-bold w-10 h-10 flex items-center justify-center"
         >
            ?
         </button>
      </div>
      
      {showRules && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRules(false)}>
            <div className="bg-white p-6 rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">كيفية اللعب</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 mb-4">
                    <li>اختر دورك من الخانات العلوية (للقادة) أو السفلية (للاعبين).</li>
                    <li>القادة (بالأعلى) يرون ألوان البطاقات لتوجيه فريقهم.</li>
                    <li>اللاعبون (بالأسفل) يضغطون على البطاقات للكشف عنها.</li>
                    <li>القائد يعطي تلميحاً (كلمة ورقم) ليساعد فريقه في تخمين كلماتهم.</li>
                    <li>احذروا من "القاتل" (البطاقة السوداء)!</li>
                </ul>
                <button onClick={() => setShowRules(false)} className="w-full py-2 bg-gray-800 text-white rounded-lg">فهمت</button>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;