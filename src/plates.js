const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

function randomLetters(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}

function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export function generatePlate() {
  return `${randomLetters(2)}-${randomDigits(3)}-${randomLetters(2)}`;
}

// A recurring pool of plates so the demo feels like real repeat traffic,
// seeded with a few plates matching the ones shown in the source demo video.
export const PLATE_POOL = [
  "FG-482-KL",
  "DK-319-MP",
  "GH-705-TR",
  "BR-226-XV",
  "TN-118-SA",
  "JK-903-QW",
  "ML-567-DP",
  "RX-214-NB",
  ...Array.from({ length: 10 }, generatePlate),
];

export function randomPlate() {
  return PLATE_POOL[Math.floor(Math.random() * PLATE_POOL.length)];
}

// Occasionally mangle a plate the way a real OCR engine would (O/0, I/1 confusion)
// so the reconciliation engine has something to "auto-correct".
export function maybeMangle(plate) {
  if (Math.random() > 0.18) return { read: plate, mangled: false };
  const read = plate
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .split("")
    .map((c, i) => (i === 1 && Math.random() < 0.3 ? (c === "0" ? "O" : c) : c))
    .join("");
  return { read, mangled: read !== plate };
}
