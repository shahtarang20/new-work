(function () {
  'use strict';

  document.getElementById('year').textContent = new Date().getFullYear();

  /* =========================================================
     THEME
  ========================================================= */
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('sudoku_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sudoku_theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });

  /* =========================================================
     SUDOKU ENGINE — generator + solver (backtracking, unique)
  ========================================================= */
  const SIZE = 9;

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function isSafe(grid, row, col, num) {
    for (let i = 0; i < SIZE; i++) {
      if (grid[row][i] === num || grid[i][col] === num) return false;
    }
    const br = row - (row % 3), bc = col - (col % 3);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        if (grid[br + r][bc + c] === num) return false;
    return true;
  }

  function shuffledDigits() {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fillGrid(grid) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) {
          for (const num of shuffledDigits()) {
            if (isSafe(grid, r, c, num)) {
              grid[r][c] = num;
              if (fillGrid(grid)) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function countSolutions(grid, limit = 2) {
    let count = 0;
    function solve(g) {
      if (count >= limit) return;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (g[r][c] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (isSafe(g, r, c, num)) {
                g[r][c] = num;
                solve(g);
                g[r][c] = 0;
                if (count >= limit) return;
              }
            }
            return;
          }
        }
      }
      count++;
    }
    solve(grid.map((row) => row.slice()));
    return count;
  }

  const DIFFICULTY_HOLES = { easy: 36, medium: 46, hard: 54, expert: 60 };

  function generatePuzzle(difficulty) {
    const solution = emptyGrid();
    fillGrid(solution);
    const puzzle = solution.map((row) => row.slice());
    const holes = DIFFICULTY_HOLES[difficulty] || 46;

    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    let removed = 0;
    for (const [r, c] of cells) {
      if (removed >= holes) break;
      const backup = puzzle[r][c];
      puzzle[r][c] = 0;
      const copy = puzzle.map((row) => row.slice());
      if (countSolutions(copy, 2) !== 1) {
        puzzle[r][c] = backup;
      } else {
        removed++;
      }
    }
    return { puzzle, solution };
  }

  /* =========================================================
     GAME STATE
  ========================================================= */
  const boardEl = document.getElementById('board');
  const timerEl = document.getElementById('timer');
  const mistakesEl = document.getElementById('mistakes');
  const scoreEl = document.getElementById('score');
  const difficultySel = document.getElementById('difficulty');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const overlayBtn = document.getElementById('overlayBtn');
  const noteBtn = document.getElementById('noteBtn');
  const hintBtn = document.getElementById('hintBtn');
  const undoBtn = document.getElementById('undoBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const numpad = document.getElementById('numpad');

  const MAX_MISTAKES = 3;

  let state = {
    puzzle: null,
    solution: null,
    values: null,   // current entered values
    fixed: null,    // boolean grid of given cells
    notes: null,    // array of Sets per cell
    selected: null,
    mistakes: 0,
    score: 0,
    seconds: 0,
    timerId: null,
    paused: false,
    noteMode: false,
    history: [],
    difficulty: 'medium',
    solved: false,
  };

  function cellIndex(r, c) { return r * 9 + c; }

  function buildBoardDom() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const div = document.createElement('div');
        div.className = 'cell';
        div.dataset.row = r;
        div.dataset.col = c;
        div.setAttribute('role', 'gridcell');
        const notesGrid = document.createElement('div');
        notesGrid.className = 'notes-grid';
        for (let n = 1; n <= 9; n++) {
          const span = document.createElement('span');
          notesGrid.appendChild(span);
        }
        const valueSpan = document.createElement('span');
        valueSpan.className = 'value';
        div.appendChild(valueSpan);
        div.appendChild(notesGrid);
        div.addEventListener('click', () => selectCell(r, c));
        boardEl.appendChild(div);
      }
    }
  }
  buildBoardDom();

  function newGame(difficulty) {
    state.difficulty = difficulty || difficultySel.value;
    const { puzzle, solution } = generatePuzzle(state.difficulty);
    state.puzzle = puzzle;
    state.solution = solution;
    state.values = puzzle.map((row) => row.slice());
    state.fixed = puzzle.map((row) => row.map((v) => v !== 0));
    state.notes = Array.from({ length: 81 }, () => new Set());
    state.selected = null;
    state.mistakes = 0;
    state.score = 0;
    state.seconds = 0;
    state.paused = false;
    state.history = [];
    state.solved = false;
    updateStats();
    overlay.classList.add('hidden');
    renderBoard();
    startTimer();
    saveGame();
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(() => {
      if (!state.paused && !state.solved) {
        state.seconds++;
        timerEl.textContent = formatTime(state.seconds);
      }
    }, 1000);
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
  }
  function formatTime(total) {
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function selectCell(r, c) {
    if (state.paused || state.solved) return;
    state.selected = [r, c];
    renderBoard();
  }

  function setValue(r, c, num) {
    if (state.fixed[r][c] || state.paused || state.solved) return;
    const idx = cellIndex(r, c);

    if (state.noteMode) {
      if (num === 0) {
        state.notes[idx].clear();
      } else if (state.notes[idx].has(num)) {
        state.notes[idx].delete(num);
      } else {
        state.notes[idx].add(num);
      }
      renderBoard();
      saveGame();
      return;
    }

    state.history.push({
      r, c,
      prevValue: state.values[r][c],
      prevNotes: new Set(state.notes[idx]),
    });

    state.values[r][c] = num;
    if (num !== 0) state.notes[idx].clear();

    if (num !== 0 && num !== state.solution[r][c]) {
      state.mistakes++;
      updateStats();
      if (state.mistakes >= MAX_MISTAKES) {
        renderBoard();
        endGame(false);
        return;
      }
    } else if (num !== 0) {
      state.score += 10;
      // clear notes of this number in same row/col/box
      clearPeerNotes(r, c, num);
      updateStats();
    }

    renderBoard();
    saveGame();
    checkWin();
  }

  function clearPeerNotes(r, c, num) {
    for (let i = 0; i < 9; i++) {
      state.notes[cellIndex(r, i)].delete(num);
      state.notes[cellIndex(i, c)].delete(num);
    }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        state.notes[cellIndex(br + dr, bc + dc)].delete(num);
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    state.values[last.r][last.c] = last.prevValue;
    state.notes[cellIndex(last.r, last.c)] = last.prevNotes;
    renderBoard();
    saveGame();
  }

  function giveHint() {
    if (state.solved || state.paused) return;
    let target = state.selected;
    if (!target || state.values[target[0]][target[1]] === state.solution[target[0]][target[1]] && state.fixed[target[0]][target[1]] === false && state.values[target[0]][target[1]] !== 0) {
      target = null;
    }
    if (!target || state.fixed[target[0]][target[1]]) {
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!state.fixed[r][c] && state.values[r][c] !== state.solution[r][c]) {
            target = [r, c];
            break outer;
          }
        }
      }
    }
    if (!target) return;
    const [r, c] = target;
    if (state.values[r][c] === state.solution[r][c]) return;
    state.history.push({ r, c, prevValue: state.values[r][c], prevNotes: new Set(state.notes[cellIndex(r, c)]) });
    state.values[r][c] = state.solution[r][c];
    state.notes[cellIndex(r, c)].clear();
    clearPeerNotes(r, c, state.solution[r][c]);
    state.score = Math.max(0, state.score - 5);
    state.selected = [r, c];
    updateStats();
    renderBoard();
    const domCell = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (domCell) {
      domCell.classList.add('hint-flash');
      setTimeout(() => domCell.classList.remove('hint-flash'), 800);
    }
    saveGame();
    checkWin();
  }

  function checkWin() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (state.values[r][c] !== state.solution[r][c]) return;
    endGame(true);
  }

  function endGame(won) {
    state.solved = true;
    stopTimer();
    if (won) {
      const timeBonus = Math.max(0, 500 - state.seconds);
      state.score += timeBonus;
      updateStats();
      overlayTitle.textContent = '🎉 Puzzle Solved!';
      overlayText.textContent = `Time: ${formatTime(state.seconds)} · Mistakes: ${state.mistakes} · Score: ${state.score}`;
      overlayBtn.textContent = 'Play Again';
    } else {
      overlayTitle.textContent = '😕 Out of Mistakes';
      overlayText.textContent = `You made ${MAX_MISTAKES} mistakes. Try a new puzzle!`;
      overlayBtn.textContent = 'New Puzzle';
    }
    overlay.classList.remove('hidden');
    localStorage.removeItem('sudoku_save');
  }

  function updateStats() {
    mistakesEl.textContent = `${state.mistakes}/${MAX_MISTAKES}`;
    scoreEl.textContent = state.score;
    timerEl.textContent = formatTime(state.seconds);
  }

  function renderBoard() {
    const cellsDom = boardEl.children;
    const [selR, selC] = state.selected || [null, null];
    const selVal = selR !== null ? state.values[selR][selC] : 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = cellIndex(r, c);
        const el = cellsDom[idx];
        el.classList.remove('selected', 'peer', 'same-value', 'error', 'fixed');
        const val = state.values[r][c];
        const valueSpan = el.querySelector('.value');
        const notesGrid = el.querySelector('.notes-grid');

        if (state.fixed[r][c]) el.classList.add('fixed');

        if (val !== 0) {
          valueSpan.textContent = val;
          notesGrid.style.display = 'none';
          if (!state.fixed[r][c] && val !== state.solution[r][c]) {
            el.classList.add('error');
          }
        } else {
          valueSpan.textContent = '';
          const notes = state.notes[idx];
          if (notes.size) {
            notesGrid.style.display = 'grid';
            for (let n = 1; n <= 9; n++) {
              notesGrid.children[n - 1].textContent = notes.has(n) ? n : '';
            }
          } else {
            notesGrid.style.display = 'none';
          }
        }

        if (selR !== null) {
          if (r === selR && c === selC) el.classList.add('selected');
          else if (r === selR || c === selC ||
            (Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3))) {
            el.classList.add('peer');
          }
          if (selVal !== 0 && val === selVal) el.classList.add('same-value');
        }
      }
    }
  }

  /* =========================================================
     SAVE / RESTORE
  ========================================================= */
  function saveGame() {
    try {
      const serializable = {
        puzzle: state.puzzle,
        solution: state.solution,
        values: state.values,
        fixed: state.fixed,
        notes: state.notes.map((s) => Array.from(s)),
        mistakes: state.mistakes,
        score: state.score,
        seconds: state.seconds,
        difficulty: state.difficulty,
      };
      localStorage.setItem('sudoku_save', JSON.stringify(serializable));
    } catch (e) { /* storage unavailable — ignore */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem('sudoku_save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.puzzle = data.puzzle;
      state.solution = data.solution;
      state.values = data.values;
      state.fixed = data.fixed;
      state.notes = data.notes.map((arr) => new Set(arr));
      state.mistakes = data.mistakes;
      state.score = data.score;
      state.seconds = data.seconds;
      state.difficulty = data.difficulty || 'medium';
      state.history = [];
      state.selected = null;
      state.solved = false;
      difficultySel.value = state.difficulty;
      updateStats();
      renderBoard();
      startTimer();
      return true;
    } catch (e) {
      return false;
    }
  }

  /* =========================================================
     EVENTS
  ========================================================= */
  numpad.addEventListener('click', (e) => {
    const btn = e.target.closest('.num-btn');
    if (!btn || !state.selected) return;
    const num = parseInt(btn.dataset.num, 10);
    setValue(state.selected[0], state.selected[1], num);
  });

  document.addEventListener('keydown', (e) => {
    if (!state.selected) return;
    const [r, c] = state.selected;
    if (e.key >= '1' && e.key <= '9') {
      setValue(r, c, parseInt(e.key, 10));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      setValue(r, c, 0);
    } else if (e.key === 'ArrowUp') { selectCell(Math.max(0, r - 1), c); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { selectCell(Math.min(8, r + 1), c); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { selectCell(r, Math.max(0, c - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { selectCell(r, Math.min(8, c + 1)); e.preventDefault(); }
  });

  noteBtn.addEventListener('click', () => {
    state.noteMode = !state.noteMode;
    noteBtn.classList.toggle('active', state.noteMode);
  });

  hintBtn.addEventListener('click', giveHint);
  undoBtn.addEventListener('click', undo);

  pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? '▶ Resume' : '⏸ Pause';
    boardEl.style.filter = state.paused ? 'blur(6px)' : 'none';
  });

  newGameBtn.addEventListener('click', () => {
    if (confirm('Start a new puzzle? Current progress will be lost.')) {
      newGame(difficultySel.value);
    }
  });

  difficultySel.addEventListener('change', () => {
    newGame(difficultySel.value);
  });

  overlayBtn.addEventListener('click', () => newGame(state.difficulty));

  /* =========================================================
     INIT
  ========================================================= */
  if (!loadGame()) {
    newGame('medium');
  }

  /* =========================================================
     ADSENSE — request ads, then hide any slot that stays empty
  ========================================================= */
  function initAds() {
    // Ad slots start hidden (see CSS) and are only revealed once a real ad
    // has actually been served — this guarantees no blank/dead space when
    // AdSense has no fill, is blocked, or hasn't loaded (e.g. local testing).
    const slots = document.querySelectorAll('.ad-slot');
    slots.forEach((slot) => {
      const ins = slot.querySelector('ins.adsbygoogle');
      if (!ins) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) { /* blocked or not loaded — slot simply stays hidden */ }

      const reveal = () => {
        const status = ins.getAttribute('data-ad-status');
        if (status === 'filled' || ins.offsetHeight > 10) {
          slot.classList.add('ad-visible');
        } else {
          slot.classList.remove('ad-visible');
        }
      };

      const observer = new MutationObserver(reveal);
      observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status', 'style'] });
      setTimeout(reveal, 1200);
      setTimeout(reveal, 3000);
    });
  }

  window.addEventListener('load', initAds);
})();
