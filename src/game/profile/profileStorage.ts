export interface PlayerProfile {
  version: number;
  orientationCompleted: boolean;
}

const PROFILE_STORAGE_KEY = "prompt-please.player-profile";
const PLAYER_PROFILE_VERSION = 1;

const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  version: PLAYER_PROFILE_VERSION,
  orientationCompleted: false,
};

export function createDefaultPlayerProfile(): PlayerProfile {
  return { ...DEFAULT_PLAYER_PROFILE };
}

export function loadPlayerProfile(): PlayerProfile {
  if (typeof window === "undefined" || !window.localStorage) {
    return createDefaultPlayerProfile();
  }

  try {
    const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!rawProfile) {
      return createDefaultPlayerProfile();
    }

    const parsed = JSON.parse(rawProfile) as Partial<PlayerProfile>;
    return {
      version: PLAYER_PROFILE_VERSION,
      orientationCompleted: parsed.orientationCompleted === true,
    };
  } catch {
    return createDefaultPlayerProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      version: PLAYER_PROFILE_VERSION,
      orientationCompleted: profile.orientationCompleted,
    }),
  );
}

export function markOrientationCompleted() {
  const nextProfile = {
    ...loadPlayerProfile(),
    orientationCompleted: true,
  };

  savePlayerProfile(nextProfile);
  return nextProfile;
}

export function resetPlayerProfile() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
}
