/**
 * timetable-engine.js
 * Converts AI-engine recommendations into a concrete, timed daily plan.
 * Supports Pomodoro / Flexible / Deep Work modes and enforces the
 * break rules from spec section 14.
 *
 * Public: generateTimetable(insights, options) -> { date, sessions: [...] }
 */

const BREAK_RULES = { 30: 5, 45: 10, 60: 15 };

function toMinutes(h, m) {
  return h * 60 + m;
}
function fromMinutes(total) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @param {object} insights   output of ai-engine.generateInsights()
 * @param {object} options    { mode: 'pomodoro'|'flexible'|'deepwork', startTime: 'HH:MM', preferredSessionLength }
 */
export function generateTimetable(insights, options = {}) {
  const {
    mode = "flexible",
    startTime = "16:00",
    date = new Date().toISOString().slice(0, 10),
  } = options;

  const [sh, sm] = startTime.split(":").map(Number);
  let cursor = toMinutes(sh || 16, sm || 0);

  const sessions = [];

  // Must-do tasks surface first, as short focused checklist sessions.
  (insights.mustDoTasks || []).forEach((task) => {
    const duration = mode === "deepwork" ? 45 : 20;
    sessions.push({
      subject: task.label,
      startTime: fromMinutes(cursor),
      endTime: fromMinutes(cursor + duration),
      duration,
      type: "task",
      priority: task.priority || "medium",
      done: false,
    });
    cursor += duration;
    const brk = BREAK_RULES[nearestBreakKey(duration)] || 5;
    sessions.push(breakBlock(cursor, brk));
    cursor += brk;
  });

  const studyList = insights.studySessions || [];
  studyList.forEach((s, idx) => {
    let duration = s.duration || 45;
    if (mode === "pomodoro") duration = 25;
    if (mode === "deepwork") duration = Math.max(duration, 60);

    sessions.push({
      subject: s.subject,
      startTime: fromMinutes(cursor),
      endTime: fromMinutes(cursor + duration),
      duration,
      type: s.type || "study",
      priority: s.priority || "normal",
      done: false,
    });
    cursor += duration;

    const isLast = idx === studyList.length - 1;
    if (!isLast) {
      const brk = mode === "pomodoro" ? 5 : (BREAK_RULES[nearestBreakKey(duration)] || 10);
      sessions.push(breakBlock(cursor, brk));
      cursor += brk;
    }
  });

  return { date, mode, generatedAt: Date.now(), sessions };
}

function nearestBreakKey(duration) {
  const keys = Object.keys(BREAK_RULES).map(Number);
  return keys.reduce((best, k) => (Math.abs(k - duration) < Math.abs(best - duration) ? k : best), keys[0]);
}

function breakBlock(cursor, len) {
  return {
    subject: "Break",
    startTime: fromMinutes(cursor),
    endTime: fromMinutes(cursor + len),
    duration: len,
    type: "break",
    priority: "low",
    done: false,
  };
}

/** Marks a session complete/skipped by index; returns a new plan object (immutability-friendly). */
export function updateSessionStatus(plan, index, status) {
  if (!plan?.sessions?.[index]) return plan;
  const sessions = plan.sessions.map((s, i) =>
    i === index ? { ...s, done: status === "complete", skipped: status === "skip" } : s
  );
  return { ...plan, sessions };
}

/** Reschedules a session to a new start time, shifting nothing else (manual edit, per spec). */
export function rescheduleSession(plan, index, newStartTime) {
  if (!plan?.sessions?.[index]) return plan;
  const [h, m] = newStartTime.split(":").map(Number);
  const startTotal = toMinutes(h, m);
  const sessions = plan.sessions.map((s, i) => {
    if (i !== index) return s;
    return { ...s, startTime: newStartTime, endTime: fromMinutes(startTotal + s.duration) };
  });
  return { ...plan, sessions };
}
