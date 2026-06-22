"use client";

import * as React from "react";

type SoundName = "click" | "success" | "error" | "shooting";

type AudioContextConstructor = typeof AudioContext;
type ShotEffect = {
  id: number;
  top: number;
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ?? ((window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext);

  if (!AudioContextClass) {
    return null;
  }

  audioContext ??= new AudioContextClass();
  return audioContext;
}

function playTone(frequency: number, startsAt: number, duration: number, volume: number) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.02);
}

function playNoiseBurst(startsAt: number, duration: number, volume: number) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const sampleCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  filter.type = "highpass";
  filter.frequency.setValueAtTime(900, startsAt);
  gain.gain.setValueAtTime(volume, startsAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);

  noise.buffer = buffer;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  noise.start(startsAt);
  noise.stop(startsAt + duration);
}

export function playUiSound(name: SoundName) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  void context.resume().then(() => {
    const now = context.currentTime;

    if (name === "click") {
      playTone(420, now, 0.045, 0.025);
      return;
    }

    if (name === "success") {
      playTone(520, now, 0.07, 0.03);
      playTone(780, now + 0.065, 0.09, 0.026);
      return;
    }

    if (name === "shooting") {
      playNoiseBurst(now, 0.08, 0.045);
      playTone(120, now, 0.055, 0.04);
      return;
    }

    playTone(220, now, 0.08, 0.03);
    playTone(165, now + 0.075, 0.11, 0.026);
  });
}

function getSoundForInteraction(target: EventTarget | null): SoundName | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const interactiveElement = target.closest<HTMLElement>(
    'button, a[href], [role="button"], summary, input[type="button"], input[type="submit"], input[type="reset"]',
  );

  if (!interactiveElement || interactiveElement.closest('[data-sound="off"]')) {
    return null;
  }

  if ("disabled" in interactiveElement && Boolean(interactiveElement.disabled)) {
    return null;
  }

  if (interactiveElement.getAttribute("aria-disabled") === "true") {
    return null;
  }

  const sound = interactiveElement.dataset.sound;

  if (sound === "shooting" || sound === "shoot") {
    return "shooting";
  }

  if (sound === "success" || sound === "error" || sound === "click") {
    return sound;
  }

  return "click";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function SoundEffects() {
  const [shots, setShots] = React.useState<ShotEffect[]>([]);
  const nextShotId = React.useRef(0);

  React.useEffect(() => {
    function triggerShootingEffect() {
      const id = nextShotId.current;
      nextShotId.current += 1;

      playUiSound("shooting");
      setShots((current) => [...current, { id, top: 30 + Math.random() * 26 }]);

      window.setTimeout(() => {
        setShots((current) => current.filter((shot) => shot.id !== id));
      }, 420);
    }

    function handleClick(event: MouseEvent) {
      const sound = getSoundForInteraction(event.target);

      if (sound === "shooting") {
        triggerShootingEffect();
        return;
      }

      if (sound) {
        playUiSound(sound);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "p" && !event.repeat && !isEditableTarget(event.target)) {
        triggerShootingEffect();
      }
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {shots.map((shot) => (
        <div key={shot.id} className="absolute inset-0">
          <div
            className="absolute right-[18vw] h-1 w-[42vw] origin-right animate-[shooting-tracer_420ms_ease-out_forwards] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,232,145,0.95),rgba(255,255,255,0.9))] shadow-[0_0_18px_rgba(255,210,86,0.85)]"
            style={{ top: `${shot.top}%` }}
          />
          <div
            className="absolute right-[15.2vw] h-5 w-10 animate-[shooting-flash_180ms_ease-out_forwards] rounded-full bg-[#fff2a3] shadow-[0_0_34px_14px_rgba(255,198,66,0.78)]"
            style={{ top: `calc(${shot.top}% - 10px)` }}
          />
        </div>
      ))}

      <div className="absolute right-4 bottom-0 h-36 w-44 sm:right-10 sm:h-44 sm:w-56">
        <div className="absolute right-0 bottom-5 h-14 w-32 rotate-[-8deg] rounded-[8px] bg-[#171717] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_30px_rgba(0,0,0,0.45)] sm:h-16 sm:w-40">
          <div className="absolute -left-14 top-3 h-6 w-16 rounded-l-sm bg-[#222] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:-left-18 sm:w-20" />
          <div className="absolute right-4 -bottom-12 h-16 w-8 rotate-[14deg] rounded-b-[10px] bg-[#101010] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-20 sm:w-10" />
          <div className="absolute left-7 top-4 h-5 w-7 rounded-b-full border-2 border-[#050505]" />
        </div>
        <div className="absolute right-10 bottom-0 h-20 w-20 rotate-[-18deg] rounded-[42%_48%_34%_44%] bg-[#9b6a48] shadow-[inset_10px_-10px_18px_rgba(59,35,22,0.28)] sm:right-14 sm:h-24 sm:w-24" />
      </div>
    </div>
  );
}
