# Sixty-Four — Chess & Checkers

## Description
A browser-based board game application that lets a player play chess or checkers against a built-in computer opponent. Written in plain HTML, CSS and JavaScript with no frameworks, no server and no build step. The project demonstrates core game development principles such as legal move generation, game state management, adversarial search (minimax with alpha-beta pruning) and dynamic theming.

---

## How the Code Works
The application is split into a rules layer and an interface layer. `engine.js` knows the rules of both games and never touches the page; `app.js` draws the board, listens for clicks and asks the engine what is legal. Both games use a flat 64-square array as their board representation.

➤ **Core Architecture and Logic**

The engine exposes two independent objects, `CHESS` and `DRAUGHTS`, which share the same shape of API:

* **Move Generation:** Each engine produces every legal move for the side to play. In chess, candidate moves are generated first and then filtered by making the move and testing whether the king is left attacked, which removes illegal pins automatically.
* **State Handling:** Game states are immutable. `make(state, move)` returns a brand-new state rather than editing the old one, which makes undo and the search tree simple and safe.
* **Special Rules:** Chess supports castling, en passant, promotion, checkmate, stalemate, the fifty-move rule and insufficient material. Checkers enforces compulsory captures, chained multi-jumps and crowning.

➤ **The Computer Opponent**

Both games use the same search technique to choose a move:

* **Minimax with Alpha-Beta:** The engine looks ahead move by move, assuming the player replies with their best option, and prunes branches that cannot affect the result.
* **Position Scoring:** Chess scores material plus piece-square tables, so knights prefer the centre and pawns are rewarded for advancing. Checkers scores material, advancement, back-row defence and trading down when ahead.
* **Iterative Deepening:** Rather than a fixed depth, the search deepens repeatedly until its time budget runs out, so the harder levels stay responsive.

➤ **Interface and Settings**

`app.js` handles all seven screens, the settings panel and the turn loop. Board orientation follows the colour the player chose, so their pieces always sit at the bottom. Theme and layout choices are applied as data attributes on the page body, letting CSS variables restyle everything instantly.

---

## Features

* **Two Complete Games:** Full chess and full American checkers, both playable from start to finish.
* **Three Difficulty Levels:** Easy, Normal and Hard, set by real search depth rather than handicapped rules.
* **Colour Choice:** Play White or Black in chess, Red or Black in checkers, with the board flipping to match.
* **Legal Move Hints:** Selecting a piece lights up its destinations — a dot for a quiet move, a ring for a capture.
* **Six Themes:** Baize & Brass, Midnight Ink, Ivory Hall, Coral Room, Terminal and Rosewood.
* **Layout Options:** Panel position, board size, piece style, coordinates and motion can all be toggled.
* **Move List:** Chess in standard algebraic notation, checkers in the standard 1–32 square numbering.
* **How to Play:** A rules page for each game, written for someone who has never played.

---

## Project Structure

* **index.html:** The entry point. Holds all seven screens and the two game logos drawn as inline SVG.
* **style.css:** Every visual rule — the six themes, the board and pieces, the layout settings and the responsive breakpoints.
* **engine.js:** The rules and the computer opponent for both games. Contains no reference to the page, so it also runs in Node on its own.
* **app.js:** Screen navigation, the settings panel, board drawing, click handling, undo and the turn loop.
* **README.md:** This file.

---

 
 
