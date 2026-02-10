import { Square, SquareX } from 'lucide-react';
import { useAudio } from '../audio/AudioContextProvider';

export function MiniPlayer() {
  const { voices, stopAll, stopVoice } = useAudio();
  return (
    <div className="fixed bottom-4 right-4 left-4 rounded-2xl border border-rim bg-surface/70 p-3 shadow-glass backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-300">Mini Player ({voices.length})</div>
        <button className="rounded-md border px-2 py-1 text-xs" onClick={stopAll}>
          <Square className="inline h-3 w-3" /> Stop all
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {voices.map((v) => (
          <button key={v.id} onClick={() => stopVoice(v.id)} className="rounded-full border px-3 py-1 text-xs">
            {v.barId} <SquareX className="ml-1 inline h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
