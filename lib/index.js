/**
 * Host half of dsh-billiards.
 *
 * The game is entirely browser-side. Audio samples are embedded in the client
 * bundle as base64 WAVs, so this half registers no routes, tools, sessions, or
 * model surface at all.
 */

/** Stable Cordis plugin name. */
export const name = 'billiards';

/** No host services are required. */
export const inject = [];

/** No-op host entry: the client bundle carries the game and its audio. */
export function apply() {}
