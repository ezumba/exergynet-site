import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'data', 'voice_credits.json');
const DEFAULT_CREDITS = 5000;

function readLedger(): Record<string, number> {
  try {
    if (!fs.existsSync(LEDGER_PATH)) return {};
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeLedger(data: Record<string, number>): void {
  const dir = path.dirname(LEDGER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2));
}

export function getCredits(userId: string): number {
  const ledger = readLedger();
  if (ledger[userId] === undefined) {
    ledger[userId] = DEFAULT_CREDITS;
    writeLedger(ledger);
  }
  return ledger[userId];
}

export function deductCredits(userId: string, amount: number): boolean {
  const ledger = readLedger();
  const current = ledger[userId] ?? DEFAULT_CREDITS;
  if (current < amount) return false;
  ledger[userId] = current - amount;
  writeLedger(ledger);
  return true;
}

export const getBalance = getCredits; // alias

export function addCredits(userId: string, amount: number): number {
  const ledger = readLedger();
  const current = ledger[userId] ?? DEFAULT_CREDITS;
  ledger[userId] = current + amount;
  writeLedger(ledger);
  return ledger[userId];
}
