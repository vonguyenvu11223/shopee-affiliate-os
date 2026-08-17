export const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export const compactNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const stageLabel: Record<string, string> = {
  EARLY_RISING: "Early rising",
  BREAKOUT: "Breakout",
  TRENDING: "Trending",
  PEAKING: "Peaking",
  DECLINING: "Declining",
  DISCOVERY: "Discovery",
  SATURATED: "Saturated",
  DEAD: "Dead",
};
