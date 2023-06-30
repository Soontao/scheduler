const { inspect } = require("util");

const _now = () => new Date().toISOString();

function message4(...parts) {
  if (parts.length === 1 && parts[0] instanceof Array) parts = parts[0];
  return parts.map(part => typeof part === 'string' ? part : inspect(part)).join(" ");
}


module.exports = { message4, _now };