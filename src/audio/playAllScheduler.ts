export const PLAYALL_SCHEDULE_SAFETY_S = 0.02;
export const PLAYALL_SCHEDULE_RECOVERY_S = 0.06;

export function clampScheduleTime(nextTime: number, currentTime: number): { scheduledTime: number; clamped: boolean } {
  const minSafeTime = currentTime + PLAYALL_SCHEDULE_SAFETY_S;
  if (nextTime >= minSafeTime) {
    return { scheduledTime: nextTime, clamped: false };
  }
  return { scheduledTime: currentTime + PLAYALL_SCHEDULE_RECOVERY_S, clamped: true };
}

