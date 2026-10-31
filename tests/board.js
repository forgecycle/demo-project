// Test helper: build a state from a picture of the board.
// Eight strings of eight characters, row 0 first:
//   d = dark piece, l = light piece, . = empty.
export function boardFrom(rows, turn = 'dark') {
  const pieces = { d: { color: 'dark' }, l: { color: 'light' } };
  const board = rows.map((line) =>
    [...line].map((ch) => (pieces[ch] ? { ...pieces[ch] } : null)),
  );
  return { board, turn };
}
