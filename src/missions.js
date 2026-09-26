// Mission progress, stars and save data. Emits simple events so the UI and
// world can react without knowing about each other.
import { FRAGMENTS, MISSIONS, RANKS } from './content.js';

const SAVE_KEY = 'grand-museum-save-v2';

function freshState(name = '') {
  return {
    name,
    objectives: {}, // objective id -> progress count
    completedMissions: [],
    fragments: [], // collected fragment ids
    met: [], // characters talked to
    stars: 0,
    timelineRestored: false,
    photos: 0,
    startedAt: Date.now(),
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { ...freshState(), ...data };
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export class MissionLog {
  constructor(state) {
    this.state = state || freshState();
    this.listeners = new Set();
  }

  static newGame(name) {
    clearSave();
    return new MissionLog(freshState(name));
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, detail = {}) {
    for (const listener of this.listeners) listener(type, detail);
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* storage unavailable */ }
  }

  get name() {
    return this.state.name || 'Visitor';
  }

  get rank() {
    let current = RANKS[0];
    for (const rank of RANKS) if (this.state.stars >= rank.stars) current = rank;
    return current;
  }

  get nextRank() {
    return RANKS.find((rank) => rank.stars > this.state.stars) || null;
  }

  isMissionComplete(id) {
    return this.state.completedMissions.includes(id);
  }

  isMissionUnlocked(mission) {
    return (mission.requires || []).every((id) => this.isMissionComplete(id));
  }

  activeMissions() {
    return MISSIONS.filter((mission) => this.isMissionUnlocked(mission) && !this.isMissionComplete(mission.id));
  }

  /** The mission shown in the tracker: the first active one, in story order. */
  focusedMission() {
    return this.activeMissions()[0] || null;
  }

  objectiveProgress(objective) {
    return this.state.objectives[objective.id] || 0;
  }

  isObjectiveDone(objective) {
    return this.objectiveProgress(objective) >= (objective.count || 1);
  }

  /** The next incomplete objective of the focused mission (drives beam/compass). */
  currentObjective() {
    for (const mission of this.activeMissions()) {
      const objective = mission.objectives.find((item) => !this.isObjectiveDone(item));
      if (objective) return { mission, objective };
    }
    return null;
  }

  addStars(amount, reason, { silent = false } = {}) {
    if (!amount) return;
    const before = this.rank;
    this.state.stars += amount;
    this.emit('stars', { amount, reason, silent, total: this.state.stars });
    const after = this.rank;
    if (after !== before) this.emit('rank', { rank: after });
  }

  /** Advance an objective if its mission is active. Returns true on progress. */
  progress(objectiveId, amount = 1) {
    for (const mission of this.activeMissions()) {
      const objective = mission.objectives.find((item) => item.id === objectiveId);
      if (!objective || this.isObjectiveDone(objective)) continue;
      const target = objective.count || 1;
      this.state.objectives[objectiveId] = Math.min(target, this.objectiveProgress(objective) + amount);
      this.emit('objective', { mission, objective, progress: this.state.objectives[objectiveId], target });
      if (this.isObjectiveDone(objective)) this.addStars(1, objective.text, { silent: true });
      if (mission.objectives.every((item) => this.isObjectiveDone(item))) this.completeMission(mission);
      this.save();
      return true;
    }
    return false;
  }

  completeMission(mission) {
    if (this.isMissionComplete(mission.id)) return;
    const unlockedBefore = new Set(this.activeMissions().map((item) => item.id));
    this.state.completedMissions.push(mission.id);
    this.addStars(mission.reward, `Mission: ${mission.title}`);
    this.emit('mission-complete', { mission });
    for (const next of this.activeMissions()) {
      if (unlockedBefore.has(next.id)) continue;
      this.emit('mission-start', { mission: next });
      this.catchUp(next);
    }
    if (MISSIONS.every((item) => this.isMissionComplete(item.id))) this.emit('game-complete', {});
    this.save();
  }

  /** Credit things the player already did before a mission unlocked. */
  catchUp(mission) {
    for (const objective of mission.objectives) {
      if (this.isObjectiveDone(objective)) continue;
      let already = 0;
      if (objective.id === 'collect') already = this.state.fragments.length;
      else if (objective.id.startsWith('talk-')) already = this.state.met.includes(objective.id.slice(5)) ? 1 : 0;
      else if (objective.id === 'restore') already = this.state.timelineRestored ? 1 : 0;
      const missing = Math.min(objective.count || 1, already) - this.objectiveProgress(objective);
      if (missing > 0) this.progress(objective.id, missing);
    }
  }

  meet(character) {
    if (!this.state.met.includes(character)) {
      this.state.met.push(character);
      this.save();
    }
    this.progress(`talk-${character}`);
  }

  hasFragment(id) {
    return this.state.fragments.includes(id);
  }

  collectFragment(id) {
    if (this.hasFragment(id)) return false;
    this.state.fragments.push(id);
    const fragment = FRAGMENTS.find((item) => item.id === id);
    this.addStars(1, fragment?.title);
    this.emit('fragment', { fragment, count: this.state.fragments.length, total: FRAGMENTS.length });
    this.progress('collect');
    this.save();
    return true;
  }

  restoreTimeline() {
    if (this.state.timelineRestored) return;
    this.state.timelineRestored = true;
    this.progress('restore');
    this.save();
  }
}
