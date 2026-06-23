import useLocalStorageState from './useLocalStorageState.js';

/**
 * Tracks daily streak: updates when updateStreak() is called (e.g. on task completion).
 * Exposes streakDays, lastActiveDate, and updateStreak.
 */
export default function useStreak() {
  const [streakDays, setStreakDays]         = useLocalStorageState('meridian_streak_days', 0);
  const [lastActiveDate, setLastActiveDate] = useLocalStorageState('meridian_last_active', null);

  function updateStreak() {
    const today = new Date().toDateString();
    if (lastActiveDate === today) return;
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    setStreakDays(prev => lastActiveDate === yesterday ? prev + 1 : 1);
    setLastActiveDate(today);
  }

  return { streakDays, lastActiveDate, updateStreak };
}
