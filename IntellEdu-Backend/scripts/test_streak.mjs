import { DateTime } from 'luxon'

export function computeStreakTransition({
  currentStreak,
  longestStreak,
  lastActivityDate,
  todayDate,
  yesterdayDate,
}) {
  if (lastActivityDate === todayDate) {
    return {
      newCurrentStreak: currentStreak,
      newLongestStreak: Math.max(longestStreak, currentStreak),
      newLastActivityDate: todayDate,
      streakIncreasedToday: false,
    }
  }

  let nextStreak
  let streakIncreasedToday

  if (lastActivityDate === yesterdayDate) {
    nextStreak = currentStreak + 1
    streakIncreasedToday = true
  } else {
    // missed day or brand new
    nextStreak = 1
    streakIncreasedToday = true
  }

  const nextLongest = Math.max(longestStreak, nextStreak)

  return {
    newCurrentStreak: nextStreak,
    newLongestStreak: nextLongest,
    newLastActivityDate: todayDate,
    streakIncreasedToday,
  }
}

// Self-contained verification tests
function runStreakUnitTests() {
  console.log('Running Phase 1 Streak Unit Tests...')
  const tz = 'Asia/Kolkata'

  // Test 1: First day activity
  const t1 = computeStreakTransition({
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    todayDate: '2026-10-13',
    yesterdayDate: '2026-10-12',
  })
  console.assert(t1.newCurrentStreak === 1, `Test 1 failed: expected 1, got ${t1.newCurrentStreak}`)
  console.assert(t1.streakIncreasedToday === true, 'Test 1 streakIncreasedToday failed')
  console.log('✔ Test 1: First day activity: streak=1, increased=true')

  // Test 2: Same-day repeat activity (idempotent)
  const t2 = computeStreakTransition({
    currentStreak: 1,
    longestStreak: 1,
    lastActivityDate: '2026-10-13',
    todayDate: '2026-10-13',
    yesterdayDate: '2026-10-12',
  })
  console.assert(t2.newCurrentStreak === 1, `Test 2 failed: expected 1, got ${t2.newCurrentStreak}`)
  console.assert(t2.streakIncreasedToday === false, 'Test 2 streakIncreasedToday failed')
  console.log('✔ Test 2: Same-day repeat activity: streak stays 1, increased=false')

  // Test 3: Consecutive day activity
  const t3 = computeStreakTransition({
    currentStreak: 1,
    longestStreak: 1,
    lastActivityDate: '2026-10-13',
    todayDate: '2026-10-14',
    yesterdayDate: '2026-10-13',
  })
  console.assert(t3.newCurrentStreak === 2, `Test 3 failed: expected 2, got ${t3.newCurrentStreak}`)
  console.assert(t3.streakIncreasedToday === true, 'Test 3 streakIncreasedToday failed')
  console.log('✔ Test 3: Consecutive day activity: streak=2, longest=2, increased=true')

  // Test 4: Missed day (broken streak)
  const t4 = computeStreakTransition({
    currentStreak: 5,
    longestStreak: 10,
    lastActivityDate: '2026-10-10', // 4 days ago
    todayDate: '2026-10-14',
    yesterdayDate: '2026-10-13',
  })
  console.assert(t4.newCurrentStreak === 1, `Test 4 failed: expected 1, got ${t4.newCurrentStreak}`)
  console.assert(t4.newLongestStreak === 10, `Test 4 longestStreak should remain 10, got ${t4.newLongestStreak}`)
  console.assert(t4.streakIncreasedToday === true, 'Test 4 streakIncreasedToday failed')
  console.log('✔ Test 4: Missed day reset: streak resets to 1, longest preserved as 10')

  // Test 5: 23:59 IST vs 00:01 IST boundary
  const lateNight = DateTime.fromISO('2026-10-13T23:59:00', { zone: tz })
  const earlyMorning = lateNight.plus({ minutes: 2 }) // 2026-10-14T00:01:00 in IST

  console.assert(lateNight.toISODate() === '2026-10-13', 'Late night date mismatch')
  console.assert(earlyMorning.toISODate() === '2026-10-14', 'Early morning date mismatch')

  const t5 = computeStreakTransition({
    currentStreak: 3,
    longestStreak: 3,
    lastActivityDate: lateNight.toISODate(),
    todayDate: earlyMorning.toISODate(),
    yesterdayDate: earlyMorning.minus({ days: 1 }).toISODate(),
  })
  console.assert(t5.newCurrentStreak === 4, `Test 5 boundary test failed: expected 4, got ${t5.newCurrentStreak}`)
  console.assert(t5.streakIncreasedToday === true, 'Test 5 boundary increasedToday failed')
  console.log('✔ Test 5: Midnight 23:59 -> 00:01 IST boundary transitions day correctly and increments streak')

  console.log('All Phase 1 streak unit tests passed successfully!')
}

runStreakUnitTests()

