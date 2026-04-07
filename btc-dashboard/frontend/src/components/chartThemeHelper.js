/**
 * chartThemeHelper.js
 * Transforms ECharts options from dark to light theme automatically.
 * Wraps tooltip formatter functions to replace hardcoded colors in HTML output.
 */

const COLOR_PAIRS = [
  // Tooltip & card backgrounds
  ['#111120', '#ffffff'],
  ['#252540', '#d0d0d8'],
  ['rgba(10,10,20,0.92)', 'rgba(255,255,255,0.96)'],
  ['rgba(10,10,20,0.72)', 'rgba(255,255,255,0.85)'],

  // Text
  ['#e8e8f0', '#1a1a2e'],
  ['#9090b0', '#5a5a70'],
  ['#9090c8', '#5a5a80'],
  ['#9090b8', '#5a5a80'],
  ['#5a5a80', '#8a8a9e'],
  ['#8080a8', '#6a6a80'],
  ['#b0b0c8', '#5a5a70'],

  // Borders & split lines
  ['#1e1e35', '#d0d0d8'],
  ['#2a2a50', '#d0d0d8'],
  ['#2a2a42', '#d0d0dc'],
  ['#28283c', '#b0b0c0'],
  ['#3d3d6b', '#b0b0c0'],

  // Backgrounds
  ['rgba(10,10,15,0.6)', 'rgba(245,245,250,0.8)'],
  ['rgba(37,37,64,0.4)', 'rgba(200,200,220,0.3)'],
  ['rgba(37,37,64,0.3)', 'rgba(200,200,220,0.3)'],
  ['rgba(247,147,26,0.08)', 'rgba(247,147,26,0.12)'],
  ['rgba(247,147,26,0.1)', 'rgba(247,147,26,0.15)'],
  ['rgba(247,147,26,0.15)', 'rgba(247,147,26,0.2)'],
  ['rgba(247,147,26,0.18)', 'rgba(247,147,26,0.22)'],
  ['rgba(144,144,176,0.12)', 'rgba(100,100,140,0.1)'],
  ['rgba(144,144,176,0)', 'rgba(100,100,140,0)'],
  ['rgba(247,147,26,0.35)', 'rgba(247,147,26,0.4)'],
  ['rgba(255,255,255,0.15)', 'rgba(0,0,0,0.15)'],
  ['rgba(120,120,192,0.3)', 'rgba(120,120,180,0.25)'],
  ['rgba(255,255,255,0.03)', 'rgba(0,0,0,0.03)'],
  ['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)'],
  ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)'],
  ['rgba(247,147,26,0)', 'rgba(247,147,26,0)'],
  ['rgba(247,147,26,0.00)', 'rgba(247,147,26,0)'],
  ['#0a0a0f', '#f5f5fa'],
];

const DARK_TO_LIGHT = new Map(COLOR_PAIRS);

// Regex: sort by length descending so longer rgba(...) matches before shorter #hex
const sortedPairs = [...COLOR_PAIRS].sort((a, b) => b[0].length - a[0].length);
const HTML_REGEX = new RegExp(
  sortedPairs.map(([dark]) => dark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

function replaceHtmlColors(html) {
  if (typeof html !== 'string') return html;
  return html.replace(HTML_REGEX, match => DARK_TO_LIGHT.get(match) ?? match);
}

function mapColor(c) {
  if (!c || typeof c !== 'string') return c;
  return DARK_TO_LIGHT.get(c) ?? c;
}

function deepMapColors(obj, parentKey) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return mapColor(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) {
    // Skip numeric data arrays
    if (parentKey === 'data' && obj.length > 0) {
      const first = obj[0];
      if (typeof first === 'number' || (Array.isArray(first) && typeof first[0] === 'number')) {
        return obj;
      }
    }
    return obj.map((item) => deepMapColors(item, parentKey));
  }
  if (typeof obj !== 'object') return obj;

  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'function') {
      // Wrap formatter functions to replace colors in their HTML output
      if (key === 'formatter' || key === 'labelFormatter') {
        const origFn = val;
        result[key] = function(...args) {
          const output = origFn.apply(this, args);
          return replaceHtmlColors(output);
        };
      } else {
        result[key] = val;
      }
      continue;
    }
    result[key] = deepMapColors(val, key);
  }
  return result;
}

/**
 * Patch an ECharts option for the current theme.
 * If isDark is true, returns the option unchanged.
 * If isDark is false, deep-walks the option replacing dark colors with light equivalents.
 */
export function patchOption(option, isDark) {
  if (isDark || !option) return option;
  return deepMapColors(option);
}
