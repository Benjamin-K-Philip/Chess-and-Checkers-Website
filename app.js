/* Sixty-Four — screens, settings and game flow */
/* ============================================================
   INTERFACE
   ============================================================ */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const body = document.body;

/* ---------- settings ---------- */
const THEMES = [
  {id:'baize',    name:'Baize & Brass', note:'Default',      cols:['#0E1A17','#C9A227','#D9CDB0','#3E5F4C']},
  {id:'midnight', name:'Midnight Ink',  note:'Deep blue',    cols:['#090D18','#7C9CF5','#C6CDDF','#3C4870']},
  {id:'ivory',    name:'Ivory Hall',    note:'Light',        cols:['#EDF0F2','#2F6F62','#E3EAEC','#7C939E']},
  {id:'coral',    name:'Coral Room',    note:'Warm',         cols:['#180E14','#EF6A88','#F0D6DC','#8A4A62']},
  {id:'terminal', name:'Terminal',      note:'Mono green',   cols:['#060E08','#4FE07B','#1E4A2A','#0C2413']},
  {id:'rosewood', name:'Rosewood',      note:'Classic wood', cols:['#19110E','#D9A05B','#E8D3B3','#7B4A34']}
];
const settings = {theme:'baize', panel:'side', size:'m', coords:'off', pieces:'glyph', motion:'on', home:'row'};

/* ---------- saved state (settings + game in progress) ---------- */
const STORE = 'sixtyfour.v1';
function readStore(){
  try{ return JSON.parse(localStorage.getItem(STORE)) || {}; }catch(e){ return {}; }
}
function writeStore(patch){
  try{ localStorage.setItem(STORE, JSON.stringify(Object.assign(readStore(), patch))); }catch(e){}
}
function saveGame(){
  if(!G || G.over) return writeStore({game:null});
  writeStore({game:{kind:G.kind, diff:G.diff, human:G.human, state:G.state, log:G.log,
                    yourTake:G.yourTake, aiTake:G.aiTake, last:G.last, seen:G.seen}});
}
function loadSettings(){
  const saved = readStore().settings;
  if(saved) for(const k in settings) if(saved[k] !== undefined) settings[k] = saved[k];
}

function applySettings(){
  document.documentElement.dataset.theme = settings.theme;
  for(const k of ['panel','size','coords','pieces','motion','home']) body.dataset[k] = settings[k];
  $$('#themeSwatches .sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === settings.theme));
  $$('.seg[data-setting]').forEach(seg => {
    const key = seg.dataset.setting;
    Array.from(seg.children).forEach(b => b.setAttribute('aria-pressed', b.dataset.val === settings[key]));
  });
  writeStore({settings});
}
function buildSettings(){
  $('#themeSwatches').innerHTML = THEMES.map(t => `
    <button class="sw" data-theme="${t.id}" aria-pressed="false">
      <span class="bars">${t.cols.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span>${t.name}</span><em>${t.note}</em>
    </button>`).join('');
  $('#themeSwatches').addEventListener('click', e => {
    const b = e.target.closest('.sw'); if(!b) return;
    settings.theme = b.dataset.theme; applySettings();
  });
  $$('.seg[data-setting]').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    settings[seg.dataset.setting] = b.dataset.val; applySettings();
    if(G) draw();
  }));
}

/* ---------- navigation ---------- */
const SCREENS = {home:'s-home', chess:'s-chess', checkers:'s-checkers',
                 'rules-chess':'s-rules-chess', 'rules-checkers':'s-rules-checkers',
                 game:'s-game', settings:'s-settings'};
let current = 'home';
function show(name){
  current = name;
  Object.entries(SCREENS).forEach(([k,id]) => $('#'+id).classList.toggle('active', k === name));
  $$('.nav button').forEach(b => {
    const on = b.dataset.go === name || (name === 'rules-'+b.dataset.go) ||
               (name === 'game' && G && G.kind === b.dataset.go);
    on ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current');
  });
  updateResume();
  window.scrollTo({top:0, behavior: settings.motion === 'on' ? 'smooth' : 'auto'});
}

function updateResume(){
  const live = G && !G.over;
  const label = live ? `${G.kind === 'chess' ? 'Chess' : 'Checkers'} · ${G.diff[0].toUpperCase()+G.diff.slice(1)} · ${G.log.length} moves played` : '';
  for(const key of ['home','chess','checkers']){
    const bar = document.getElementById('resume-' + key);
    if(!bar) continue;
    const showIt = live && (key === 'home' || key === G.kind);
    bar.classList.toggle('on', !!showIt);
    if(showIt) document.getElementById('resume-' + key + '-txt').textContent = label;
  }
}

document.addEventListener('click', e => {
  if(e.target.closest('[data-resume]') && G && !G.over){ show('game'); draw(); }
  if(e.target.closest('[data-abandon]')){ G = null; saveGame(); updateResume(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if(!b) return;
  show(b.dataset.go);
});

/* ---------- hero: one board, two games ---------- */
const GLYPH = {w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'}, b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
const LETTER = {k:'K',q:'Q',r:'R',b:'B',n:'N',p:'P'};

function buildMorph(){
  const g = $('#morphGrid'); if(!g) return;
  const back = ['r','n','b','q','k','b','n','r'];
  let html = '';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const light = (r+c) % 2 === 0;
    let chess = '', chk = '';
    if(r === 0) chess = GLYPH.b[back[c]];
    if(r === 1) chess = GLYPH.b.p;
    if(r === 6) chess = GLYPH.w.p;
    if(r === 7) chess = GLYPH.w[back[c]];
    if(!light && r < 3) chk = 'b';
    if(!light && r > 4) chk = 'r';
    html += `<div class="sq ${light?'l':'d'}">
      ${chess ? `<span class="pc ph" style="color:${r<2?'var(--black-piece)':'var(--white-piece)'}">${chess}</span>` : ''}
      ${chk ? `<span class="disc dh hidden" style="background:${chk==='r'?'var(--red-piece)':'var(--blue-piece)'}"></span>` : ''}
    </div>`;
  }
  g.innerHTML = html;
  let onChess = true;
  setInterval(() => {
    if(settings.motion === 'off') return;
    onChess = !onChess;
    $$('#morphGrid .ph').forEach(e => e.classList.toggle('hidden', !onChess));
    $$('#morphGrid .dh').forEach(e => e.classList.toggle('hidden', onChess));
    $('#morphCap').textContent = onChess ? 'Chess · opening position' : 'Checkers · opening position';
  }, 4200);
}

/* ---------- game state ---------- */
let G = null;
let chessSide = 'w';
let checkersSide = 'r';

function wireSidePick(id, set){
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    set(b.dataset.side);
    Array.from($(id).children).forEach(x => x.setAttribute('aria-pressed', x === b));
  });
}
wireSidePick('#sidePick',  v => chessSide = v);
wireSidePick('#sidePickC', v => checkersSide = v);

$$('[data-start]').forEach(b => b.addEventListener('click', () => start(b.dataset.start, b.dataset.diff)));

function start(kind, diff){
  G = {
    kind, diff,
    human: kind === 'chess' ? chessSide : checkersSide,
    state: kind === 'chess' ? CHESS.newGame() : DRAUGHTS.newGame(),
    history: [], log: [], yourTake: [], aiTake: [], seen: {},
    sel: null, opts: [], last: null, focus: null, token: 0,
    busy: false, over: false, hint: '', say: ''
  };
  const label = diff[0].toUpperCase() + diff.slice(1);
  $('#gameTitle').textContent = kind === 'chess' ? 'Chess' : 'Checkers';
  $('#gameEyebrow').textContent = `${kind === 'chess' ? 'Chess' : 'Checkers'} · ${label}`;
  $('#gameLogo').innerHTML = `<use href="#ico-${kind}"/>`;
  $('#takenCard').style.display = '';
  show('game');
  draw();
  if(G.human === 'b') aiTurn();   // white in chess, red in checkers moves first
}

const isHumanTurn = () => G && G.state.turn === G.human && !G.over && !G.busy;

/* ---------- board drawing ---------- */
function draw(){
  if(!G) return;
  if(G.focus === null || G.focus === undefined) G.focus = defaultFocus();
  G.kind === 'chess' ? drawChess() : drawCheckers();
  drawPanel();
}

function orient(i){          // board index <-> display index; your side sits at the bottom
  return G.human === 'b' ? 63 - i : i;
}
function unorient(i){ return orient(i); } // involution

const PIECE_NAME = {p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king'};

function squareShell(i, d, cls, inner, label){
  const r = i >> 3, c = i & 7;
  const light = (r + c) % 2 === 0;
  const file = String.fromCharCode(97 + c), rank = 8 - r;
  const showFile = (G.human === 'b') ? r === 0 : r === 7;
  const showRank = (G.human === 'b') ? c === 7 : c === 0;
  const tab = d === G.focus ? 0 : -1;
  return `<button type="button" role="gridcell" class="sq ${light?'l':'d'} ${cls}" data-i="${i}" data-d="${d}"
    tabindex="${tab}" aria-label="${label}">
    ${inner}
    ${showFile ? `<span class="coord f">${file}</span>` : ''}
    ${showRank ? `<span class="coord r">${rank}</span>` : ''}
  </button>`;
}

/* first square the keyboard should land on: one of your own pieces */
function defaultFocus(){
  for(let d=0; d<64; d++){
    const p = G.state.board[orient(d)];
    if(p && p.c === G.human) return d;
  }
  return 0;
}

function drawChess(){
  const s = G.state, dests = new Map();
  G.opts.forEach(m => dests.set(m.to, m));
  const checkSq = CHESS.inCheck(s, s.turn) ? s.board.findIndex(p => p && p.t === 'k' && p.c === s.turn) : -1;

  let html = '';
  for(let d=0; d<64; d++){
    const i = orient(d);
    const p = s.board[i];
    let inner = '';
    if(p){
      const g = settings.pieces === 'letter' ? LETTER[p.t] : GLYPH[p.c][p.t];
      inner += `<span class="piece ${p.c}">${g}</span>`;
    }
    if(dests.has(i)) inner += p ? '<span class="ring"></span>' : '<span class="dot"></span>';
    let cls = '';
    if(G.sel === i) cls += ' sel';
    if(G.last && (G.last[0] === i || G.last[1] === i)) cls += ' last';
    if(G.last && G.last[1] === i) cls += ' lastto';
    if(i === checkSq) cls += ' check';

    const name = CHESS.sqName(i);
    let label = name + ', ' + (p ? (p.c === 'w' ? 'white ' : 'black ') + PIECE_NAME[p.t] : 'empty');
    if(dests.has(i)) label += p ? ', can capture here' : ', can move here';
    if(G.sel === i) label += ', selected';
    if(i === checkSq) label += ', in check';
    html += squareShell(i, d, cls, inner, label);
  }
  $('#board').innerHTML = html;
  restoreFocus();
}

function drawCheckers(){
  const s = G.state, dests = new Map();
  G.opts.forEach(m => {
    const to = m.path[m.path.length-1];
    const prev = dests.get(to);
    if(!prev || m.caps.length > prev.caps.length) dests.set(to, m);
  });

  let html = '';
  for(let d=0; d<64; d++){
    const i = orient(d);
    const r = i >> 3, c = i & 7, light = (r + c) % 2 === 0;
    const p = s.board[i];
    let inner = '';
    if(p) inner += `<span class="disc ${p.c}">${p.k ? '<span class="crown">♛</span>' : ''}</span>`;
    if(dests.has(i)) inner += p ? '<span class="ring"></span>' : `<span class="${dests.get(i).caps.length?'ring':'dot'}"></span>`;
    let cls = '';
    if(G.sel === i) cls += ' sel';
    if(G.last && G.last.includes(i)) cls += ' last';
    if(G.last && G.last[G.last.length-1] === i) cls += ' lastto';

    const dark = DRAUGHTS.dark(i);
    const who = p ? (p.c === G.human ? 'your ' : 'the computer\'s ') : '';
    let label = dark ? 'square ' + DRAUGHTS.NUM[i] : 'unused light square';
    if(dark) label += ', ' + (p ? who + (p.c === 'r' ? 'red ' : 'black ') + (p.k ? 'king' : 'disc') : 'empty');
    if(dests.has(i)) label += dests.get(i).caps.length ? ', jump lands here' : ', can move here';
    if(G.sel === i) label += ', selected';
    const tab = d === G.focus ? 0 : -1;
    html += `<button type="button" role="gridcell" class="sq ${light?'l':'d'}${cls}" data-i="${i}" data-d="${d}"
      tabindex="${tab}" aria-label="${label}"${dark ? '' : ' aria-hidden="true"'}>${inner}
      ${dark && settings.coords === 'on' ? `<span class="coord f">${DRAUGHTS.NUM[i]}</span>` : ''}</button>`;
  }
  $('#board').innerHTML = html;
  restoreFocus();
}

/* keep the keyboard where it was after the board is redrawn */
function restoreFocus(){
  if(!G || !G.kbd || G.over) return;
  const el = $('#board').querySelector(`[data-d="${G.focus}"]`);
  if(el) el.focus({preventScroll:true});
}

/* ---------- panel ---------- */
function drawPanel(){
  const s = G.state;
  const st = $('#status'), sub = $('#statusSub');
  st.classList.toggle('think', G.busy);

  if(G.over){
    st.firstChild.textContent = G.overTitle;
    sub.textContent = G.overText;
  } else if(G.busy){
    st.firstChild.textContent = 'Thinking';
    sub.textContent = 'The computer is choosing a move.';
  } else {
    st.firstChild.textContent = 'Your move';
    if(G.kind === 'chess'){
      const check = CHESS.inCheck(s, s.turn);
      sub.textContent = (G.say ? G.say + ' · ' : '') +
        (G.human === 'w' ? 'White' : 'Black') + ' to play' + (check ? ' · you are in check' : '');
    } else {
      const forced = DRAUGHTS.moves(s).some(m => m.caps.length);
      sub.textContent = (G.say ? G.say + ' · ' : '') +
        (G.hint || (forced ? 'A capture is available, so you must take it.' : 'Move a disc diagonally forward.'));
    }
  }

  const label = G.diff[0].toUpperCase() + G.diff.slice(1);
  let chips = [`<span class="chip">Level <b>${label}</b></span>`];
  if(G.kind === 'chess'){
    chips.push(`<span class="chip">You play <b>${G.human === 'w' ? 'White' : 'Black'}</b></span>`);
    chips.push(`<span class="chip">Move <b>${s.full}</b></span>`);
  } else {
    const cnt = c => s.board.filter(p => p && p.c === c).length;
    chips.push(`<span class="chip">You play <b>${G.human === 'r' ? 'Red' : 'Black'}</b></span>`);
    chips.push(`<span class="chip">You <b>${cnt(G.human)}</b></span>`);
    chips.push(`<span class="chip">Computer <b>${cnt(DRAUGHTS.other(G.human))}</b></span>`);
  }
  $('#meta').innerHTML = chips.join('');

  drawCaptured();

  const rows = [];
  for(let i=0; i<G.log.length; i+=2){
    rows.push(`<tr><td class="no">${(i/2)+1}.</td><td>${G.log[i]||''}</td><td>${G.log[i+1]||''}</td></tr>`);
  }
  const tb = $('#movelist').tBodies[0];
  tb.innerHTML = rows.length ? rows.join('') : '<tr><td class="muted">No moves yet</td></tr>';
  const box = $('.moves'); box.scrollTop = box.scrollHeight;
}

/* pieces you have taken, and pieces the computer has taken, kept apart */
const CH_VAL = {p:1, n:3, b:3, r:5, q:9, k:0};

function drawCaptured(){
  const none = '<span class="none">none yet</span>';
  const render = list => {
    if(!list.length) return none;
    if(G.kind === 'chess')
      return list.slice().sort((a,b) => CH_VAL[b.t] - CH_VAL[a.t])
                 .map(p => `<span class="${p.c}">${GLYPH[p.c][p.t]}</span>`).join('');
    const col = c => c === 'r' ? 'style="color:var(--red-piece)"'
                               : 'style="color:var(--blue-piece);-webkit-text-stroke:1px var(--muted)"';
    return `<span ${col(list[0])}>${'●'.repeat(list.length)}</span>`;
  };
  $('#takenMine').innerHTML   = render(G.yourTake);
  $('#takenTheirs').innerHTML = render(G.aiTake);

  let note = '';
  if(G.kind === 'chess'){
    const sum = l => l.reduce((t,p) => t + CH_VAL[p.t], 0);
    const d = sum(G.yourTake) - sum(G.aiTake);
    note = d === 0 ? 'Material level' : (d > 0 ? `You are up ${d} point${d>1?'s':''}` : `Computer is up ${-d} point${-d>1?'s':''}`);
  } else {
    const d = G.aiTake.length ? G.yourTake.length - G.aiTake.length : G.yourTake.length;
    note = d === 0 ? 'Discs level' : (d > 0 ? `You are up ${d} disc${d>1?'s':''}` : `Computer is up ${-d} disc${-d>1?'s':''}`);
  }
  $('#material').textContent = note;
}

/* ---------- interaction ---------- */
$('#board').addEventListener('click', e => {
  const cell = e.target.closest('.sq'); if(!cell || !G) return;
  const i = +cell.dataset.i;
  if(!isHumanTurn()) return;
  G.kind === 'chess' ? clickChess(i) : clickCheckers(i);
});

function clickChess(i){
  const s = G.state;
  const chosen = G.opts.filter(m => m.to === i);
  if(G.sel !== null && chosen.length){
    if(chosen[0].promo) return askPromotion(chosen);
    playHuman(chosen[0]);
    return;
  }
  const p = s.board[i];
  if(p && p.c === G.human){
    G.sel = i;
    G.opts = CHESS.legal(s).filter(m => m.from === i);
  } else { G.sel = null; G.opts = []; }
  draw();
}

function clickCheckers(i){
  const s = G.state;
  const all = DRAUGHTS.moves(s);
  const chosen = G.opts.filter(m => m.path[m.path.length-1] === i)
                       .sort((a,b) => b.caps.length - a.caps.length);
  if(G.sel !== null && chosen.length){ playHuman(chosen[0]); return; }
  const p = s.board[i];
  if(p && p.c === G.human){
    G.sel = i;
    G.opts = all.filter(m => m.path[0] === i);
    G.hint = G.opts.length ? '' : 'That disc has no legal move right now.';
  } else { G.sel = null; G.opts = []; G.hint = ''; }
  draw();
}

function askPromotion(list){
  const box = $('#mBody');
  $('#mTitle').textContent = 'Promote your pawn';
  $('#mText').textContent = 'Choose the piece it becomes.';
  box.innerHTML = `<div class="promo-row">${
    ['q','r','b','n'].map(t => `<button data-promo="${t}" title="${({q:'Queen',r:'Rook',b:'Bishop',n:'Knight'})[t]}">${GLYPH[G.human][t]}</button>`).join('')
  }</div>`;
  $('#mActions').innerHTML = '';
  openModal();
  box.onclick = e => {
    const b = e.target.closest('[data-promo]'); if(!b) return;
    closeModal(); box.innerHTML = '';
    playHuman(list.find(m => m.promo === b.dataset.promo));
  };
}

function playHuman(m){
  applyMove(m);
  if(!G.over) aiTurn();
}

function applyMove(m){
  const s = G.state;
  const mover = s.turn, byHuman = mover === G.human;
  const bag = byHuman ? G.yourTake : G.aiTake;
  G.history.push({state: CLONE(s), log: G.log.slice(), yourTake: G.yourTake.slice(),
                  aiTake: G.aiTake.slice(), last: G.last, seen: Object.assign({}, G.seen)});
  let text;
  if(G.kind === 'chess'){
    text = CHESS.san(s, m);
    G.log.push(text);
    if(m.cap) bag.push(m.cap);
    G.last = [m.from, m.to];
    G.state = CHESS.make(s, m);
    const key = CHESS.posKey(G.state);
    G.seen[key] = (G.seen[key] || 0) + 1;
  } else {
    text = DRAUGHTS.notate(m);
    G.log.push(text);
    m.caps.forEach(c => bag.push(s.board[c].c));
    G.last = [m.path[0], m.path[m.path.length-1]];
    G.state = DRAUGHTS.make(s, m);
  }
  G.say = byHuman ? '' : 'Computer played ' + text;
  G.sel = null; G.opts = []; G.hint = '';
  checkOver();
  saveGame();
  draw();
}
const CLONE = s => (G.kind === 'chess' ? CHESS.clone(s) : DRAUGHTS.clone(s));

/* The search runs in a Worker so the page never freezes. If Workers are
   unavailable (opening the file straight off disk, for instance) it falls
   back to running on the main thread. */
let worker = null;
(function makeWorker(){
  try{
    const engineURL = new URL('engine.js', document.baseURI).href;
    const src = `importScripts(${JSON.stringify(engineURL)});
      onmessage = function(e){
        var d = e.data, eng = d.kind === 'chess' ? CHESS : DRAUGHTS;
        postMessage(eng.best(d.state, d.diff));
      };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], {type:'text/javascript'})));
  }catch(err){ worker = null; }
})();

function aiTurn(){
  if(G.over) return;
  G.busy = true; G.sel = null; G.opts = [];
  const tok = ++G.token;
  draw();

  const finish = m => {
    if(!G || G.token !== tok) return;      // undo / new game happened meanwhile
    G.busy = false;
    if(m) applyMove(m); else { checkOver(); draw(); }
  };
  const onMainThread = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    finish((G.kind === 'chess' ? CHESS : DRAUGHTS).best(G.state, G.diff));
  }, 30)));

  if(worker){
    let settled = false;
    worker.onmessage = e => { if(!settled){ settled = true; finish(e.data); } };
    worker.onerror   = () => { if(!settled){ settled = true; worker = null; onMainThread(); } };
    try{ worker.postMessage({kind:G.kind, state:G.state, diff:G.diff}); }
    catch(err){ settled = true; worker = null; onMainThread(); }
  } else onMainThread();
}

function checkOver(){
  const s = G.state;
  const r = G.kind === 'chess' ? CHESS.result(s) : DRAUGHTS.result(s);
  if(G.kind === 'chess' && !r.over && G.seen[CHESS.posKey(s)] >= 3){
    G.over = true;
    G.overTitle = 'Draw — threefold repetition';
    G.overText  = 'The same position has now appeared three times.';
    saveGame();
    setTimeout(showResult, 420);
    return;
  }
  if(!r.over) return;
  G.over = true;
  if(G.kind === 'chess'){
    if(r.type === 'mate'){
      const won = r.winner === G.human;
      G.overTitle = won ? 'Checkmate — you win' : 'Checkmate — you lose';
      G.overText  = won ? 'The computer has no legal move out of check.' : 'Your king is attacked with no way out.';
    } else if(r.type === 'stalemate'){
      G.overTitle = 'Stalemate — a draw';
      G.overText  = 'The side to move has no legal move but is not in check.';
    } else if(r.type === 'fifty'){
      G.overTitle = 'Draw — fifty-move rule';
      G.overText  = 'Fifty moves each with no capture and no pawn move.';
    } else {
      G.overTitle = 'Draw — not enough material';
      G.overText  = 'Neither side has the pieces to force checkmate.';
    }
  } else {
    const won = r.winner === G.human;
    G.overTitle = won ? 'You win' : 'You lose';
    G.overText  = r.blocked
      ? (won ? 'The computer has no legal move left.' : 'You have no legal move left.')
      : (won ? 'You took every one of the computer\'s discs.' : 'The computer took all of your discs.');
  }
  setTimeout(showResult, 420);
}

function showResult(){
  $('#mTitle').textContent = G.overTitle;
  $('#mText').textContent = G.overText;
  $('#mBody').innerHTML = '';
  $('#mActions').innerHTML = `
    <button class="btn primary sm" data-act="again">Play again</button>
    <button class="btn sm" data-act="level">Change level</button>
    <button class="btn ghost sm" data-act="home">Home</button>`;
  openModal();
}
$('#mActions').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b) return;
  closeModal();
  if(b.dataset.act === 'again') start(G.kind, G.diff);
  if(b.dataset.act === 'level') show(G.kind);
  if(b.dataset.act === 'home') show('home');
});

function openModal(){ $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', e => { if(e.target.id === 'modal' && G && G.over) closeModal(); });

/* ---------- controls ---------- */
$('#btnUndo').addEventListener('click', () => {
  if(!G || G.busy || !G.history.length) return;
  // step back until it is the human's turn again
  let h;
  do{ h = G.history.pop(); } while(G.history.length && h.state.turn !== G.human);
  G.state = h.state; G.log = h.log; G.last = h.last;
  G.yourTake = h.yourTake; G.aiTake = h.aiTake; G.seen = h.seen;
  G.over = false; G.sel = null; G.opts = []; G.hint = ''; G.say = ''; G.token++;
  closeModal(); saveGame(); draw();
});
$('#btnNew').addEventListener('click',  () => G && start(G.kind, G.diff));
$('#btnRules').addEventListener('click', () => G && show('rules-' + G.kind));
$('#btnLeave').addEventListener('click', () => show(G ? G.kind : 'home'));

$('#btnResign').addEventListener('click', () => {
  if(!G || G.over) return;
  G.over = true; G.token++;
  G.overTitle = 'You resigned';
  G.overText  = G.kind === 'chess' ? 'The game is awarded to the computer.'
                                   : 'The computer takes the game.';
  saveGame(); draw(); showResult();
});

/* arrow keys walk the board, Enter selects — squares are buttons, so Enter
   and Space already fire the click handler */
$('#board').addEventListener('keydown', e => {
  if(!G) return;
  const step = {ArrowUp:-8, ArrowDown:8, ArrowLeft:-1, ArrowRight:1}[e.key];
  if(step === undefined) return;
  e.preventDefault();
  const d = G.focus === null ? defaultFocus() : G.focus;
  const col = d & 7;
  if((step === -1 && col === 0) || (step === 1 && col === 7)) return;
  const next = d + step;
  if(next < 0 || next > 63) return;
  G.focus = next; G.kbd = true;
  $$('#board .sq').forEach(b => b.setAttribute('tabindex', +b.dataset.d === next ? 0 : -1));
  const el = $('#board').querySelector(`[data-d="${next}"]`);
  if(el) el.focus({preventScroll:true});
});
$('#board').addEventListener('focusin', e => {
  const sq = e.target.closest('.sq');
  if(sq) G.focus = +sq.dataset.d;
});

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    if($('#modal').classList.contains('on') && (!G || G.over)) closeModal();
    else if(G && G.sel !== null){ G.sel = null; G.opts = []; draw(); }
  }
});

/* ---------- pick up an unfinished game from a previous visit ---------- */
function restoreGame(){
  const saved = readStore().game;
  if(!saved || !saved.state) return;
  try{
    G = Object.assign({
      history: [], sel: null, opts: [], focus: null, token: 0,
      busy: false, over: false, hint: '', say: '', seen: {}
    }, saved);
    const label = G.diff[0].toUpperCase() + G.diff.slice(1);
    $('#gameTitle').textContent = G.kind === 'chess' ? 'Chess' : 'Checkers';
    $('#gameEyebrow').textContent = `${G.kind === 'chess' ? 'Chess' : 'Checkers'} · ${label}`;
    $('#gameLogo').innerHTML = `<use href="#ico-${G.kind}"/>`;
    if(G.state.turn !== G.human) aiTurn();
  }catch(err){ G = null; }
}

/* ---------- go ---------- */
loadSettings();
buildSettings();
applySettings();
buildMorph();
restoreGame();
updateResume();
