// DOM user interface: title screen, mission tracker, compass, voice indicator,
// fragment cards, journal, timeline puzzle and ending. Kept deliberately light:
// conversations happen by voice, so the screen stays mostly clear.
import { FRAGMENTS, GAME_SUBTITLE, GAME_TITLE, MISSIONS } from './content.js';
import { sfx } from './audio.js';

const PORTRAITS = {
  guide: { initials: 'GG', hue: '#5b8fd6' },
  gandhi: { initials: 'MG', hue: '#d98b3a' },
  einstein: { initials: 'AE', hue: '#7aa6c2' },
};

const VOICE_STATUS = {
  connecting: 'Connecting…',
  listening: 'Listening',
  speaking: 'Speaking',
  ended: 'Walk away and come back to talk again',
  failed: 'Couldn’t connect — walk away and try again',
  unavailable: 'Voice chat isn’t set up',
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class GameUI {
  constructor(root) {
    this.root = root;
    this.modal = null; // name of the open blocking panel (title, journal, timeline, ending)
    this.build();
    window.addEventListener('keydown', (event) => this.onKey(event), true);
  }

  build() {
    this.root.innerHTML = '';
    this.tracker = el('section', 'placard');
    this.compass = el('div', 'compass', '<div class="compass-strip"></div><div class="compass-marker"><span class="compass-diamond"></span><span class="compass-distance"></span></div><div class="compass-needle"></div>');
    this.prompt = el('div', 'prompt hidden');
    this.voice = el('div', 'voice-pill hidden');
    this.toasts = el('div', 'toasts');
    this.banner = el('div', 'banner');
    this.card = el('aside', 'fact-card hidden');
    this.flash = el('div', 'memory-flash');
    this.shutter = el('div', 'shutter');
    this.journal = el('section', 'modal journal hidden');
    this.timeline = el('section', 'modal hidden');
    this.ending = el('section', 'modal hidden');
    this.title = el('section', 'title-screen hidden');
    this.hud = el('div', 'hud-layer');
    this.hud.append(this.tracker, this.compass, this.prompt, this.voice, this.toasts, this.banner, this.card);
    this.root.append(this.flash, this.hud, this.journal, this.timeline, this.ending, this.shutter, this.title);
    const strip = this.compass.querySelector('.compass-strip');
    const labels = ['N', '·', 'NE', '·', 'E', '·', 'SE', '·', 'S', '·', 'SW', '·', 'W', '·', 'NW', '·'];
    for (let lap = 0; lap < 3; lap += 1) {
      labels.forEach((label) => strip.append(el('span', label === '·' ? 'tick' : 'cardinal', label)));
    }
    this.setHudVisible(false);
  }

  setHudVisible(visible) {
    this.hud.classList.toggle('hidden', !visible);
    document.querySelector('#hud')?.classList.toggle('hidden', !visible);
  }

  isBlocking() {
    return Boolean(this.modal);
  }

  // ------------------------------------------------------------ title screen
  showTitle({ hasSave, savedName, onStart }) {
    this.modal = 'title';
    this.title.classList.remove('hidden');
    this.title.innerHTML = `
      <div class="ticket">
        <div class="ticket-main">
          <p class="ticket-kicker">Admission · Evening Exhibition</p>
          <h1>${GAME_TITLE}</h1>
          <p class="subtitle">${GAME_SUBTITLE}</p>
          <label class="ticket-field"><span>Visitor</span>
            <input id="player-name" maxlength="18" autocomplete="off" placeholder="Your name" value="${escapeHtml(savedName || '')}" />
          </label>
          <div class="title-actions">
            ${hasSave ? '<button class="btn primary" data-act="continue">Continue</button><button class="btn ghost" data-act="new">New visit</button>' : '<button class="btn primary" data-act="new">Enter the museum</button>'}
          </div>
        </div>
        <div class="ticket-stub"><span>ADMIT ONE</span><strong>№ ${String(1893 + Math.floor(Math.random() * 60)).padStart(4, '0')}</strong></div>
      </div>
      <p class="title-hint">Turn your sound and microphone on · walk up to anyone to talk</p>`;
    const input = this.title.querySelector('#player-name');
    const go = (mode) => {
      const name = (input.value || '').trim().slice(0, 18) || 'Visitor';
      this.title.classList.add('leaving');
      setTimeout(() => { this.title.classList.add('hidden'); this.title.classList.remove('leaving'); }, 900);
      this.modal = null;
      onStart({ mode, name });
    };
    this.title.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => go(button.dataset.act)));
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') go(hasSave ? 'continue' : 'new');
    });
    setTimeout(() => input.focus(), 400);
  }

  // ----------------------------------------------------------------- tracker
  renderTracker(log) {
    const current = log.currentObjective();
    let html = '<span class="next-label">Complete</span><span class="next-text">Enjoy the museum</span>';
    if (current) {
      const { objective } = current;
      const count = objective.count ? `<span class="next-count">${log.objectiveProgress(objective)}/${objective.count}</span>` : '';
      html = `<span class="next-label">Next</span><span class="next-text">${escapeHtml(objective.text)}</span>${count}`;
    }
    if (html === this.trackerHtml) return;
    this.trackerHtml = html;
    this.tracker.innerHTML = html;
    this.tracker.classList.remove('changed');
    void this.tracker.offsetWidth;
    this.tracker.classList.add('changed');
  }

  // ----------------------------------------------------------------- compass
  /** Bearings in radians: 0 = north (−Z), increasing clockwise toward east (+X). */
  updateCompass(heading, targetBearing, distance) {
    const strip = this.compass.querySelector('.compass-strip');
    const spacing = 22.5;
    const labelWidth = 40;
    const degrees = ((((heading * 180) / Math.PI) % 360) + 360) % 360;
    strip.style.transform = `translateX(${130 - (16 + degrees / spacing) * labelWidth - labelWidth / 2}px)`;
    const marker = this.compass.querySelector('.compass-marker');
    if (targetBearing === null) {
      marker.classList.add('hidden');
      return;
    }
    let relative = ((targetBearing - heading) * 180) / Math.PI;
    relative = ((relative % 360) + 540) % 360 - 180;
    marker.classList.remove('hidden');
    marker.classList.toggle('edge', Math.abs(relative) > 60);
    marker.style.transform = `translateX(${clamp(relative, -60, 60) * (labelWidth / spacing)}px)`;
    marker.querySelector('.compass-distance').textContent = `${Math.round(distance)}m`;
  }

  // ------------------------------------------------------ prompt and voice
  setPrompt(text) {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    if (this.prompt.dataset.text !== text) {
      this.prompt.dataset.text = text;
      this.prompt.innerHTML = `<kbd>E</kbd> ${escapeHtml(text)}`;
    }
    this.prompt.classList.remove('hidden');
  }

  /** Small non-blocking indicator of the live voice conversation. */
  showVoice(exhibit, status) {
    const portrait = PORTRAITS[exhibit.id] || PORTRAITS.guide;
    this.voice.style.setProperty('--hue', portrait.hue);
    this.voice.className = `voice-pill ${status}`;
    this.voice.innerHTML = `
      <span class="voice-portrait">${portrait.initials}</span>
      <span class="voice-name">${escapeHtml(exhibit.name)}</span>
      <span class="wave"><i></i><i></i><i></i><i></i></span>
      <span class="voice-status">${VOICE_STATUS[status] || ''}</span>`;
  }

  hideVoice() {
    this.voice.classList.add('hidden');
  }

  // ------------------------------------------------------------------ toasts
  toast(text, icon = '✦') {
    const node = el('div', 'toast', `<span class="toast-icon">${icon}</span><span>${text}</span>`);
    this.toasts.prepend(node);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild.remove();
    setTimeout(() => node.classList.add('out'), 3200);
    setTimeout(() => node.remove(), 3800);
  }

  showBanner(kicker, title) {
    this.banner.innerHTML = `<span class="kicker">${escapeHtml(kicker)}</span><strong>${escapeHtml(title)}</strong>`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), 3000);
  }

  photoFlash() {
    this.shutter.classList.remove('on');
    void this.shutter.offsetWidth;
    this.shutter.classList.add('on');
  }

  // ------------------------------------------------ fragment and plaque cards
  /** Non-blocking card in the corner; fades on its own, E dismisses early. */
  showCard({ eyebrow, year, title, text, hue = '#d8b36a', memory = false }) {
    if (memory) {
      this.flash.classList.remove('on');
      void this.flash.offsetWidth;
      this.flash.classList.add('on');
    }
    this.card.style.setProperty('--hue', hue);
    this.card.innerHTML = `
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      ${year ? `<div class="year">${year}</div>` : ''}
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>`;
    this.card.classList.remove('hidden', 'out');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => this.hideCard(), 7000);
  }

  showFragmentCard(fragment, count, total) {
    this.showCard({ eyebrow: `Memory ${count} of ${total}`, year: fragment.year, title: fragment.title, text: fragment.text, hue: fragment.color, memory: true });
  }

  showPlaque(plaque) {
    this.showCard({ eyebrow: 'Exhibit', title: plaque.title, text: plaque.text });
  }

  get cardVisible() {
    return !this.card.classList.contains('hidden') && !this.card.classList.contains('out');
  }

  hideCard() {
    clearTimeout(this.cardTimer);
    this.card.classList.add('out');
    setTimeout(() => { if (this.card.classList.contains('out')) this.card.classList.add('hidden'); }, 500);
  }

  // ----------------------------------------------------------------- journal
  toggleJournal(log) {
    if (this.modal === 'journal') {
      this.closeJournal();
      return;
    }
    if (this.modal) return;
    this.modal = 'journal';
    sfx.open();
    const stamps = ['guide', 'gandhi', 'einstein'].map((id) => {
      const met = log.state.met.includes(id);
      return `<div class="stamp ${met ? 'met' : ''}" style="--hue:${PORTRAITS[id].hue}"><span>${PORTRAITS[id].initials}</span></div>`;
    }).join('');
    const fragments = FRAGMENTS.map((fragment) => {
      const have = log.hasFragment(fragment.id);
      return `<div class="frag ${have ? 'have' : ''}" style="--hue:${fragment.color}"><span class="frag-year">${have ? fragment.year : '?'}</span><small>${have ? escapeHtml(fragment.title) : ''}</small></div>`;
    }).join('');
    const missions = MISSIONS.map((mission) => {
      const state = log.isMissionComplete(mission.id) ? 'done' : log.isMissionUnlocked(mission) ? 'active' : 'locked';
      return `<li class="${state}"><span class="check"></span>${escapeHtml(mission.title)}</li>`;
    }).join('');
    this.journal.classList.remove('hidden');
    this.journal.innerHTML = `
      <div class="passport">
        <button class="icon-btn close" title="Close (J)">✕</button>
        <div class="passport-page left">
          <p class="eyebrow">Visitor passport</p>
          <h2>${escapeHtml(log.name)}</h2>
          <p class="passport-rank"><span>★ ${log.state.stars}</span>${escapeHtml(log.rank.title)}</p>
          <ul class="mission-list">${missions}</ul>
        </div>
        <div class="passport-page right">
          <p class="eyebrow">Memories</p>
          <div class="frag-grid">${fragments}</div>
          <p class="eyebrow">Stamps</p>
          <div class="stamps">${stamps}</div>
        </div>
      </div>`;
    this.journal.querySelector('.close').addEventListener('click', () => this.closeJournal());
  }

  closeJournal() {
    this.journal.classList.add('hidden');
    if (this.modal === 'journal') this.modal = null;
    sfx.close();
  }

  // --------------------------------------------------------- timeline puzzle
  openTimeline(collectedIds, onSolved) {
    const collected = FRAGMENTS.filter((fragment) => collectedIds.includes(fragment.id));
    if (collected.length < FRAGMENTS.length) {
      this.toast(`${collected.length}/${FRAGMENTS.length} memories found — come back with all six`);
      return;
    }
    this.modal = 'timeline';
    sfx.open();
    const placed = [];
    const order = [...FRAGMENTS].sort((a, b) => a.year - b.year);
    let firstRender = true;
    this.timeline.classList.remove('hidden');
    const render = () => {
      const pool = shuffle(collected.filter((fragment) => !placed.includes(fragment)));
      this.timeline.innerHTML = `
        <div class="modal-card timeline-card ${firstRender ? '' : 'static'}">
          <header class="journal-head"><h2>Oldest first</h2><button class="icon-btn close" title="Close (Esc)">✕</button></header>
          <div class="slots">${FRAGMENTS.map((_, i) => {
            const fragment = placed[i];
            const fresh = fragment && i === placed.length - 1 ? 'fresh' : '';
            return `<div class="slot ${fragment ? 'filled' : ''} ${fresh}" style="--hue:${fragment?.color || '#555'}">${fragment ? `<strong>${fragment.year}</strong><small>${escapeHtml(fragment.title)}</small>` : `<span>${i + 1}</span>`}</div>`;
          }).join('')}</div>
          <div class="pool">${pool.map((fragment) => `<button class="pool-card" data-id="${fragment.id}" style="--hue:${fragment.color}">${escapeHtml(fragment.title)}</button>`).join('')}</div>
        </div>`;
      firstRender = false;
      this.timeline.querySelector('.close').addEventListener('click', () => this.closeTimeline());
      this.timeline.querySelectorAll('.pool-card').forEach((button) => button.addEventListener('click', () => {
        const fragment = FRAGMENTS.find((item) => item.id === button.dataset.id);
        if (fragment !== order[placed.length]) {
          sfx.wrong();
          button.classList.add('shake');
          setTimeout(() => button.classList.remove('shake'), 500);
          return;
        }
        placed.push(fragment);
        sfx.correct();
        render();
        if (placed.length === FRAGMENTS.length) setTimeout(() => { this.closeTimeline(); onSolved(); }, 900);
      }));
    };
    render();
  }

  closeTimeline() {
    this.timeline.classList.add('hidden');
    if (this.modal === 'timeline') this.modal = null;
  }

  // ------------------------------------------------------------------ ending
  showEnding(log, { onPhoto }) {
    this.modal = 'ending';
    this.ending.classList.remove('hidden');
    this.ending.innerHTML = `
      <div class="modal-card certificate">
        <div class="seal">★</div>
        <p class="eyebrow">Certificate of achievement</p>
        <h2>Curator of Time</h2>
        <p class="recipient">${escapeHtml(log.name)}</p>
        <div class="cert-stats"><span><strong>${log.state.stars}</strong>stars</span><span><strong>${log.state.fragments.length}</strong>memories</span></div>
        <div class="title-actions"><button class="btn primary" data-act="explore">Keep exploring</button><button class="btn ghost" data-act="photo">Photo</button></div>
      </div>`;
    this.ending.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      sfx.click();
      this.ending.classList.add('hidden');
      this.modal = null;
      if (button.dataset.act === 'photo') setTimeout(onPhoto, 250);
    }));
  }

  // --------------------------------------------------------------- keyboard
  onKey(event) {
    const key = event.key;
    if (this.modal === 'journal' && (key === 'Escape' || key === 'j' || key === 'J' || key === 'Tab')) {
      this.closeJournal();
      event.preventDefault();
      event.stopPropagation();
    } else if (this.modal === 'timeline' && key === 'Escape') {
      this.closeTimeline();
      event.stopPropagation();
    } else if (this.modal === 'ending' && (key === 'Escape' || key === 'Enter')) {
      this.ending.querySelector('[data-act="explore"]')?.click();
      event.stopPropagation();
    }
  }
}
