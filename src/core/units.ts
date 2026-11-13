export const TICKS_PER_INCH = 64;
export const FT = 768;
export const inches = (value: number) => Math.round(value * TICKS_PER_INCH);
export const feet = (value: number) => Math.round(value * FT);
export const toFeet = (ticks: number) => ticks / FT;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Bare numbers mean inches. Feet require ft or a prime. Rounded once at the boundary. */
export function parseImperial(input: string): number {
  const metric=input.trim().toLowerCase().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(mm|cm|m)$/);
  if(metric) {
    const millimeters=Number(metric[1])*(metric[2]==="m"?1000:metric[2]==="cm"?10:1);
    const ticks=Math.round(millimeters/25.4*TICKS_PER_INCH);
    if(!Number.isSafeInteger(ticks)||Math.abs(ticks)>feet(10000)) throw new Error("Dimension is outside the 10,000-foot workspace.");
    return ticks;
  }
  let s = input
    .trim()
    .toLowerCase()
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/feet|foot|ft/g, "'")
    .replace(/inches|inch|in/g, '"')
    .trim();
  const sign = s.startsWith("-") ? -1 : 1;
  s = s.replace(/^[+-]/, "").trim();
  let ft = 0;
  if (s.includes("'")) {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(.*)$/);
    if (!m) throw new Error("Use feet and inches, for example 16' 3 1/2\".");
    ft = Number(m[1]);
    s = m[2].replace(/^-\s*/, "");
  }
  s = s.replace(/"$/, "").trim();
  let inch = 0;
  if (s) {
    const m = s.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
    if (m) {
      const denominator = Number(m[3]);
      if (denominator === 0)
        throw new Error("Fraction denominator must be greater than zero.");
      inch = Number(m[1] || 0) + Number(m[2]) / denominator;
    } else if (/^\d+(?:\.\d+)?$/.test(s)) inch = Number(s);
    else throw new Error("Use a dimension such as 16', 6 1/2\", or 192.");
  } else if (!input.match(/['′’]|ft|feet|foot/))
    throw new Error("Enter a dimension.");
  const ticks = Math.round((ft * 12 + inch) * TICKS_PER_INCH) * sign;
  if (!Number.isSafeInteger(ticks) || Math.abs(ticks) > feet(10000))
    throw new Error("Dimension is outside the 10,000-foot workspace.");
  return ticks;
}

export function formatImperial(ticks: number, compact = false): string {
  const t = Math.round(Math.abs(ticks));
  const f = Math.floor(t / FT),
    i = Math.floor((t % FT) / 64),
    n = t % 64;
  const fraction = n ? `${n / gcd(n, 64)}/${64 / gcd(n, 64)}` : "";
  const tail = `${i}${fraction ? ` ${fraction}` : ""}"`;
  return `${ticks < 0 ? "-" : ""}${compact && f === 0 ? "" : `${f}' `}${tail}`;
}
