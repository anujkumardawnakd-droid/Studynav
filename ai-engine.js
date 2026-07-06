/**
 * ai-engine.js
 * Rule-based decision engine. No GPT/LLM/ML — pure weighted rules +
 * decision trees + template messages, exactly per spec section 13.
 *
 * generateInsights(inputs) -> {
 *   mustDoTasks, studySessions, breakSessions, recommendations, motivationalMessage
 * }
 */

const ENCOURAGING_TEMPLATES = {
  lowSleep: [
    "Your body is asking for rest — today's plan is lighter on purpose.",
    "Short, kind sessions today. Recovery is progress too.",
  ],
  highStress: [
    "Stress is high right now — we've eased the intensity today.",
    "Be gentle with yourself today. Small steps still count.",
  ],
  examClose: [
    "The exam is close, so today leans into focused revision.",
    "Crunch time calls for focus, not panic. One subject at a time.",
  ],
  phoneHeavy: [
    "A few short, distraction-free blocks can go a long way today.",
  ],
  steady: [
    "Small progress matters. Keep showing up.",
    "Your consistency is quietly adding up.",
    "Today is another brick in a strong foundation.",
  ],
  lowEnergy: [
    "Energy is low today — we've kept sessions short and doable.",
  ],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {object} inputs
 *  profile, subjects, studyHabits, learningStyle, checkin (today), examCountdownDays
 */
export function generateInsights(inputs = {}) {
  const {
    subjects = [],
    checkin = {},
    examCountdownDays = null,
  } = inputs;

  const sleepHours = Number(checkin.sleepHours ?? 7);
  const stressLevel = Number(checkin.stressLevel ?? 2);
  const phoneUsageHours = Number(checkin.phoneUsageHours ?? 1);
  const energyLevel = Number(checkin.energyLevel ?? 3);
  const pendingAssignments = Number(checkin.pendingAssignments ?? 0);
  const freeTimeHours = Number(checkin.freeTimeHours ?? 3);

  const recommendations = [];
  let intensity = 1.0; // multiplier applied to total study load
  let sessionLengthCapMin = 60;
  let breakBoost = 0; // extra minutes added per break
  let focusWeakSubjects = false;
  let easierTasksOnly = false;

  // --- Decision tree / weighted rules (spec section 13) ---
  if (sleepHours < 6) {
    intensity *= 0.75;
    breakBoost += 5;
    sessionLengthCapMin = Math.min(sessionLengthCapMin, 45);
    recommendations.push("Reduced total study load because sleep was under 6 hours.");
    recommendations.push("Longer breaks added to help you recover.");
  }
  if (stressLevel > 4) {
    intensity *= 0.8;
    easierTasksOnly = true;
    breakBoost += 5;
    recommendations.push("Swapped in easier review tasks — stress is running high today.");
    recommendations.push("Added a recovery break between sessions.");
  }
  if (examCountdownDays != null && examCountdownDays < 30) {
    focusWeakSubjects = true;
    intensity *= 1.1;
    recommendations.push("Exam is under 30 days away — revision has been prioritized.");
  }
  if (phoneUsageHours > 5) {
    sessionLengthCapMin = Math.min(sessionLengthCapMin, 30);
    recommendations.push("Shorter, deep-focus blocks recommended given recent screen time.");
  }
  if (energyLevel <= 2) {
    intensity *= 0.85;
    recommendations.push("Energy is low — today's sessions are intentionally shorter.");
  }

  intensity = clamp(intensity, 0.5, 1.2);

  // --- Must-do tasks: pending assignments + weak/priority subjects ---
  const mustDoTasks = [];
  if (pendingAssignments > 0) {
    mustDoTasks.push({
      id: "assignments",
      label: `Clear ${pendingAssignments} pending assignment${pendingAssignments > 1 ? "s" : ""}`,
      priority: pendingAssignments > 2 ? "high" : "medium",
    });
  }
  const weakSubjects = subjects.filter((s) => (s.confidence ?? 3) <= 2);
  const priorityPool = focusWeakSubjects && weakSubjects.length ? weakSubjects : subjects;
  priorityPool.slice(0, 2).forEach((s) => {
    mustDoTasks.push({
      id: `revise-${s.name}`,
      label: `Revise ${s.name}`,
      priority: focusWeakSubjects ? "high" : "medium",
    });
  });

  // --- Session budget ---
  const baseFreeMinutes = clamp(freeTimeHours, 0.5, 8) * 60;
  const totalStudyMinutes = Math.round(baseFreeMinutes * 0.6 * intensity);
  const sessionLength = [30, 45, 60].reduce((best, len) =>
    len <= sessionLengthCapMin ? len : best, 30);

  const numSessions = Math.max(1, Math.min(6, Math.round(totalStudyMinutes / sessionLength)));
  const orderedSubjects = (focusWeakSubjects && weakSubjects.length ? weakSubjects : subjects);
  const subjectCycle = orderedSubjects.length ? orderedSubjects : [{ name: "General Study" }];

  const studySessions = [];
  const breakSessions = [];
  for (let i = 0; i < numSessions; i++) {
    const subject = subjectCycle[i % subjectCycle.length];
    studySessions.push({
      subject: subject.name,
      duration: sessionLength,
      type: easierTasksOnly ? "light-review" : "study",
      priority: focusWeakSubjects && weakSubjects.includes(subject) ? "high" : "normal",
    });
    const breakLen = (sessionLength === 30 ? 5 : sessionLength === 45 ? 10 : 15) + breakBoost;
    breakSessions.push({ duration: breakLen, afterSubject: subject.name });
  }

  // --- Motivational message (never punitive, per section 3) ---
  let bucket = "steady";
  if (sleepHours < 6) bucket = "lowSleep";
  else if (stressLevel > 4) bucket = "highStress";
  else if (examCountdownDays != null && examCountdownDays < 30) bucket = "examClose";
  else if (phoneUsageHours > 5) bucket = "phoneHeavy";
  else if (energyLevel <= 2) bucket = "lowEnergy";

  const motivationalMessage = pick(ENCOURAGING_TEMPLATES[bucket] || ENCOURAGING_TEMPLATES.steady);

  if (!recommendations.length) {
    recommendations.push("Everything looks balanced today — steady as you go.");
  }

  return { mustDoTasks, studySessions, breakSessions, recommendations, motivationalMessage, sessionLength };
}
