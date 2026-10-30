/**
 * Utility for generating multi-shade sequential heat map colors for India Origin Heat Map.
 * Requirements:
 * - 0 orders: Pure White (#FFFFFF)
 * - Multiple progressive shades from 0 to maximum orders:
 *   Light Orange -> Dark Orange -> Crimson Red -> Deep Red -> Darkest Red (Peak Max)
 * - Darkest Red strictly awarded to the maximum order count.
 */

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function interpolateHex(color1: string, color2: string, factor: number): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(
    r1 + (r2 - r1) * factor,
    g1 + (g2 - g1) * factor,
    b1 + (b2 - b1) * factor
  );
}

// Color stops for city bubbles / markers
const CITY_COLOR_RAMP: [number, string][] = [
  [0.0, "#FDBA74"], // 0.0 -> Light Orange
  [0.25, "#FB923C"], // 0.25 -> Warm Amber / Medium Orange
  [0.50, "#EA580C"], // 0.50 -> Dark Orange
  [0.75, "#DC2626"], // 0.75 -> Crimson Red
  [0.90, "#991B1B"], // 0.90 -> Deep Red
  [1.0, "#7F1D1D"], // 1.0 -> Darkest Red (Peak Max)
];

export interface CityColorInfo {
  fill: string;
  stroke: string;
  haloColor: string;
  label: string;
  badgeClass: string;
  isMax: boolean;
  tier: "zero" | "light-orange" | "medium-orange" | "dark-orange" | "crimson" | "deep-red" | "darkest-red";
}

/**
 * Returns complete color styling for a city marker based on its orderCount and maxOrderCount.
 */
export function getCityColorInfo(orderCount: number, maxOrders: number): CityColorInfo {
  if (orderCount <= 0) {
    return {
      fill: "#FFFFFF",
      stroke: "#CBD5E1",
      haloColor: "transparent",
      label: "0 Orders (White)",
      badgeClass: "bg-white text-zinc-600 border border-zinc-200",
      isMax: false,
      tier: "zero",
    };
  }

  // When count equals or exceeds max, always assign Darkest Red
  if (orderCount >= maxOrders) {
    return {
      fill: "#7F1D1D", // Darkest Red
      stroke: "#FFFFFF",
      haloColor: "#7F1D1D",
      label: `Max (${orderCount} orders - Darkest Red)`,
      badgeClass: "bg-rose-950 text-rose-100 border border-rose-900 font-bold shadow-sm ring-1 ring-rose-500/40",
      isMax: true,
      tier: "darkest-red",
    };
  }

  if (maxOrders <= 1) {
    return {
      fill: "#7F1D1D",
      stroke: "#FFFFFF",
      haloColor: "#7F1D1D",
      label: "1 Order (Darkest Red)",
      badgeClass: "bg-rose-950 text-rose-100 border border-rose-900 font-bold",
      isMax: true,
      tier: "darkest-red",
    };
  }

  // Explicit discrete mapping for small ranges (like October with max=3)
  if (maxOrders === 3) {
    if (orderCount === 1) {
      return {
        fill: "#FDBA74", // Light Orange
        stroke: "#FFFFFF",
        haloColor: "#FDBA74",
        label: "1 Order (Light Orange)",
        badgeClass: "bg-orange-100 text-orange-900 border border-orange-200 font-bold",
        isMax: false,
        tier: "light-orange",
      };
    }
    if (orderCount === 2) {
      return {
        fill: "#EA580C", // Dark Orange
        stroke: "#FFFFFF",
        haloColor: "#EA580C",
        label: "2 Orders (Dark Orange)",
        badgeClass: "bg-orange-600 text-white border border-orange-700 font-bold shadow-xs",
        isMax: false,
        tier: "dark-orange",
      };
    }
  }

  // Normalized ratio strictly between 0 and 1
  const t = (orderCount - 1) / Math.max(maxOrders - 1, 1);

  // Interpolate hex fill
  let fill = "#7F1D1D";
  for (let i = 0; i < CITY_COLOR_RAMP.length - 1; i++) {
    const [t1, c1] = CITY_COLOR_RAMP[i];
    const [t2, c2] = CITY_COLOR_RAMP[i + 1];
    if (t >= t1 && t <= t2) {
      const segmentFactor = (t - t1) / (t2 - t1);
      fill = interpolateHex(c1, c2, segmentFactor);
      break;
    }
  }

  if (t <= 0.15) {
    return {
      fill,
      stroke: "#FFFFFF",
      haloColor: fill,
      label: `${orderCount} Orders (Light Orange)`,
      badgeClass: "bg-orange-100 text-orange-900 border border-orange-200 font-bold",
      isMax: false,
      tier: "light-orange",
    };
  } else if (t <= 0.35) {
    return {
      fill,
      stroke: "#FFFFFF",
      haloColor: fill,
      label: `${orderCount} Orders (Warm Orange)`,
      badgeClass: "bg-orange-500 text-white border border-orange-600 font-bold shadow-xs",
      isMax: false,
      tier: "medium-orange",
    };
  } else if (t <= 0.55) {
    return {
      fill,
      stroke: "#FFFFFF",
      haloColor: fill,
      label: `${orderCount} Orders (Dark Orange)`,
      badgeClass: "bg-orange-600 text-white border border-orange-700 font-bold shadow-xs",
      isMax: false,
      tier: "dark-orange",
    };
  } else if (t <= 0.75) {
    return {
      fill,
      stroke: "#FFFFFF",
      haloColor: fill,
      label: `${orderCount} Orders (Crimson Red)`,
      badgeClass: "bg-red-600 text-white border border-red-700 font-bold shadow-xs",
      isMax: false,
      tier: "crimson",
    };
  } else {
    return {
      fill,
      stroke: "#FFFFFF",
      haloColor: fill,
      label: `${orderCount} Orders (Deep Red)`,
      badgeClass: "bg-red-800 text-white border border-red-900 font-bold shadow-xs",
      isMax: false,
      tier: "deep-red",
    };
  }
}

export interface StateColorInfo {
  fill: string;
  stroke: string;
  label: string;
}

/**
 * Returns fill and stroke for an Indian State polygon.
 * 0 orders: Pure White (#FFFFFF)
 * Rising gradually from subtle light orange tint to rich rose-red tint for max volume.
 */
export function getStateColorInfo(orderCount: number, maxStateOrders: number): StateColorInfo {
  if (orderCount <= 0) {
    return {
      fill: "#FFFFFF", // Pure white area as requested
      stroke: "#E2E8F0", // Neutral subtle boundary
      label: "0 orders (White area)",
    };
  }

  const ratio = orderCount / Math.max(maxStateOrders, 1);

  if (ratio >= 0.9) {
    return {
      fill: "#FCA5A5", // Rich rose red tint for peak state (e.g. Maharashtra)
      stroke: "#DC2626", // Crisp red boundary
      label: `${orderCount} orders (Peak Red)`,
    };
  } else if (ratio >= 0.65) {
    return {
      fill: "#FECDD3", // Rose 200
      stroke: "#F87171",
      label: `${orderCount} orders (Deep Red tint)`,
    };
  } else if (ratio >= 0.4) {
    return {
      fill: "#FEE2E2", // Soft red / warm peach tint
      stroke: "#FCA5A5",
      label: `${orderCount} orders (Light Red tint)`,
    };
  } else if (ratio >= 0.2) {
    return {
      fill: "#FFEDD5", // Orange 100
      stroke: "#FDBA74",
      label: `${orderCount} orders (Dark Orange tint)`,
    };
  } else {
    return {
      fill: "#FFF7ED", // Orange 50 (lightest tint)
      stroke: "#FED7AA",
      label: `${orderCount} orders (Light Orange tint)`,
    };
  }
}

/**
 * Standard sequential color scale swatches for the Legend.
 */
export const LEGEND_SHADES = [
  { label: "0 Orders", color: "#FFFFFF", border: "#CBD5E1", text: "White Area" },
  { label: "1 Order / Low", color: "#FDBA74", border: "#FB923C", text: "Light Orange" },
  { label: "Mid Volume", color: "#EA580C", border: "#C2410C", text: "Dark Orange" },
  { label: "High Volume", color: "#DC2626", border: "#B91C1C", text: "Crimson Red" },
  { label: "Max Peak", color: "#7F1D1D", border: "#450A0A", text: "Darkest Red" },
];

/**
 * Calculates city circle marker radius strictly proportional to order volume.
 * Guarantees that any city with more orders has a strictly larger circle dimension than one with fewer orders.
 *
 * Specific benchmarks:
 * - 1 order: Base compact size (5.5px radius)
 * - Maximum orders: Largest size (11.5px to 17px radius depending on max order count)
 * - Intermediate orders: Monotonically increasing using area-proportional square-root scaling (sqrt(orderCount)).
 *
 * Example (with max = 28):
 * - Pune (28 orders): radius = 17.0px (diameter = 34px)
 * - Mumbai (10 orders): radius = 11.2px (diameter = 22.4px) -> visibly smaller than Pune!
 * - Bengaluru (6 orders): radius = 9.3px (diameter = 18.6px)
 * - Delhi (3 orders): radius = 7.5px (diameter = 15.0px)
 * - Lucknow (2 orders): radius = 6.6px (diameter = 13.2px)
 * - Baran (1 order): radius = 5.5px (diameter = 11.0px)
 */
export function getCityCircleRadius(orderCount: number, maxOrders: number): number {
  if (orderCount <= 0) return 4;
  if (maxOrders <= 1 || orderCount <= 1) return 5.5;

  const maxRadius = maxOrders <= 3 ? 11.5 : maxOrders <= 8 ? 14 : 17;
  const minRadius = 5.5;

  if (orderCount >= maxOrders) {
    return maxRadius;
  }

  const norm = (Math.sqrt(orderCount) - 1) / (Math.sqrt(maxOrders) - 1);
  const clampedNorm = Math.max(0, Math.min(1, norm));
  const radius = minRadius + clampedNorm * (maxRadius - minRadius);

  return Math.round(radius * 10) / 10;
}

/**
 * Calculates outer heat halo spread radius strictly proportional to order volume.
 */
export function getCityHaloRadius(orderCount: number, maxOrders: number): number {
  if (orderCount <= 0) return 0;
  if (maxOrders <= 1 || orderCount <= 1) return 16;

  const minHalo = 16;
  const maxHalo = maxOrders <= 3 ? 28 : maxOrders <= 8 ? 34 : 44;

  if (orderCount >= maxOrders) {
    return maxHalo;
  }

  const norm = (Math.sqrt(orderCount) - 1) / (Math.sqrt(maxOrders) - 1);
  const clampedNorm = Math.max(0, Math.min(1, norm));
  const halo = minHalo + clampedNorm * (maxHalo - minHalo);

  return Math.round(halo * 10) / 10;
}

