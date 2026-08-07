/* The Box.
   Behaviour, storage model and copy follow the reference implementation.
   The interface is one object: the box. Everything begins by touching it. */

(function () {
  'use strict';

  var KEY = 'the-box-v1';
  var DAY = 24 * 60 * 60 * 1000;

  var DRIFT_MS = 1800;  // the written slip folding and dropping into the box
  var LID_MS = 900;     // the lid closing over it (lid transition is 700ms)
  var FOLD_MS = 1400;   // must match --t-paper in style.css
  var EMPTY_LINGER_MS = 2600;
  var EASE = 'cubic-bezier(0.3, 0.9, 0.35, 1.02)';
  // the one folded pose every paper animation shares (see style.css)
  var FOLDED = 'perspective(700px) rotateX(64deg) scaleY(0.3)';

  // ---------- storage, with an in-memory fallback ----------
  var mem = { tasks: [], current: null };
  var storageOk = true;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) mem = JSON.parse(raw);
      if (!mem || !Array.isArray(mem.tasks)) mem = { tasks: [] };
    } catch (e) {
      storageOk = false;
    }
    if (typeof mem.current === 'undefined') mem.current = null;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (e) {
      storageOk = false;
    }
  }

  load();

  // ---------- helpers ----------
  function now() { return Date.now(); }

  function available(t) {
    return !t.sleepUntil || t.sleepUntil <= now();
  }

  function availableTasks() {
    return mem.tasks.filter(available);
  }

  function normalize(s) {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  var effortWords = { 1: 'a light one', 2: 'a medium one', 3: 'a heavy one' };

  // ---------- elements ----------
  var $ = function (id) { return document.getElementById(id); };

  var stage = $('stage');
  var panels = {
    welcome: $('welcome'),
    calm: $('calm'),
    out: $('outPanel'),
    in: $('inPanel'),
    energy: $('energyPanel')
  };
  var choiceIn = $('choiceIn');
  var choiceOut = $('choiceOut');
  var boxBtn = $('box');

  var current = null;
  var skippedThisRound = [];
  var lastEnergy = null;
  var emptyCloseTimer = null;
  var busy = false;

  // ---------- state machine ----------
  // States: idle, choice, in, energy, reaching, out, calm
  function setState(name) {
    stage.dataset.state = name;
    Object.keys(panels).forEach(function (k) {
      panels[k].hidden = !(
        (name === 'out' && k === 'out') ||
        (name === 'in' && k === 'in') ||
        (name === 'energy' && k === 'energy') ||
        (name === 'calm' && k === 'calm') ||
        (name === 'welcome' && k === 'welcome')
      );
    });
    var choicesVisible = name === 'choice';
    choiceIn.hidden = !choicesVisible;
    choiceOut.hidden = !choicesVisible;
    if (emptyCloseTimer && name !== 'calm') {
      clearTimeout(emptyCloseTimer);
      emptyCloseTimer = null;
    }
  }

  function state() { return stage.dataset.state; }

  function toIdle() {
    setState('idle');
  }

  function calm(msg, sub) {
    $('calmMsg').textContent = msg;
    $('calmSub').textContent = sub || '';
    setState('calm');
    window.scrollTo(0, 0);
  }

  // ---------- touching the box ----------
  boxBtn.addEventListener('click', function () {
    if (busy) return;
    var s = state();
    if (s === 'idle' || s === 'calm' || s === 'welcome') {
      if (s === 'welcome') markWelcomed();
      setState('choice');
    } else if (s === 'choice' || s === 'in' || s === 'energy') {
      toIdle();
    }
  });

  choiceIn.addEventListener('click', function () {
    setState('in');
    $('task').focus();
  });

  choiceOut.addEventListener('click', function () {
    if (mem.tasks.length === 0) {
      // The box opens, shows nothing inside, says its line, then closes.
      setState('reaching');
      calmSoon('The box is empty.', 'Nothing is waiting. Enjoy that.', true);
      return;
    }
    if (availableTasks().length === 0) {
      setState('reaching');
      calmSoon('Everything is asleep.',
        'The recurring things will wake up when their time comes. Until then the box needs nothing from you.');
      return;
    }
    setState('energy');
  });

  function calmSoon(msg, sub, autoClose) {
    busy = true;
    setTimeout(function () {
      busy = false;
      calm(msg, sub);
      if (autoClose) {
        emptyCloseTimer = setTimeout(function () {
          emptyCloseTimer = null;
          toIdle();
        }, EMPTY_LINGER_MS);
      }
    }, 460);
  }

  // dismiss: Escape, or a tap outside the panels and the box
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var s = state();
    if (s === 'choice' || s === 'in' || s === 'energy') toIdle();
  });

  document.addEventListener('pointerdown', function (e) {
    var s = state();
    if (s !== 'choice' && s !== 'in' && s !== 'energy') return;
    if (e.target.closest('.panel') || e.target.closest('#boxWrap') ||
        e.target.closest('.choice') || e.target.closest('footer')) return;
    toIdle();
  });

  $('doneForNow').addEventListener('click', toIdle);

  // ---------- chips ----------
  function wireChips(containerId, attr) {
    var box = $(containerId);
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (c) {
        c.setAttribute('aria-pressed', c === btn ? 'true' : 'false');
      });
    });
  }

  function chipValue(containerId, attr) {
    var pressed = $(containerId).querySelector('.chip[aria-pressed="true"]');
    return pressed ? parseInt(pressed.getAttribute(attr), 10) : null;
  }

  wireChips('effortOpts', 'data-effort');
  wireChips('repeatOpts', 'data-repeat');

  // ---------- putting something in ----------
  function addTask() {
    if (busy) return;
    var text = $('task').value.trim();
    if (!text) {
      $('addNote').textContent = 'Type the task first. A few words is plenty.';
      $('task').focus();
      return;
    }
    var match = null;
    for (var i = 0; i < mem.tasks.length; i++) {
      if (normalize(mem.tasks[i].text) === normalize(text)) { match = mem.tasks[i]; break; }
    }
    if (match) {
      if (available(match)) {
        $('addNote').textContent = '“' + match.text + '” is already in the box. It hasn’t been forgotten.';
      } else {
        $('addNote').textContent = '“' + match.text + '” is already in the box, resting until its next time comes round.';
      }
      $('task').value = '';
      $('task').focus();
      return;
    }

    mem.tasks.push({
      id: String(now()) + Math.random().toString(16).slice(2),
      text: text,
      effort: chipValue('effortOpts', 'data-effort') || 1,
      repeat: chipValue('repeatOpts', 'data-repeat') || 0,
      sleepUntil: 0,
      added: now()
    });
    save();

    // The essential moment: the written slip lifts off the text field,
    // folds in half, drops into the box, and the lid closes over it.
    busy = true;
    $('addNote').textContent = '';

    var field = $('task');
    var slip = $('slip');
    var fieldRect = slip.getBoundingClientRect();
    var boxRect = document.getElementById('boxWrap').getBoundingClientRect();
    field.value = '';

    var drift = document.createElement('span');
    drift.className = 'paper drift';
    drift.textContent = text;
    drift.style.left = fieldRect.left + 'px';
    drift.style.top = fieldRect.top + 'px';
    drift.style.width = fieldRect.width + 'px';
    document.body.appendChild(drift);

    // into the mouth of the box
    var dx = (boxRect.left + boxRect.width / 2) - (fieldRect.left + fieldRect.width / 2);
    var dy = (boxRect.top + boxRect.height * 0.42) - fieldRect.top;

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var settle = function () {
      if (drift.parentNode) drift.parentNode.removeChild(drift);
      // If the input was dismissed mid-drift, don't drag the user back.
      if (stage.dataset.state !== 'in') { busy = false; return; }
      stage.dataset.state = 'settling'; // lid closes over it
      setTimeout(function () {
        busy = false;
        if (stage.dataset.state !== 'settling') return;
        stage.dataset.state = 'in';     // and opens again
        $('addNote').textContent = '“' + text + '” is in the box. You can forget it now.';
        field.focus();
      }, LID_MS);
    };

    if (drift.animate) {
      var anim = drift.animate([
        { transform: 'rotate(-0.8deg)', opacity: 1, offset: 0 },
        // folds in place first, along the same pose as every other fold
        { transform: FOLDED + ' rotate(-0.8deg)', opacity: 1, offset: 0.4 },
        // then travels to the mouth of the box, still folded
        { transform: 'translate(' + (dx * 0.85) + 'px, ' + (dy * 0.85) + 'px) ' +
          FOLDED + ' scale(0.65) rotate(-0.8deg)',
          opacity: 1, offset: 0.85 },
        // and sinks in
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) ' +
          FOLDED + ' scale(0.5) rotate(-0.8deg)',
          opacity: 0, offset: 1 }
      ], { duration: reduce ? 1 : DRIFT_MS, easing: EASE, fill: 'forwards' });
      anim.onfinish = settle;
    } else {
      setTimeout(settle, reduce ? 1 : DRIFT_MS);
    }
  }

  $('add').addEventListener('click', addTask);
  $('task').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addTask();
  });
  // the whole slip is writable, not just the line of text on it
  $('slip').addEventListener('click', function () { $('task').focus(); });

  // ---------- taking something out ----------
  function pick(energy) {
    // Tasks needing no more than current energy; oldest first so nothing rots forever.
    var pool = availableTasks().filter(function (t) {
      return t.effort <= energy && skippedThisRound.indexOf(t.id) === -1;
    });
    if (pool.length === 0) {
      // allow skipped ones back in before giving up
      pool = availableTasks().filter(function (t) { return t.effort <= energy; });
      skippedThisRound = [];
    }
    if (pool.length === 0) return null;
    pool.sort(function (a, b) { return a.added - b.added; });
    return pool[0];
  }

  function renderThing(t) {
    current = t;
    mem.current = t.id;
    save();

    var paper = $('paperCard');
    paper.classList.remove('unfold', 'foldaway', 'fade');
    void paper.offsetWidth;
    $('thing').textContent = t.text;
    paper.classList.add('unfold');

    var bits = [];
    bits.push(effortWords[t.effort] || 'a task');
    if (t.repeat > 0) bits.push('comes back ' + (t.repeat === 1 ? 'daily' : t.repeat === 7 ? 'weekly' : 'monthly'));
    $('thingMeta').textContent = 'This is ' + bits.join(', ') + '. The box is holding the rest so you don’t have to.';
    $('thingNote').textContent = '';
  }

  $('energyOpts').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    var energy = parseInt(btn.getAttribute('data-energy'), 10);
    lastEnergy = energy;
    skippedThisRound = [];
    var t = pick(energy);
    if (!t) {
      calm('Nothing fits the energy you have.',
        'Everything left in the box needs more than you’ve got right now, and that’s a fine reason to do none of it. Rest is allowed.');
      return;
    }
    $('outEyebrow').textContent = 'Just this';
    setState('out');
    renderThing(t);
    window.scrollTo(0, 0);
  });

  // ---------- done / skip / back ----------
  $('doneBtn').addEventListener('click', function () {
    if (!current || busy) return;
    busy = true;
    mem.current = null;
    var wasRecurring = current.repeat > 0;
    if (wasRecurring) {
      current.sleepUntil = now() + current.repeat * DAY;
    } else {
      mem.tasks = mem.tasks.filter(function (t) { return t.id !== current.id; });
    }
    save();
    current = null;

    // A recurring task folds back up and sinks into the box; a one-off
    // simply goes.
    var paper = $('paperCard');
    paper.classList.remove('unfold');
    void paper.offsetWidth;
    paper.classList.add(wasRecurring ? 'foldaway' : 'fade');

    setTimeout(function () {
      busy = false;
      if (availableTasks().length === 0) {
        calm('Done, and the box is quiet.', 'Nothing else is awake. Stop here with a clear head.');
        return;
      }
      calm('Done. That’s one more than none.',
        'You can stop here. Nothing is keeping score. If you’ve still got something in the tank, ask the box again.');
    }, FOLD_MS);
  });

  $('notThis').addEventListener('click', function () {
    if (!current || busy) return;
    skippedThisRound.push(current.id);
    var energy = lastEnergy || 3;
    var t = pick(energy);
    if (!t || t.id === current.id) {
      $('thingNote').textContent = 'That’s the only thing that fits your energy right now. Do it, or rest. Both are fine.';
      return;
    }
    // This one folds back into the box; the next one comes out and unfolds.
    busy = true;
    var paper = $('paperCard');
    paper.classList.remove('unfold');
    void paper.offsetWidth;
    paper.classList.add('foldaway');
    setTimeout(function () {
      busy = false;
      renderThing(t);
    }, FOLD_MS);
  });

  $('backBtn').addEventListener('click', function () {
    if (busy) return;
    busy = true;
    mem.current = null;
    save();
    current = null;
    // The paper folds back up and returns to the box, no comment.
    var paper = $('paperCard');
    paper.classList.remove('unfold');
    void paper.offsetWidth;
    paper.classList.add('foldaway');
    setTimeout(function () {
      busy = false;
      toIdle();
    }, FOLD_MS);
  });

  // ---------- the two footer icons ----------
  // Left: the explanation. Right: emptying the box, behind its warning.
  // Only one panel is open at a time; nothing is deleted until "Empty it".
  var aboutPanel = $('aboutPanel');
  var aboutBtn = $('aboutBtn');
  var emptyConfirm = $('emptyConfirm');
  var emptyBtn = $('emptyBox');

  function hideAbout() {
    aboutPanel.hidden = true;
    aboutBtn.setAttribute('aria-expanded', 'false');
  }

  function hideEmptyConfirm() {
    emptyConfirm.hidden = true;
    emptyBtn.setAttribute('aria-expanded', 'false');
  }

  aboutBtn.addEventListener('click', function () {
    if (aboutPanel.hidden) {
      hideEmptyConfirm();
      aboutPanel.hidden = false;
      aboutBtn.setAttribute('aria-expanded', 'true');
    } else {
      hideAbout();
    }
  });

  emptyBtn.addEventListener('click', function () {
    if (emptyConfirm.hidden) {
      hideAbout();
      emptyConfirm.hidden = false;
      emptyBtn.setAttribute('aria-expanded', 'true');
      $('emptyNo').focus();
    } else {
      hideEmptyConfirm();
    }
  });

  $('emptyYes').addEventListener('click', function () {
    mem = { tasks: [], current: null };
    current = null;
    save();
    hideEmptyConfirm();
    toIdle();
  });

  $('emptyNo').addEventListener('click', hideEmptyConfirm);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!emptyConfirm.hidden) hideEmptyConfirm();
    if (!aboutPanel.hidden) hideAbout();
  });

  // ---------- storage notice ----------
  if (!storageOk) {
    $('storageNote').textContent = 'Heads up: this browser is blocking storage, so the box will forget when the tab closes. Open the file in a normal browser tab for it to keep things.';
  }

  // ---------- first open ----------
  var WELCOME_KEY = 'the-box-welcomed';

  function wasWelcomed() {
    try { return localStorage.getItem(WELCOME_KEY) === '1'; } catch (e) { return false; }
  }

  function markWelcomed() {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* shown again next time */ }
  }

  // ---------- resume: the hand-off survives closing the app ----------
  (function resume() {
    if (!mem.current) {
      // Anyone with tasks has met the box before, even without the flag.
      if (mem.tasks.length > 0) markWelcomed();
      if (!wasWelcomed() && mem.tasks.length === 0) {
        setState('welcome');
      } else {
        toIdle();
      }
      return;
    }
    var t = null;
    for (var i = 0; i < mem.tasks.length; i++) {
      if (mem.tasks[i].id === mem.current) { t = mem.tasks[i]; break; }
    }
    if (!t) { mem.current = null; save(); toIdle(); return; }
    current = t;
    lastEnergy = 3;
    $('outEyebrow').textContent = 'Still yours';
    setState('out');
    $('thing').textContent = t.text;
    $('paperCard').classList.add('unfold');
    $('thingMeta').textContent = 'You took this out earlier. However long it took is however long it took.';
    $('thingNote').textContent = '';
  })();
})();
