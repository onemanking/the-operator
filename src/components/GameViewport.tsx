import { useEffect, useRef } from 'react';
import { initGame } from '../game/main';
import { synth } from '../game/utils/SoundSynth';

declare global {
    interface Window {
        __PROMPT_PLEASE_GAME__?: ReturnType<typeof initGame>;
    }
}

export function GameViewport() {
    const gameRef = useRef<HTMLDivElement>(null);
    const audioUnlockAttemptedRef = useRef(false);
    const isDev = Boolean(
        (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
    );

    useEffect(() => {
        if (!gameRef.current) {
            return undefined;
        }

        const game = initGame(gameRef.current);

        if (isDev) {
            window.__PROMPT_PLEASE_GAME__ = game;
        }

        const removeUnlockListeners = () => {
            window.removeEventListener('pointerdown', unlockAudio, true);
            window.removeEventListener('keydown', unlockAudio, true);
            window.removeEventListener('touchstart', unlockAudio, true);
        };

        const unlockAudio = () => {
            if (audioUnlockAttemptedRef.current) {
                return;
            }

            audioUnlockAttemptedRef.current = true;
            void synth.resumeAudio().then((ready) => {
                if (!ready) {
                    audioUnlockAttemptedRef.current = false;
                    return;
                }

                removeUnlockListeners();
            });
        };

        window.addEventListener('pointerdown', unlockAudio, { capture: true });
        window.addEventListener('keydown', unlockAudio, { capture: true });
        window.addEventListener('touchstart', unlockAudio, { capture: true });

        return () => {
            if (window.__PROMPT_PLEASE_GAME__ === game) {
                delete window.__PROMPT_PLEASE_GAME__;
            }

            removeUnlockListeners();

            game.destroy(true);
        };
    }, [isDev]);

    return (
        <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden font-mono">
            <div
                ref={gameRef}
                id="game-container"
                className="shadow-[0_0_50px_rgba(51,255,51,0.2)] rounded-lg overflow-hidden border-4 border-gray-800"
            />
        </div>
    );
}