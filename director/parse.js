// Parse protocol arguments and [keyword] annotations without interpreting game rules.
export function parseLine(line) {
  if (!line.startsWith('|')) return { kind: 'text', args: [line], kwArgs: {} };
  const [kind, ...parts] = line.slice(1).split('|');
  const args = [], kwArgs = {};
  for (const part of parts) {
    const match = /^\[([^\]]+)\](?:\s*(.*))?$/.exec(part);
    if (match) kwArgs[match[1]] = match[2] || true;
    else args.push(part);
  }
  return { kind, args, kwArgs };
}

export function createProtocolReader() {
  let cursor = 0;
  const ends = new WeakMap();
  return {
    get cursor() { return cursor; },
    endOf: event => ends.get(event),
    read(log, tags) {
      const events = [];
      while (cursor < log.length) {
        const event = parseLine(log[cursor]);
        if (tags) event.tag = tags[cursor];
        if (event.kind === 'split') {
          if (cursor + 2 >= log.length) break;
          const picked = parseLine(log[cursor + (event.args[0] === 'p1' ? 1 : 2)]);
          if (tags) picked.tag = tags[cursor];
          cursor += 3;
          ends.set(picked, cursor);
          events.push(picked);
        } else {
          cursor++;
          ends.set(event, cursor);
          events.push(event);
        }
      }
      return events;
    },
  };
}

export function parseHealth(value, previousMaxhp) {
  const [health, status = ''] = value.split(' ');
  if (health === '0') {
    if (!previousMaxhp) throw new Error('Zero HP without a known maximum');
    return { hp: 0, maxhp: previousMaxhp, status: '' };
  }
  const match = /^(\d+)\/(\d+)$/.exec(health);
  if (!match || +match[2] === 0) throw new Error(`Unsupported HP: ${value}`);
  return { hp: +match[1], maxhp: +match[2], status: status === 'fnt' ? '' : status };
}
