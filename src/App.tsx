import { useEffect, useRef } from 'react';
import { initGame } from './game/main';

declare global {
  interface Window {
    __PROMPT_PLEASE_GAME__?: ReturnType<typeof initGame>;
  }
}

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameRef.current) {
      const game = initGame(gameRef.current);
      if (import.meta.env.DEV) {
        window.__PROMPT_PLEASE_GAME__ = game;
      }
      return () => {
        if (window.__PROMPT_PLEASE_GAME__ === game) {
          delete window.__PROMPT_PLEASE_GAME__;
        }
        game.destroy(true);
      };
    }
  }, []);

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden font-mono">
      <div ref={gameRef} id="game-container" className="shadow-[0_0_50px_rgba(51,255,51,0.2)] rounded-lg overflow-hidden border-4 border-gray-800" />
    </div>
  );
}
