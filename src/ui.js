// DOM user interface for "Echoes of History": title screen, mission tracker,
// compass, dialogue, quizzes, fragment cards, journal, timeline puzzle, ending.
import { FRAGMENTS, GAME_SUBTITLE, GAME_TITLE, MISSIONS, QUIZZES } from './content.js';
import { sfx } from './audio.js';

const CHARACTERS = {
  guide: { name: 'Gallery Guide', role: 'Museum Guide', initials: 'GG', hue: '#5b8fd6' },
  gandhi: { name: 'Mahatma Gandhi', role: '1869 – 1948 · Leader of Indian independence', initials: 'MG', hue: '#d98b3a' },
  einstein: { name: 'Albert Einstein', role: '1879 – 1955 · Theoretical physicist', initials: 'AE', hue: '#7aa6c2' },
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

export class GameUI {
  constructor(root) {
    this.root = root;
    this.modal = null; // name of the open blocking panel
    this.typing = null;
    this.build();
    window.addEventListener('keydown', (event) => this.onKey(event), true);
  }

  // ------------------------------------------------------------------ layout
  build() {
    this.root.innerHTML = '';
    this.tracker = el('section', 'tracker panel glass');
    this.compass = el('div', 'compass', '<div class="compass-strip"></div><div class="compass-marker"><span class="compass-diamond"></span><span class="compass-distance"></span></div><div class="compass-needle"></div>');
    this.prompt = el('div', 'prompt hidden');
    this.toasts = el('div', 'toasts');
    this.banner = el('div', 'banner hidden');
    this.flash = el('div', 'memory-flash');
    this.shutter = el('div', 'shutter');
    this.dialogue = el('section', 'dialogue hidden');
    this.card = el('section', 'fact-card hidden');
    this.quiz = el('section', 'modal quiz hidden');
    this.journal = el('section', 'modal journal hidden');
    this.timeline = el('section', 'modal timeline-puzzle hidden');
    this.ending = el('section', 'modal ending hidden');
    this.title = el('section', 'title-screen hidden');
    this.hud = el('div', 'hud-layer');
    this.hud.append(this.tracker, this.compass, this.prompt, this.toasts, this.banner);
    this.root.append(this.flash, this.hud, this.dialogue, this.card, this.quiz, this.journal, this.timeline, this.ending, this.shutter, this.title);
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
      <div class="title-inner">
        <p class="eyebrow">An interactive journey</p>
        <h1>${GAME_TITLE}</h1>
        <p class="subtitle">${GAME_SUBTITLE}</p>
        <p class="lede">The museum's Timeline of History has shattered. Meet the minds who shaped the world, recover six lost memories, and put time back in order.</p>
        <label class="name-field"><span>Your name for the visitor pass</span>
          <input id="player-name" maxlength="18" autocomplete="off" placeholder="e.g. Anuj" value="${escapeHtml(savedName || '')}" />
        </label>
        <div class="title-actions">
          ${hasSave ? '<button class="btn primary" data-act="continue">Continue your visit</button><button class="btn ghost" data-act="new">Start a new visit</button>' : '<button class="btn primary" data-act="new">Begin your visit</button>'}
        </div>
        <ul class="title-controls">
          <li><kbd>W A S D</kbd> walk</li><li><kbd>Drag</kbd> look</li><li><kbd>E</kbd> interact</li><li><kbd>J</kbd> journal</li><li><kbd>P</kbd> photo</li><li><kbd>M</kbd> sound</li>
        </ul>
      </div>
      <p class="title-credit">Headphones recommended · Characters can speak with you by voice</p>`;
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
    const mission = log.focusedMission();
    const rank = log.rank;
    const next = log.nextRank;
    const progress = next ? (log.state.stars - rank.stars) / (next.stars - rank.stars) : 1;
    let body = '';
    if (mission) {
      body = `<p class="tracker-label">Current mission</p><h3>${escapeHtml(mission.title)}</h3><ul>${mission.objectives.map((objective) => {
        const done = log.isObjectiveDone(objective);
        const count = objective.count ? ` <span class="count">${log.objectiveProgress(objective)}/${objective.count}</span>` : '';
        return `<li class="${done ? 'done' : ''}"><span class="check"></span>${escapeHtml(objective.text)}${count}</li>`;
      }).join('')}</ul>`;
      const others = log.activeMissions().length - 1;
      if (others > 0) body += `<p class="tracker-more">+${others} more active · press <kbd>J</kbd></p>`;
    } else {
      body = '<p class="tracker-label">All missions complete</p><h3>Curator of Time</h3><p class="tracker-more">Keep exploring, or take a souvenir photo with <kbd>P</kbd></p>';
    }
    this.tracker.innerHTML = `
      <div class="rank"><span class="star">★</span><strong>${log.state.stars}</strong><span class="rank-title">${escapeHtml(rank.title)}</span></div>
      <div class="rank-bar"><span style="width:${Math.round(progress * 100)}%"></span></div>
      ${body}`;
  }

  // ----------------------------------------------------------------- compass
  /**
   * `heading` and `targetBearing` are compass bearings in radians:
   * 0 = north (−Z), increasing clockwise toward east (+X).
   */
  updateCompass(heading, targetBearing, distance) {
    const strip = this.compass.querySelector('.compass-strip');
    const spacing = 22.5; // degrees per label
    const labelWidth = 40; // px, matches CSS
    const degrees = (((heading * 180) / Math.PI) % 360 + 360) % 360;
    // Centre the label for `degrees` (from the middle lap) under the needle at 170px.
    strip.style.transform = `translateX(${170 - (16 + degrees / spacing) * labelWidth - labelWidth / 2}px)`;
    const marker = this.compass.querySelector('.compass-marker');
    if (targetBearing === null) {
      marker.classList.add('hidden');
      return;
    }
    let relative = ((targetBearing - heading) * 180) / Math.PI;
    relative = ((relative % 360) + 540) % 360 - 180;
    const offscreen = Math.abs(relative) > 80;
    const x = THREE_clamp(relative, -80, 80) * (labelWidth / spacing);
    marker.classList.remove('hidden');
    marker.classList.toggle('edge', offscreen);
    marker.style.transform = `translateX(${x}px)`;
    marker.querySelector('.compass-distance').textContent = `${Math.round(distance)} m`;
  }

  // ------------------------------------------------------------------ prompt
  setPrompt(text) {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.prompt.innerHTML = `<kbd>E</kbd> ${escapeHtml(text)}`;
    this.prompt.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ toasts
  toast(text, kind = 'info', icon = '✦') {
    const node = el('div', `toast ${kind}`, `<span class="toast-icon">${icon}</span><span>${text}</span>`);
    this.toasts.prepend(node);
    while (this.toasts.children.length > 4) this.toasts.lastElementChild.remove();
    setTimeout(() => node.classList.add('out'), 3600);
    setTimeout(() => node.remove(), 4200);
  }

  showBanner(kicker, title) {
    this.banner.innerHTML = `<span class="kicker">${escapeHtml(kicker)}</span><strong>${escapeHtml(title)}</strong>`;
    this.banner.classList.remove('hidden', 'show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), 3400);
  }

  memoryFlash() {
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
  }

  photoFlash() {
    this.shutter.classList.remove('on');
    void this.shutter.offsetWidth;
    this.shutter.classList.add('on');
  }

  // ---------------------------------------------------------------- dialogue
  /**
   * Open a conversation. `node` = { text, options:[{label, onSelect}] }.
   * `voice` = { available, active, status, onStart, onStop }.
   */
  openDialogue(characterId, node, voice) {
    const character = CHARACTERS[characterId];
    this.modal = 'dialogue';
    this.dialogueCharacter = characterId;
    this.dialogue.classList.remove('hidden');
    this.dialogue.style.setProperty('--hue', character.hue);
    this.dialogue.innerHTML = `
      <div class="portrait"><span>${character.initials}</span></div>
      <div class="dialogue-body">
        <header><strong>${character.name}</strong><span>${character.role}</span><button class="icon-btn close" title="Close (Esc)">✕</button></header>
        <p class="dialogue-text"></p>
        <div class="voice-bar"></div>
        <ol class="dialogue-options"></ol>
      </div>`;
    this.dialogue.querySelector('.close').addEventListener('click', () => this.closeDialogueRequest?.());
    this.setDialogueNode(node);
    this.setVoice(voice);
  }

  setDialogueNode(node) {
    const text = this.dialogue.querySelector('.dialogue-text');
    const list = this.dialogue.querySelector('.dialogue-options');
    list.innerHTML = '';
    this.dialogueOptions = node.options;
    this.typeText(text, node.text, () => {
      node.options.forEach((option, index) => {
        const item = el('li');
        const button = el('button', 'option', `<span class="num">${index + 1}</span>${escapeHtml(option.label)}`);
        button.addEventListener('click', () => { sfx.click(); option.onSelect(); });
        button.addEventListener('mouseenter', () => sfx.hover());
        item.append(button);
        list.append(item);
      });
    });
  }

  typeText(target, fullText, done) {
    clearInterval(this.typing?.timer);
    target.textContent = '';
    let index = 0;
    const finish = () => {
      clearInterval(this.typing?.timer);
      target.textContent = fullText;
      this.typing = null;
      done?.();
    };
    this.typing = {
      finish,
      timer: setInterval(() => {
        index += 2;
        target.textContent = fullText.slice(0, index);
        if (index >= fullText.length) finish();
      }, 16),
    };
  }

  setVoice(voice) {
    const bar = this.dialogue.querySelector('.voice-bar');
    if (!bar) return;
    if (!voice?.available) {
      bar.innerHTML = '';
      return;
    }
    if (voice.active) {
      bar.innerHTML = `<span class="voice-status ${voice.status}"><span class="wave"><i></i><i></i><i></i><i></i></span>${voice.status === 'speaking' ? 'Speaking…' : voice.status === 'connecting' ? 'Connecting…' : 'Listening — just talk'}</span><button class="btn small ghost">End voice chat</button>`;
      bar.querySelector('button').addEventListener('click', () => voice.onStop());
    } else {
      bar.innerHTML = '<button class="btn small voice">🎙 Talk by voice</button><span class="voice-hint">or pick a question below</span>';
      bar.querySelector('button').addEventListener('click', () => voice.onStart());
    }
  }

  closeDialogue() {
    clearInterval(this.typing?.timer);
    this.typing = null;
    this.dialogue.classList.add('hidden');
    if (this.modal === 'dialogue') this.modal = null;
  }

  // --------------------------------------------------------------- fact card
  showFragmentCard(fragment, count, total, onClose) {
    this.memoryFlash();
    this.modal = 'card';
    this.card.classList.remove('hidden');
    this.card.style.setProperty('--hue', fragment.color);
    this.card.innerHTML = `
      <p class="eyebrow">Memory fragment ${count} of ${total}</p>
      <div class="year">${fragment.year}</div>
      <h2>${escapeHtml(fragment.title)}</h2>
      <p>${escapeHtml(fragment.text)}</p>
      <button class="btn primary">Continue <kbd>E</kbd></button>`;
    this.cardClose = () => {
      this.card.classList.add('hidden');
      this.modal = null;
      this.cardClose = null;
      onClose?.();
    };
    this.card.querySelector('button').addEventListener('click', () => { sfx.click(); this.cardClose?.(); });
  }

  showPlaque(plaque) {
    this.modal = 'card';
    this.card.classList.remove('hidden');
    this.card.style.setProperty('--hue', '#c9a45c');
    this.card.innerHTML = `<p class="eyebrow">Exhibit plaque</p><h2>${escapeHtml(plaque.title)}</h2><p>${escapeHtml(plaque.text)}</p><button class="btn primary">Close <kbd>E</kbd></button>`;
    this.cardClose = () => { this.card.classList.add('hidden'); this.modal = null; this.cardClose = null; };
    this.card.querySelector('button').addEventListener('click', () => { sfx.click(); this.cardClose?.(); });
  }

  // -------------------------------------------------------------------- quiz
  startQuiz(characterId, onFinish) {
    const questions = QUIZZES[characterId];
    const character = CHARACTERS[characterId];
    this.modal = 'quiz';
    this.quiz.classList.remove('hidden');
    this.quiz.style.setProperty('--hue', character.hue);
    let index = 0;
    let score = 0;
    const render = () => {
      const question = questions[index];
      this.quiz.innerHTML = `
        <div class="modal-card">
          <p class="eyebrow">${character.name} asks · question ${index + 1} of ${questions.length}</p>
          <div class="dots">${questions.map((_, i) => `<span class="${i < index ? 'past' : i === index ? 'now' : ''}"></span>`).join('')}</div>
          <h2>${escapeHtml(question.q)}</h2>
          <div class="answers">${question.options.map((option, i) => `<button class="answer" data-i="${i}"><span class="num">${i + 1}</span>${escapeHtml(option)}</button>`).join('')}</div>
          <p class="explain"></p>
        </div>`;
      this.quizAnswer = (choice) => {
        if (this.quizLocked) return;
        this.quizLocked = true;
        const buttons = [...this.quiz.querySelectorAll('.answer')];
        buttons.forEach((button) => { button.disabled = true; });
        buttons[question.answer].classList.add('correct');
        const right = choice === question.answer;
        if (right) { score += 1; sfx.correct(); } else { buttons[choice].classList.add('wrong'); sfx.wrong(); }
        this.quiz.querySelector('.explain').innerHTML = `<strong>${right ? 'Correct!' : 'Not quite.'}</strong> ${escapeHtml(question.explain)}`;
        setTimeout(() => {
          this.quizLocked = false;
          index += 1;
          if (index < questions.length) render();
          else finish();
        }, 1900);
      };
      this.quiz.querySelectorAll('.answer').forEach((button) => button.addEventListener('click', () => this.quizAnswer(Number(button.dataset.i))));
    };
    const finish = () => {
      const passed = onFinish(score);
      this.quizAnswer = null;
      this.quiz.innerHTML = `
        <div class="modal-card result">
          <p class="eyebrow">${character.name}'s quiz</p>
          <div class="score">${score}<span>/${questions.length}</span></div>
          <h2>${passed ? (score === questions.length ? 'Perfect score!' : 'Well done — you passed!') : 'So close! Talk to me again and try once more.'}</h2>
          <button class="btn primary">Continue <kbd>E</kbd></button>
        </div>`;
      this.quizClose = () => { this.quiz.classList.add('hidden'); this.modal = null; this.quizClose = null; };
      this.quiz.querySelector('button').addEventListener('click', () => { sfx.click(); this.quizClose?.(); });
      if (passed) sfx.success();
    };
    this.quizLocked = false;
    render();
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
    const rank = log.rank;
    const next = log.nextRank;
    const minutes = Math.max(1, Math.round((Date.now() - log.state.startedAt) / 60000));
    const stamps = ['guide', 'gandhi', 'einstein'].map((id) => {
      const met = log.state.met.includes(id);
      return `<div class="stamp ${met ? 'met' : ''}" style="--hue:${CHARACTERS[id].hue}"><span>${CHARACTERS[id].initials}</span><small>${met ? CHARACTERS[id].name : 'Not yet met'}</small></div>`;
    }).join('');
    const fragments = FRAGMENTS.map((fragment) => {
      const have = log.hasFragment(fragment.id);
      return `<div class="frag ${have ? 'have' : ''}" style="--hue:${fragment.color}"><span class="frag-year">${have ? fragment.year : '????'}</span><small>${have ? escapeHtml(fragment.title) : 'Undiscovered'}</small></div>`;
    }).join('');
    const missions = MISSIONS.map((mission) => {
      const done = log.isMissionComplete(mission.id);
      const unlocked = log.isMissionUnlocked(mission);
      const state = done ? 'done' : unlocked ? 'active' : 'locked';
      return `<li class="${state}"><div><strong>${escapeHtml(mission.title)}</strong><span>${unlocked ? escapeHtml(mission.blurb) : 'Locked — complete earlier missions first'}</span></div><em>${done ? 'Complete' : unlocked ? 'In progress' : 'Locked'}</em></li>`;
    }).join('');
    this.journal.classList.remove('hidden');
    this.journal.innerHTML = `
      <div class="modal-card journal-card">
        <header class="journal-head">
          <div><p class="eyebrow">Museum Journal</p><h2>${escapeHtml(log.name)}'s Visitor Pass</h2></div>
          <button class="icon-btn close" title="Close (J)">✕</button>
        </header>
        <div class="pass">
          <div class="pass-rank"><span class="star">★</span><strong>${log.state.stars}</strong><span>${escapeHtml(rank.title)}</span></div>
          <p>${next ? `${next.stars - log.state.stars} more ★ to become <strong>${escapeHtml(next.title)}</strong>` : 'Highest rank reached'} · ${minutes} min in the museum · ${log.state.photos} photo${log.state.photos === 1 ? '' : 's'}</p>
        </div>
        <h3>Missions</h3><ul class="mission-list">${missions}</ul>
        <h3>Memory fragments <span class="muted">${log.state.fragments.length}/${FRAGMENTS.length}</span></h3><div class="frag-grid">${fragments}</div>
        <h3>Passport stamps</h3><div class="stamps">${stamps}</div>
      </div>`;
    this.journal.querySelector('.close').addEventListener('click', () => this.closeJournal());
  }

  closeJournal() {
    this.journal.classList.add('hidden');
    if (this.modal === 'journal') this.modal = null;
    sfx.close();
  }

  // --------------------------------------------------------- timeline puzzle
  openTimeline(collectedIds, onSolved, onClose) {
    this.modal = 'timeline';
    sfx.open();
    const collected = FRAGMENTS.filter((fragment) => collectedIds.includes(fragment.id));
    const complete = collected.length === FRAGMENTS.length;
    const placed = [];
    this.timeline.classList.remove('hidden');
    let firstRender = true;
    const render = () => {
      const pool = shuffle(collected.filter((fragment) => !placed.includes(fragment)));
      this.timeline.innerHTML = `
        <div class="modal-card timeline-card ${firstRender ? '' : 'static'}">
          <header class="journal-head"><div><p class="eyebrow">The Timeline Wall</p><h2>${complete ? 'Put history back in order' : 'The wall is still broken'}</h2></div><button class="icon-btn close" title="Close (Esc)">✕</button></header>
          <p class="muted">${complete ? 'Choose the fragments from the <strong>earliest</strong> moment to the <strong>latest</strong>. Read each one carefully — the clues are in the stories.' : `You have found ${collected.length} of ${FRAGMENTS.length} fragments. Find them all, then return here.`}</p>
          <div class="slots">${FRAGMENTS.map((_, i) => {
            const fragment = placed[i];
            return `<div class="slot ${fragment ? 'filled' : ''}" style="--hue:${fragment?.color || '#555'}">${fragment ? `<strong>${fragment.year}</strong><small>${escapeHtml(fragment.title)}</small>` : `<span>${i + 1}</span>`}</div>`;
          }).join('')}</div>
          ${complete ? `<div class="pool">${pool.map((fragment) => `<button class="pool-card" data-id="${fragment.id}" style="--hue:${fragment.color}"><strong>${escapeHtml(fragment.title)}</strong><small>${escapeHtml(fragment.text.slice(0, 110))}…</small></button>`).join('')}</div>` : ''}
        </div>`;
      firstRender = false;
      this.timeline.querySelector('.close').addEventListener('click', () => this.closeTimeline(onClose));
      this.timeline.querySelectorAll('.pool-card').forEach((button) => button.addEventListener('click', () => {
        const fragment = FRAGMENTS.find((item) => item.id === button.dataset.id);
        const expected = [...FRAGMENTS].sort((a, b) => a.year - b.year)[placed.length];
        if (fragment === expected) {
          placed.push(fragment);
          sfx.correct();
          if (placed.length === FRAGMENTS.length) {
            render();
            setTimeout(() => { this.closeTimeline(); onSolved(); }, 900);
            return;
          }
          render();
        } else {
          sfx.wrong();
          button.classList.add('shake');
          setTimeout(() => button.classList.remove('shake'), 500);
        }
      }));
    };
    render();
  }

  closeTimeline(onClose) {
    this.timeline.classList.add('hidden');
    if (this.modal === 'timeline') this.modal = null;
    onClose?.();
  }

  // ------------------------------------------------------------------ ending
  showEnding(log, { onPhoto }) {
    this.modal = 'ending';
    const minutes = Math.max(1, Math.round((Date.now() - log.state.startedAt) / 60000));
    const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    this.ending.classList.remove('hidden');
    this.ending.innerHTML = `
      <div class="modal-card certificate">
        <p class="eyebrow">Certificate of Achievement</p>
        <h2>Curator of Time</h2>
        <p class="awarded">awarded to</p>
        <p class="recipient">${escapeHtml(log.name)}</p>
        <p>for restoring the Timeline of History at ${GAME_TITLE}, meeting Mahatma Gandhi and Albert Einstein, and recovering six lost memories.</p>
        <div class="cert-stats"><span><strong>${log.state.stars}</strong>stars</span><span><strong>${minutes}</strong>minutes</span><span><strong>${log.state.fragments.length}</strong>memories</span></div>
        <p class="cert-date">${date}</p>
        <div class="title-actions"><button class="btn primary" data-act="explore">Keep exploring</button><button class="btn ghost" data-act="photo">Take a souvenir photo</button></div>
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
    if (this.modal === 'title') return;
    if (this.modal === 'dialogue') {
      if (this.typing && (key === 'e' || key === 'E' || key === ' ' || key === 'Enter')) {
        this.typing.finish();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const number = Number(key);
      if (number >= 1 && number <= (this.dialogueOptions?.length || 0) && !this.typing) {
        sfx.click();
        this.dialogueOptions[number - 1].onSelect();
        event.stopPropagation();
        return;
      }
      if (key === 'Escape') { this.closeDialogueRequest?.(); event.stopPropagation(); }
      return;
    }
    if (this.modal === 'card' && (key === 'e' || key === 'E' || key === 'Enter' || key === 'Escape' || key === ' ')) {
      this.cardClose?.();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.modal === 'quiz') {
      const number = Number(key);
      if (this.quizAnswer && number >= 1 && number <= 4) { this.quizAnswer(number - 1); event.stopPropagation(); return; }
      if (this.quizClose && (key === 'e' || key === 'E' || key === 'Enter' || key === 'Escape')) { this.quizClose(); event.stopPropagation(); }
      return;
    }
    if (this.modal === 'journal' && (key === 'Escape' || key === 'j' || key === 'J' || key === 'Tab')) {
      this.closeJournal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.modal === 'timeline' && key === 'Escape') {
      this.closeTimeline();
      event.stopPropagation();
    }
  }
}

function THREE_clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
