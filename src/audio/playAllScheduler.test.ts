import { describe, expect, it } from 'vitest';
import { clampScheduleTime, PLAYALL_SCHEDULE_RECOVERY_S, PLAYALL_SCHEDULE_SAFETY_S } from './playAllScheduler';

describe('clampScheduleTime', () => {
  it('keeps times that are sufficiently ahead', () => {
    const currentTime = 5;
    const nextTime = currentTime + PLAYALL_SCHEDULE_SAFETY_S + 0.01;
    const out = clampScheduleTime(nextTime, currentTime);
    expect(out).toEqual({ scheduledTime: nextTime, clamped: false });
  });

  it('clamps near-past times forward', () => {
    const currentTime = 3.2;
    const nextTime = currentTime - 0.001;
    const out = clampScheduleTime(nextTime, currentTime);
    expect(out).toEqual({
      scheduledTime: currentTime + PLAYALL_SCHEDULE_RECOVERY_S,
      clamped: true,
    });
  });
});
