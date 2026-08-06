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
const settings = {theme:'baize', panel:'side', size:'m', coords:'on', pieces:'glyph', motion:'on', home:'row'};

function applySettings(){
  document.documentElement.dataset.theme = settings.theme;
  for(const k of ['panel','size','coords','pieces','motion','home']) body.dataset[k] = settings[k];
  $$('#themeSwatches .sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === settings.theme));
  $$('.seg[data-setting]').forEach(seg => {
    const key = seg.dataset.setting;
    Array.from(seg.children).forEach(b => b.setAttribute('aria-pressed', b.dataset.val === settings[key]));
  });
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
  window.scrollTo({top:0, behavior: settings.motion === 'on' ? 'smooth' : 'auto'});
}
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
    history: [], log: [], taken: [], sel: null, opts: [], last: null,
    busy: false, over: false, hint: ''
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
  G.kind === 'chess' ? drawChess() : drawCheckers();
  drawPanel();
}

function orient(i){          // board index <-> display index; your side sits at the bottom
  return G.human === 'b' ? 63 - i : i;
}
function unorient(i){ return orient(i); } // involution

function squareShell(i, cls, inner){
  const r = i >> 3, c = i & 7;
  const light = (r + c) % 2 === 0;
  const file = String.fromCharCode(97 + c), rank = 8 - r;
  const showFile = (G.human === 'b') ? r === 0 : r === 7;
  const showRank = (G.human === 'b') ? c === 7 : c === 0;
  return `<div class="sq ${light?'l':'d'} ${cls}" data-i="${i}">
    ${inner}
    ${showFile ? `<span class="coord f">${file}</span>` : ''}
    ${showRank ? `<span class="coord r">${rank}</span>` : ''}
  </div>`;
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
    if(i === checkSq) cls += ' check';
    html += squareShell(i, cls, inner);
  }
  $('#board').innerHTML = html;
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
    html += `<div class="sq ${light?'l':'d'}${cls}" data-i="${i}">${inner}
      ${DRAUGHTS.dark(i) && settings.coords === 'on' ? `<span class="coord f">${DRAUGHTS.NUM[i]}</span>` : ''}</div>`;
  }
  $('#board').innerHTML = html;
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
      sub.textContent = (G.human === 'w' ? 'White' : 'Black') + ' to play' + (check ? ' · you are in check' : '');
    } else {
      const forced = DRAUGHTS.moves(s).some(m => m.caps.length);
      sub.textContent = G.hint || (forced ? 'A capture is available, so you must take it.' : 'Move a disc diagonally forward.');
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

  if(G.kind === 'chess'){
    $('#taken').innerHTML = G.taken.length
      ? G.taken.map(p => `<span class="${p.c}">${GLYPH[p.c][p.t]}</span>`).join('')
      : '<span class="muted" style="font-size:13px">Nothing taken yet</span>';
  } else {
    const foe = DRAUGHTS.other(G.human);
    const col = c => c === 'r' ? 'style="color:var(--red-piece)"'
                               : 'style="color:var(--blue-piece);-webkit-text-stroke:1px var(--muted)"';
    const mine = G.taken.filter(c => c === foe).length, theirs = G.taken.filter(c => c === G.human).length;
    $('#taken').innerHTML = G.taken.length
      ? `<span ${col(foe)}>${'●'.repeat(mine)}</span> <span ${col(G.human)}>${'●'.repeat(theirs)}</span>`
      : '<span class="muted" style="font-size:13px">Nothing taken yet</span>';
  }

  const rows = [];
  for(let i=0; i<G.log.length; i+=2){
    rows.push(`<tr><td class="no">${(i/2)+1}.</td><td>${G.log[i]||''}</td><td>${G.log[i+1]||''}</td></tr>`);
  }
  const tb = $('#movelist').tBodies[0];
  tb.innerHTML = rows.length ? rows.join('') : '<tr><td class="muted">No moves yet</td></tr>';
  const box = $('.moves'); box.scrollTop = box.scrollHeight;
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
  G.history.push({state: CLONE(s), log: G.log.slice(), taken: G.taken.slice(), last: G.last});
  if(G.kind === 'chess'){
    G.log.push(CHESS.san(s, m));
    if(m.cap) G.taken.push(m.cap);
    G.last = [m.from, m.to];
    G.state = CHESS.make(s, m);
  } else {
    G.log.push(DRAUGHTS.notate(m));
    m.caps.forEach(c => G.taken.push(s.board[c].c));
    G.last = [m.path[0], m.path[m.path.length-1]];
    G.state = DRAUGHTS.make(s, m);
  }
  G.sel = null; G.opts = []; G.hint = '';
  checkOver();
  draw();
}
const CLONE = s => (G.kind === 'chess' ? CHESS.clone(s) : DRAUGHTS.clone(s));

function aiTurn(){
  if(G.over) return;
  G.busy = true; G.sel = null; G.opts = [];
  draw();
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    const m = (G.kind === 'chess' ? CHESS : DRAUGHTS).best(G.state, G.diff);
    G.busy = false;
    if(m) applyMove(m); else { checkOver(); draw(); }
  }, 30)));
}

function checkOver(){
  const s = G.state;
  const r = G.kind === 'chess' ? CHESS.result(s) : DRAUGHTS.result(s);
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
  G.state = h.state; G.log = h.log; G.taken = h.taken; G.last = h.last;
  G.over = false; G.sel = null; G.opts = []; G.hint = '';
  closeModal(); draw();
});
$('#btnNew').addEventListener('click',  () => G && start(G.kind, G.diff));
$('#btnRules').addEventListener('click', () => G && show('rules-' + G.kind));
$('#btnLeave').addEventListener('click', () => show(G ? G.kind : 'home'));

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    if($('#modal').classList.contains('on') && (!G || G.over)) closeModal();
    else if(G && G.sel !== null){ G.sel = null; G.opts = []; draw(); }
  }
});

/* ---------- go ---------- */
buildSettings();
applySettings();
buildMorph();
