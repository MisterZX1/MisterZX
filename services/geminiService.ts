import { GoogleGenAI, Type } from "@google/genai";
import { CardData, CardType, ClueResponse, Team } from "../types";

// Initialize Gemini
// NOTE: process.env.API_KEY is assumed to be available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateAIWords = async (theme: string): Promise<string[]> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Generate a list of 25 distinct, simple, common Arabic nouns related to the theme: "${theme}". 
    Ensure they are single words, not compound words. 
    Return strictly a JSON array of strings. Example: ["كلمة1", "كلمة2"]`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    const words = JSON.parse(text);
    
    if (Array.isArray(words) && words.length >= 25) {
      return words.slice(0, 25);
    }
    return [];
  } catch (error) {
    console.error("Gemini Word Gen Error:", error);
    return [];
  }
};

export const getAIClue = async (
  cards: CardData[],
  currentTeam: Team
): Promise<ClueResponse | null> => {
  try {
    const model = 'gemini-2.5-flash';
    
    // Filter cards based on current state
    const unrevealed = cards.filter(c => !c.revealed);
    const myTeamWords = unrevealed
      .filter(c => c.type === (currentTeam === Team.RED ? CardType.RED : CardType.BLUE))
      .map(c => c.word);
    const assassinWord = unrevealed.find(c => c.type === CardType.ASSASSIN)?.word;
    const enemyWords = unrevealed
      .filter(c => c.type === (currentTeam === Team.RED ? CardType.BLUE : CardType.RED))
      .map(c => c.word);
    const neutralWords = unrevealed
      .filter(c => c.type === CardType.NEUTRAL)
      .map(c => c.word);

    if (myTeamWords.length === 0) return null;

    const prompt = `You are playing Codenames in Arabic. You are the Spymaster for the ${currentTeam === Team.RED ? 'Red' : 'Blue'} team.
    
    Your goal is to provide a one-word clue (in Arabic) that links multiple words from your team's list, while avoiding the Assassin word, Enemy words, and Neutral words.

    Your Team's Words: ${JSON.stringify(myTeamWords)}
    Assassin Word (AVOID AT ALL COSTS): ${assassinWord || "None"}
    Enemy Words (AVOID): ${JSON.stringify(enemyWords)}
    Neutral Words (AVOID): ${JSON.stringify(neutralWords)}

    Rules:
    1. The clue must be a single Arabic word.
    2. The clue cannot be any of the words on the board (revealed or unrevealed) or a derivation of them.
    3. Provide a number indicating how many of your team's words relate to this clue.

    Output strictly JSON format.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clue: { type: Type.STRING },
            count: { type: Type.INTEGER },
            explanation: { type: Type.STRING }
          },
          required: ["clue", "count"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    
    const result = JSON.parse(text) as ClueResponse;
    return result;

  } catch (error) {
    console.error("Gemini Clue Gen Error:", error);
    return null;
  }
};
