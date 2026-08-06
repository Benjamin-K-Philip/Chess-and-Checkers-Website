/* Sixty-Four — engine tests.  Run with:  node engine.test.js
   No dependencies. Exits non-zero if anything fails. */

const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'engine.js'), 'utf8');
const { CHESS, DRAUGHTS } = eval(src + '\n({CHESS, DRAUGHTS})');

let pass = 0, fail = 0;
function check(name, got, want){
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — got ${got}, wanted ${want}`}`);
}

/* ---------- chess: perft counts every legal move sequence to a given depth.
   These four positions are the standard test set; matching them means
   castling, en passant, promotion and pin detection are all exact. ---------- */
function perft(s, d){
  if(d === 0) return 1;
  let n = 0;
  for(const m of CHESS.legal(s)) n += perft(CHESS.make(s, m), d - 1);
  return n;
}
const POSITIONS = [
  ['opening position', CHESS.newGame(), [1, 20, 400, 8902, 197281]],
  ['kiwipete', CHESS.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -'), [1, 48, 2039, 97862]],
  ['endgame', CHESS.fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -'), [1, 14, 191, 2812, 43238]],
  ['promotion heavy', CHESS.fromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -'), [1, 6, 264, 9467]]
];
for(const [name, pos, expect] of POSITIONS)
  for(let d = 1; d < expect.length; d++)
    check(`chess perft: ${name} depth ${d}`, perft(pos, d), expect[d]);

/* ---------- chess: endings ---------- */
check('fool\'s mate is checkmate',
  CHESS.result(CHESS.fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq -')).type, 'mate');
check('stalemate detected',
  CHESS.result(CHESS.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - -')).type, 'stalemate');
check('bare kings are a draw',
  CHESS.result(CHESS.fromFEN('8/8/4k3/8/8/3K4/8/8 w - -')).type, 'material');
check('repetition key ignores move order', (() => {
  let a = CHESS.newGame();
  const mv = (s, f, t) => CHESS.make(s, CHESS.legal(s).find(m => m.from === f && m.to === t));
  a = mv(a, 62, 45); a = mv(a, 1, 18); a = mv(a, 45, 62); a = mv(a, 18, 1);
  return CHESS.posKey(a) === CHESS.posKey(CHESS.newGame());
})(), true);

/* ---------- checkers ---------- */
const blank = () => ({ board: new Array(64).fill(null), turn: 'r' });
check('checkers opening moves', DRAUGHTS.moves(DRAUGHTS.newGame()).length, 7);
check('twelve discs a side', DRAUGHTS.newGame().board.filter(p => p && p.c === 'r').length, 12);

let t = blank();
t.board[5 * 8 + 2] = { c: 'r', k: false };
t.board[4 * 8 + 3] = { c: 'b', k: false };
t.board[5 * 8 + 6] = { c: 'r', k: false };          // could move quietly, but must not be offered
check('captures are compulsory', DRAUGHTS.moves(t).length, 1);

t = blank();
t.board[6 * 8 + 1] = { c: 'r', k: false };
t.board[5 * 8 + 2] = { c: 'b', k: false };
t.board[3 * 8 + 4] = { c: 'b', k: false };
check('jumps chain', DRAUGHTS.notate(DRAUGHTS.moves(t)[0]), '25x18x11');

t = blank();
t.board[2 * 8 + 1] = { c: 'r', k: false };
t.board[1 * 8 + 2] = { c: 'b', k: false };
const crowning = DRAUGHTS.moves(t)[0];
check('crowned mid-jump ends the turn', crowning.crown, true);
check('crowning produces a king', DRAUGHTS.make(t, crowning).board[crowning.path[1]].k, true);

t = blank(); t.board[4 * 8 + 3] = { c: 'r', k: false };
check('men move forward only', DRAUGHTS.moves(t).length, 2);
t.board[4 * 8 + 3] = { c: 'r', k: true };
check('kings move all four ways', DRAUGHTS.moves(t).length, 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
