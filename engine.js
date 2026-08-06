/* Sixty-Four — chess and checkers rules, evaluation and search */
/* ============================================================
   CHESS ENGINE
   board: flat array of 64, index = row*8+col, row 0 = rank 8
   piece: {t:'p|n|b|r|q|k', c:'w|b'}  (never mutated in place)
   ============================================================ */
const CHESS = (function(){
  const N = null;
  const OFF = {
    n:[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
    k:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],
    b:[[-1,-1],[-1,1],[1,-1],[1,1]],
    r:[[-1,0],[1,0],[0,-1],[0,1]]
  };
  const inB = (r,c)=> r>=0 && r<8 && c>=0 && c<8;

  function initial(){
    const b = new Array(64).fill(N);
    const back = ['r','n','b','q','k','b','n','r'];
    for(let c=0;c<8;c++){
      b[c]        = {t:back[c], c:'b'};
      b[8+c]      = {t:'p',      c:'b'};
      b[48+c]     = {t:'p',      c:'w'};
      b[56+c]     = {t:back[c], c:'w'};
    }
    return b;
  }
  function newGame(){
    return {board:initial(), turn:'w', cast:{wK:true,wQ:true,bK:true,bQ:true}, ep:-1, half:0, full:1};
  }
  function clone(s){
    return {board:s.board.slice(), turn:s.turn, cast:{wK:s.cast.wK,wQ:s.cast.wQ,bK:s.cast.bK,bQ:s.cast.bQ},
            ep:s.ep, half:s.half, full:s.full};
  }
  function fromFEN(fen){
    const p = fen.trim().split(/\s+/);
    const b = new Array(64).fill(N);
    let i = 0;
    for(const ch of p[0]){
      if(ch === '/') continue;
      if(/\d/.test(ch)){ i += +ch; continue; }
      b[i++] = {t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? 'w' : 'b'};
    }
    const cast = {wK:p[2].includes('K'), wQ:p[2].includes('Q'), bK:p[2].includes('k'), bQ:p[2].includes('q')};
    let ep = -1;
    if(p[3] && p[3] !== '-') ep = (8 - (+p[3][1])) * 8 + (p[3].charCodeAt(0) - 97);
    return {board:b, turn:p[1], cast, ep, half:+(p[4]||0), full:+(p[5]||1)};
  }

  const other = c => c === 'w' ? 'b' : 'w';

  /* --- is square sq attacked by colour `by`? --- */
  function attacked(b, sq, by){
    const r = sq >> 3, c = sq & 7;
    // pawns
    const pr = by === 'w' ? r + 1 : r - 1;
    for(const dc of [-1, 1]){
      const cc = c + dc;
      if(inB(pr, cc)){ const p = b[pr*8+cc]; if(p && p.c === by && p.t === 'p') return true; }
    }
    // knights + king
    for(const [dr,dc] of OFF.n){
      const rr = r+dr, cc = c+dc;
      if(inB(rr,cc)){ const p = b[rr*8+cc]; if(p && p.c === by && p.t === 'n') return true; }
    }
    for(const [dr,dc] of OFF.k){
      const rr = r+dr, cc = c+dc;
      if(inB(rr,cc)){ const p = b[rr*8+cc]; if(p && p.c === by && p.t === 'k') return true; }
    }
    // sliders
    for(const [dr,dc] of OFF.b){
      let rr = r+dr, cc = c+dc;
      while(inB(rr,cc)){
        const p = b[rr*8+cc];
        if(p){ if(p.c === by && (p.t === 'b' || p.t === 'q')) return true; break; }
        rr += dr; cc += dc;
      }
    }
    for(const [dr,dc] of OFF.r){
      let rr = r+dr, cc = c+dc;
      while(inB(rr,cc)){
        const p = b[rr*8+cc];
        if(p){ if(p.c === by && (p.t === 'r' || p.t === 'q')) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  }

  function kingSq(b, col){
    for(let i=0;i<64;i++){ const p = b[i]; if(p && p.t === 'k' && p.c === col) return i; }
    return -1;
  }
  function inCheck(s, col){
    const k = kingSq(s.board, col);
    return k < 0 ? false : attacked(s.board, k, other(col));
  }

  /* --- pseudo-legal move generation --- */
  function pseudo(s, capturesOnly){
    const b = s.board, me = s.turn, them = other(me), out = [];
    const push = m => out.push(m);
    for(let from=0; from<64; from++){
      const p = b[from];
      if(!p || p.c !== me) continue;
      const r = from >> 3, c = from & 7;

      if(p.t === 'p'){
        const dir = me === 'w' ? -1 : 1;
        const startRow = me === 'w' ? 6 : 1;
        const lastRow  = me === 'w' ? 0 : 7;
        const r1 = r + dir;
        if(!capturesOnly && inB(r1,c) && !b[r1*8+c]){
          if(r1 === lastRow) for(const q of ['q','r','b','n']) push({from, to:r1*8+c, promo:q});
          else{
            push({from, to:r1*8+c});
            const r2 = r + 2*dir;
            if(r === startRow && !b[r2*8+c]) push({from, to:r2*8+c, dbl:true});
          }
        }
        for(const dc of [-1,1]){
          const cc = c + dc;
          if(!inB(r1,cc)) continue;
          const t = r1*8+cc, tp = b[t];
          if(tp && tp.c === them){
            if(r1 === lastRow) for(const q of ['q','r','b','n']) push({from, to:t, cap:tp, promo:q});
            else push({from, to:t, cap:tp});
          } else if(t === s.ep && !tp){
            push({from, to:t, cap:{t:'p', c:them}, ep:true});
          }
        }
        continue;
      }

      if(p.t === 'n' || p.t === 'k'){
        for(const [dr,dc] of OFF[p.t]){
          const rr = r+dr, cc = c+dc;
          if(!inB(rr,cc)) continue;
          const t = rr*8+cc, tp = b[t];
          if(tp && tp.c === me) continue;
          if(capturesOnly && !tp) continue;
          push({from, to:t, cap:tp || undefined});
        }
      } else {
        const dirs = p.t === 'q' ? OFF.b.concat(OFF.r) : OFF[p.t];
        for(const [dr,dc] of dirs){
          let rr = r+dr, cc = c+dc;
          while(inB(rr,cc)){
            const t = rr*8+cc, tp = b[t];
            if(tp && tp.c === me) break;
            if(!capturesOnly || tp) push({from, to:t, cap:tp || undefined});
            if(tp) break;
            rr += dr; cc += dc;
          }
        }
      }

      // castling
      if(p.t === 'k' && !capturesOnly){
        const home = me === 'w' ? 60 : 4;
        if(from === home && !attacked(b, home, them)){
          const kOK = me === 'w' ? s.cast.wK : s.cast.bK;
          const qOK = me === 'w' ? s.cast.wQ : s.cast.bQ;
          if(kOK && !b[home+1] && !b[home+2] &&
             b[home+3] && b[home+3].t === 'r' && b[home+3].c === me &&
             !attacked(b, home+1, them) && !attacked(b, home+2, them))
            push({from, to:home+2, castle:'K'});
          if(qOK && !b[home-1] && !b[home-2] && !b[home-3] &&
             b[home-4] && b[home-4].t === 'r' && b[home-4].c === me &&
             !attacked(b, home-1, them) && !attacked(b, home-2, them))
            push({from, to:home-2, castle:'Q'});
        }
      }
    }
    return out;
  }

  function make(s, m){
    const n = clone(s), b = n.board;
    const p = b[m.from], me = p.c;
    b[m.from] = N;

    if(m.ep) b[(m.from >> 3)*8 + (m.to & 7)] = N;
    b[m.to] = m.promo ? {t:m.promo, c:me} : p;

    if(m.castle === 'K'){ b[m.to+1] = N; b[m.to-1] = {t:'r', c:me}; }
    if(m.castle === 'Q'){ b[m.to-2] = N; b[m.to+1] = {t:'r', c:me}; }

    // castling rights
    if(p.t === 'k'){ if(me === 'w'){ n.cast.wK = n.cast.wQ = false; } else { n.cast.bK = n.cast.bQ = false; } }
    if(m.from === 63 || m.to === 63) n.cast.wK = false;
    if(m.from === 56 || m.to === 56) n.cast.wQ = false;
    if(m.from === 7  || m.to === 7 ) n.cast.bK = false;
    if(m.from === 0  || m.to === 0 ) n.cast.bQ = false;

    n.ep = m.dbl ? (m.from + m.to) / 2 : -1;
    n.half = (p.t === 'p' || m.cap) ? 0 : s.half + 1;
    if(me === 'b') n.full = s.full + 1;
    n.turn = other(me);
    return n;
  }

  function legal(s, capturesOnly){
    const out = [];
    for(const m of pseudo(s, capturesOnly)){
      const n = make(s, m);
      if(!attacked(n.board, kingSq(n.board, s.turn), n.turn)) out.push(m);
    }
    return out;
  }

  /* --- result --- */
  function insufficient(b){
    const ps = [];
    for(let i=0;i<64;i++) if(b[i]) ps.push(b[i]);
    if(ps.length > 4) return false;
    const minors = ps.filter(p => p.t !== 'k');
    if(minors.length === 0) return true;
    if(minors.length === 1) return minors[0].t === 'n' || minors[0].t === 'b';
    if(minors.length === 2) return minors.every(p => p.t === 'b');
    return false;
  }
  function result(s){
    const ms = legal(s);
    if(ms.length === 0) return inCheck(s, s.turn) ? {over:true, type:'mate', winner:other(s.turn)}
                                                  : {over:true, type:'stalemate'};
    if(s.half >= 100) return {over:true, type:'fifty'};
    if(insufficient(s.board)) return {over:true, type:'material'};
    return {over:false};
  }

  /* --- evaluation --- */
  const VAL = {p:100, n:320, b:330, r:500, q:900, k:20000};
  const PST = {
    p:[  0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
         5,  5, 10, 25, 25, 10,  5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5, -5,-10,  0,  0,-10, -5,  5,
         5, 10, 10,-20,-20, 10, 10,  5,
         0,  0,  0,  0,  0,  0,  0,  0],
    n:[-50,-40,-30,-30,-30,-30,-40,-50,
       -40,-20,  0,  0,  0,  0,-20,-40,
       -30,  0, 10, 15, 15, 10,  0,-30,
       -30,  5, 15, 20, 20, 15,  5,-30,
       -30,  0, 15, 20, 20, 15,  0,-30,
       -30,  5, 10, 15, 15, 10,  5,-30,
       -40,-20,  0,  5,  5,  0,-20,-40,
       -50,-40,-30,-30,-30,-30,-40,-50],
    b:[-20,-10,-10,-10,-10,-10,-10,-20,
       -10,  0,  0,  0,  0,  0,  0,-10,
       -10,  0,  5, 10, 10,  5,  0,-10,
       -10,  5,  5, 10, 10,  5,  5,-10,
       -10,  0, 10, 10, 10, 10,  0,-10,
       -10, 10, 10, 10, 10, 10, 10,-10,
       -10,  5,  0,  0,  0,  0,  5,-10,
       -20,-10,-10,-10,-10,-10,-10,-20],
    r:[  0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0],
    q:[-20,-10,-10, -5, -5,-10,-10,-20,
       -10,  0,  0,  0,  0,  0,  0,-10,
       -10,  0,  5,  5,  5,  5,  0,-10,
        -5,  0,  5,  5,  5,  5,  0, -5,
         0,  0,  5,  5,  5,  5,  0, -5,
       -10,  5,  5,  5,  5,  5,  0,-10,
       -10,  0,  5,  0,  0,  0,  0,-10,
       -20,-10,-10, -5, -5,-10,-10,-20],
    k:[-30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -20,-30,-30,-40,-40,-30,-30,-20,
       -10,-20,-20,-20,-20,-20,-20,-10,
        20, 20,  0,  0,  0,  0, 20, 20,
        20, 30, 10,  0,  0, 10, 30, 20],
    kEnd:[-50,-40,-30,-20,-20,-30,-40,-50,
       -30,-20,-10,  0,  0,-10,-20,-30,
       -30,-10, 20, 30, 30, 20,-10,-30,
       -30,-10, 30, 40, 40, 30,-10,-30,
       -30,-10, 30, 40, 40, 30,-10,-30,
       -30,-10, 20, 30, 30, 20,-10,-30,
       -30,-30,  0,  0,  0,  0,-30,-30,
       -50,-30,-30,-30,-30,-30,-30,-50]
  };
  const mirror = i => ((7 - (i >> 3)) << 3) | (i & 7);

  function evaluate(s){
    const b = s.board;
    let score = 0, mat = 0;
    for(let i=0;i<64;i++){ const p = b[i]; if(p && p.t !== 'p' && p.t !== 'k') mat += VAL[p.t]; }
    const endgame = mat < 1300;
    for(let i=0;i<64;i++){
      const p = b[i];
      if(!p) continue;
      const tbl = p.t === 'k' ? (endgame ? PST.kEnd : PST.k) : PST[p.t];
      const v = VAL[p.t] + tbl[p.c === 'w' ? i : mirror(i)];
      score += p.c === 'w' ? v : -v;
    }
    return s.turn === 'w' ? score : -score;
  }

  /* --- search --- */
  const MATE = 100000;
  let deadline = 0, nodes = 0;
  function timeUp(){ return (++nodes & 511) === 0 && Date.now() > deadline; }

  function order(s, ms){
    for(const m of ms){
      let sc = 0;
      if(m.cap) sc += 10 * VAL[m.cap.t] - VAL[s.board[m.from].t];
      if(m.promo) sc += VAL[m.promo];
      if(m.castle) sc += 40;
      m._s = sc;
    }
    ms.sort((a,b) => b._s - a._s);
    return ms;
  }

  function quiesce(s, alpha, beta, d){
    if(timeUp()) throw 'T';
    const stand = evaluate(s);
    if(stand >= beta) return beta;
    if(stand > alpha) alpha = stand;
    if(d <= 0) return alpha;
    for(const m of order(s, legal(s, true))){
      const sc = -quiesce(make(s, m), -beta, -alpha, d - 1);
      if(sc >= beta) return beta;
      if(sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function negamax(s, depth, alpha, beta, ply){
    if(timeUp()) throw 'T';
    const ms = legal(s);
    if(ms.length === 0) return inCheck(s, s.turn) ? -MATE + ply : 0;
    if(depth <= 0) return quiesce(s, alpha, beta, 4);
    for(const m of order(s, ms)){
      const sc = -negamax(make(s, m), depth - 1, -beta, -alpha, ply + 1);
      if(sc >= beta) return beta;
      if(sc > alpha) alpha = sc;
    }
    return alpha;
  }

  /* difficulty: {maxDepth, ms, noise} */
  const LEVELS = {
    easy:   {maxDepth:1, ms:140,  noise:0.20},
    normal: {maxDepth:3, ms:450,  noise:0.10},
    hard:   {maxDepth:5, ms:1700, noise:0}
  };

  function best(s, diff){
    const cfg = LEVELS[diff] || LEVELS.normal;
    const root = legal(s);
    if(!root.length) return null;
    if(Math.random() < cfg.noise) return root[(Math.random() * root.length) | 0];

    deadline = Date.now() + cfg.ms; nodes = 0;
    let chosen = root[0];
    for(let d = 1; d <= cfg.maxDepth; d++){
      try{
        let alpha = -Infinity, localBest = chosen;
        const ordered = order(s, root.slice());
        // keep the previous best first
        ordered.sort((a, b) => (b === chosen) - (a === chosen));
        for(const m of ordered){
          const sc = -negamax(make(s, m), d - 1, -Infinity, -alpha, 1);
          if(sc > alpha){ alpha = sc; localBest = m; }
        }
        chosen = localBest;
      }catch(e){ if(e !== 'T') throw e; break; }
      if(Date.now() > deadline) break;
    }
    return chosen;
  }

  /* --- notation --- */
  const sqName = i => String.fromCharCode(97 + (i & 7)) + (8 - (i >> 3));
  function san(s, m){
    if(m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
    const p = s.board[m.from];
    let out = '';
    if(p.t === 'p'){
      if(m.cap) out += sqName(m.from)[0] + 'x';
      out += sqName(m.to);
      if(m.promo) out += '=' + m.promo.toUpperCase();
    } else {
      out += p.t.toUpperCase();
      const rivals = legal(s).filter(x =>
        x.to === m.to && x.from !== m.from &&
        s.board[x.from] && s.board[x.from].t === p.t && s.board[x.from].c === p.c);
      if(rivals.length){
        const sameFile = rivals.some(x => (x.from & 7) === (m.from & 7));
        const sameRank = rivals.some(x => (x.from >> 3) === (m.from >> 3));
        out += !sameFile ? sqName(m.from)[0] : (!sameRank ? sqName(m.from)[1] : sqName(m.from));
      }
      if(m.cap) out += 'x';
      out += sqName(m.to);
    }
    const after = make(s, m);
    if(inCheck(after, after.turn)) out += legal(after).length ? '+' : '#';
    return out;
  }

  function posKey(s){
    let k = '';
    for(let i=0;i<64;i++){
      const p = s.board[i];
      k += p ? (p.c === 'w' ? p.t.toUpperCase() : p.t) : '.';
    }
    return k + s.turn + (s.cast.wK?'K':'') + (s.cast.wQ?'Q':'') +
           (s.cast.bK?'k':'') + (s.cast.bQ?'q':'') + ':' + s.ep;
  }

  return {newGame, clone, fromFEN, legal, make, inCheck, result, evaluate, best, san, sqName, other, posKey, LEVELS};
})();

/* ============================================================
   CHECKERS ENGINE  (American / English draughts)
   red = 'r' at the bottom moving up; black = 'b' at the top moving down
   piece: {c:'r'|'b', k:bool}
   move: {path:[from,...to], caps:[sq...], crown:bool}
   ============================================================ */
const DRAUGHTS = (function(){
  const N = null;
  const inB = (r,c) => r>=0 && r<8 && c>=0 && c<8;
  const dark = i => ((i >> 3) + (i & 7)) % 2 === 1;

  function newGame(){
    const b = new Array(64).fill(N);
    for(let i=0;i<64;i++){
      if(!dark(i)) continue;
      const r = i >> 3;
      if(r < 3) b[i] = {c:'b', k:false};
      if(r > 4) b[i] = {c:'r', k:false};
    }
    return {board:b, turn:'r'};
  }
  const other = c => c === 'r' ? 'b' : 'r';
  function clone(s){ return {board:s.board.slice(), turn:s.turn}; }

  const DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  function dirsFor(p){
    if(p.k) return DIRS;
    return p.c === 'r' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  }
  const crownRow = c => c === 'r' ? 0 : 7;

  function jumpsFrom(board, sq, piece, caps, path, out){
    let extended = false;
    for(const [dr,dc] of dirsFor(piece)){
      const r = sq >> 3, c = sq & 7;
      const mr = r + dr, mc = c + dc, lr = r + 2*dr, lc = c + 2*dc;
      if(!inB(lr,lc)) continue;
      const mid = mr*8 + mc, land = lr*8 + lc;
      const mp = board[mid];
      if(!mp || mp.c === piece.c || caps.includes(mid)) continue;
      if(board[land] && land !== path[0]) continue;
      extended = true;
      const crowned = !piece.k && lr === crownRow(piece.c);
      const nPath = path.concat(land), nCaps = caps.concat(mid);
      if(crowned) out.push({path:nPath, caps:nCaps, crown:true});
      else{
        const before = out.length;
        jumpsFrom(board, land, piece, nCaps, nPath, out);
        if(out.length === before) out.push({path:nPath, caps:nCaps, crown:false});
      }
    }
    return extended;
  }

  function moves(s){
    const b = s.board, me = s.turn, jumps = [], quiet = [];
    for(let i=0;i<64;i++){
      const p = b[i];
      if(!p || p.c !== me) continue;
      jumpsFrom(b, i, p, [], [i], jumps);
    }
    if(jumps.length) return jumps;
    for(let i=0;i<64;i++){
      const p = b[i];
      if(!p || p.c !== me) continue;
      const r = i >> 3, c = i & 7;
      for(const [dr,dc] of dirsFor(p)){
        const rr = r+dr, cc = c+dc;
        if(!inB(rr,cc)) continue;
        const t = rr*8+cc;
        if(b[t]) continue;
        quiet.push({path:[i,t], caps:[], crown: !p.k && rr === crownRow(p.c)});
      }
    }
    return quiet;
  }

  function make(s, m){
    const n = clone(s), b = n.board;
    const from = m.path[0], to = m.path[m.path.length - 1];
    const p = b[from];
    b[from] = N;
    for(const cap of m.caps) b[cap] = N;
    b[to] = m.crown ? {c:p.c, k:true} : p;
    n.turn = other(p.c);
    return n;
  }

  function result(s){
    const has = c => s.board.some(p => p && p.c === c);
    if(!has('r')) return {over:true, winner:'b'};
    if(!has('b')) return {over:true, winner:'r'};
    if(moves(s).length === 0) return {over:true, winner:other(s.turn), blocked:true};
    return {over:false};
  }

  const MAN = 100, KING = 172;
  function evaluate(s){
    let sc = 0, red = 0, blk = 0;
    for(let i=0;i<64;i++){
      const p = s.board[i];
      if(!p) continue;
      const r = i >> 3, c = i & 7;
      let v = p.k ? KING : MAN;
      if(!p.k) v += (p.c === 'r' ? (7 - r) : r) * 5;          // advancement
      if(c === 0 || c === 7) v -= 4;                            // edge discs are less useful
      else v += 3;
      if(!p.k && ((p.c === 'r' && r === 7) || (p.c === 'b' && r === 0))) v += 6; // hold the back row
      if(p.c === 'r'){ sc += v; red++; } else { sc -= v; blk++; }
    }
    // when ahead, trade down
    if(red !== blk) sc += (red - blk) * (24 - (red + blk)) * 1.5;
    return s.turn === 'r' ? sc : -sc;
  }

  const WIN = 100000;
  let deadline = 0, nodes = 0;
  function timeUp(){ return (++nodes & 511) === 0 && Date.now() > deadline; }

  function negamax(s, depth, alpha, beta, ply){
    if(timeUp()) throw 'T';
    const ms = moves(s);
    if(!ms.length) return -WIN + ply;
    if(depth <= 0 && !ms[0].caps.length) return evaluate(s);
    if(depth <= -6) return evaluate(s);
    ms.sort((a,b) => b.caps.length - a.caps.length);
    for(const m of ms){
      const sc = -negamax(make(s, m), depth - 1, -beta, -alpha, ply + 1);
      if(sc >= beta) return beta;
      if(sc > alpha) alpha = sc;
    }
    return alpha;
  }

  const LEVELS = {
    easy:   {maxDepth:2,  ms:140,  noise:0.22},
    normal: {maxDepth:5,  ms:400,  noise:0.08},
    hard:   {maxDepth:12, ms:1700, noise:0}
  };

  function best(s, diff){
    const cfg = LEVELS[diff] || LEVELS.normal;
    const root = moves(s);
    if(!root.length) return null;
    if(root.length === 1) return root[0];
    if(Math.random() < cfg.noise) return root[(Math.random() * root.length) | 0];

    deadline = Date.now() + cfg.ms; nodes = 0;
    let chosen = root[0];
    for(let d = 1; d <= cfg.maxDepth; d++){
      try{
        let alpha = -Infinity, localBest = chosen;
        const ordered = root.slice().sort((a,b) => (b === chosen) - (a === chosen));
        for(const m of ordered){
          const sc = -negamax(make(s, m), d - 1, -Infinity, -alpha, 1);
          if(sc > alpha){ alpha = sc; localBest = m; }
        }
        chosen = localBest;
      }catch(e){ if(e !== 'T') throw e; break; }
      if(Date.now() > deadline) break;
    }
    return chosen;
  }

  /* standard 1–32 numbering of the dark squares, top-left first */
  const NUM = (function(){
    const map = new Array(64).fill(0); let n = 1;
    for(let i=0;i<64;i++) if(dark(i)) map[i] = n++;
    return map;
  })();
  function notate(m){
    const from = m.path[0], to = m.path[m.path.length - 1];
    if(!m.caps.length) return NUM[from] + '-' + NUM[to];
    return m.path.map(sq => NUM[sq]).join('x');
  }

  return {newGame, clone, moves, make, result, evaluate, best, notate, other, dark, NUM, LEVELS};
})();
