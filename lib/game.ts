import type { GameConfig } from "./demo-data";

export type Challenge = { left: number; right: number; operation: "+" | "-"; answer: number };

export function makeChallenge(config: GameConfig, seed = 1): Challenge {
  const span = Math.max(2, config.max - config.min);
  const left = config.min + ((seed * 7) % span);
  const right = 1 + ((seed * 3) % Math.max(2, Math.min(9, span)));
  const operation: "+" | "-" = config.operation === "Penjumlahan" ? "+" : config.operation === "Pengurangan" ? "-" : seed % 2 === 0 ? "+" : "-";
  const answer = operation === "+" ? left + right : left - right;
  return { left, right, operation, answer };
}

export function getGameGrade(correct: number, total: number, config: GameConfig) {
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { score, passed: score >= config.passThreshold };
}
