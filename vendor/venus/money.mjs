// Adapted from Venus University shared/money.ts
// Snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2. AGPL-3.0-only; see LICENSE.
/**
 * The money vocabulary: the reader's balance, what a scene costs him, and the debt
 * that ends the game. **The balance is never shown to a model**.
 */

/** What a new save starts with. */
export const STARTING_MONEY = 100

/** The debt at which the loan sharks call it in (`shared/gameOver.ts`). */
const GAME_OVER_DEBT = -5000

/**
 * The ledger's `spent` award as a number the loop can use. **Not a clamp**: the schema's
 * `minimum: 0` is the only bound on the field.
 */
export function spentOf(value                    )         {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.trunc(value)
}

/** `"$100"`, `"-$1,240"` — shared by the status panel and the status line. */
export function formatMoney(amount        )         {
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(amount).toLocaleString('en-US')}`
}

/**
 * The same figure as a **change** rather than a balance: `"+$80"`, `"-$20"`, `"$0"`. A
 * gain has to say so, where a balance never carries a plus.
 */
export function formatDelta(amount        )         {
  return amount > 0 ? `+${formatMoney(amount)}` : formatMoney(amount)
}

/** `"You spent $20."` — the status-sequence line. */
export function spendLine(amount        )         {
  return `You spent ${formatMoney(amount)}.`
}

/** `"You earned $80."` — the same status line for a worked shift. */
export function earnLine(amount        )         {
  return `You earned ${formatMoney(amount)}.`
}

/** True once the debt has reached the floor. Derived from the balance, never stored. */
export function isGameOver(money        )          {
  return money <= GAME_OVER_DEBT
}
