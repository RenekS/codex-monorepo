// src/utils/sound.js
export const playSound = (ref) => {
  const audio = ref?.current;
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  } catch (_) {
    // swallow
  }
};

