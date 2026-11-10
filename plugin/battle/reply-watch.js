// Track story replies while an auxiliary screen is open.
import { messageId, stripForPrompt } from '../../story/blocks.mjs';

export const REPLY_QUIET_MS = 1500;

const textOf = message => stripForPrompt(message?.data ?? '');

export function createReplyWatch({ messages = [], streaming = false, at = Date.now(), quiet = REPLY_QUIET_MS } = {}) {
  const known = new Map(messages.map((m, i) => [messageId(m, i), textOf(m)]));
  const last = messages.length - 1;

  let pending = streaming && messages[last]?.role === 'char' ? { id: messageId(messages[last], last), at } : streaming ? { id: null, at } : null;
  return {
    see(list = [], { streaming: now = false, ours = false, at: when = Date.now() } = {}) {
      const i = list.length - 1, bottom = list[i];
      if (bottom) {
        const id = messageId(bottom, i), text = textOf(bottom);
        if (known.get(id) !== text) {
          known.set(id, text);
          if (!ours && bottom.role === 'char') pending = { id, at: when };
        }

        if (pending?.id && pending.id !== id) pending = null;
        if (pending && !pending.id && bottom.role === 'char') pending.id = id;
      }
      if (!pending) return { reply: false, wait: 0 };
      if (now) { pending.at = when; return { reply: false, wait: quiet }; }
      const left = quiet - (when - pending.at);
      if (left > 0) return { reply: false, wait: left };

      const told = !!pending.id;
      pending = null;
      return { reply: told, wait: 0 };
    },
  };
}
