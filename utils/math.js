function dot(a, b) {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += (a[i] || 0) * (b[i] || 0);
  return s;
}

function norm(a) {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

function cosine(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const d = dot(a, b);
  const n = norm(a) * norm(b) || 1;
  return d / n;
}

module.exports = { dot, norm, cosine };
