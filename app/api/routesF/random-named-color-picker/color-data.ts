export type ColorGroup = "reds" | "blues";

export type CssNamedColor = {
  name: string;
  hex: string;
  group: ColorGroup;
};

export const CSS_NAMED_COLORS: readonly CssNamedColor[] = [
  { name: "IndianRed", hex: "#CD5C5C", group: "reds" },
  { name: "LightCoral", hex: "#F08080", group: "reds" },
  { name: "Salmon", hex: "#FA8072", group: "reds" },
  { name: "DarkSalmon", hex: "#E9967A", group: "reds" },
  { name: "LightSalmon", hex: "#FFA07A", group: "reds" },
  { name: "Crimson", hex: "#DC143C", group: "reds" },
  { name: "Red", hex: "#FF0000", group: "reds" },
  { name: "FireBrick", hex: "#B22222", group: "reds" },
  { name: "DarkRed", hex: "#8B0000", group: "reds" },
  { name: "Coral", hex: "#FF7F50", group: "reds" },
  { name: "Tomato", hex: "#FF6347", group: "reds" },
  { name: "OrangeRed", hex: "#FF4500", group: "reds" },
  { name: "Pink", hex: "#FFC0CB", group: "reds" },
  { name: "LightPink", hex: "#FFB6C1", group: "reds" },
  { name: "HotPink", hex: "#FF69B4", group: "reds" },
  { name: "DeepPink", hex: "#FF1493", group: "reds" },
  { name: "PaleVioletRed", hex: "#DB7093", group: "reds" },
  { name: "MediumVioletRed", hex: "#C71585", group: "reds" },
  { name: "LightSkyBlue", hex: "#87CEFA", group: "blues" },
  { name: "SkyBlue", hex: "#87CEEB", group: "blues" },
  { name: "DeepSkyBlue", hex: "#00BFFF", group: "blues" },
  { name: "DodgerBlue", hex: "#1E90FF", group: "blues" },
  { name: "CornflowerBlue", hex: "#6495ED", group: "blues" },
  { name: "SteelBlue", hex: "#4682B4", group: "blues" },
  { name: "RoyalBlue", hex: "#4169E1", group: "blues" },
  { name: "Blue", hex: "#0000FF", group: "blues" },
  { name: "MediumBlue", hex: "#0000CD", group: "blues" },
  { name: "DarkBlue", hex: "#00008B", group: "blues" },
  { name: "Navy", hex: "#000080", group: "blues" },
  { name: "MidnightBlue", hex: "#191970", group: "blues" },
  { name: "MediumSlateBlue", hex: "#7B68EE", group: "blues" },
  { name: "SlateBlue", hex: "#6A5ACD", group: "blues" },
  { name: "DarkSlateBlue", hex: "#483D8B", group: "blues" },
  { name: "PowderBlue", hex: "#B0E0E6", group: "blues" },
  { name: "LightBlue", hex: "#ADD8E6", group: "blues" },
];
