export const SEASON = "2025/2026";
export const MIN_PER_CATEGORY = 7;

export function categoryLabel(
  c: string | null | undefined,
  dynamicLabels?: Record<string, string>,
): string {
  if (!c) return "";
  if (dynamicLabels?.[c]) return dynamicLabels[c];
  return c;
}

export const ROLES = [
  "Pilone",
  "Tallonatore",
  "Seconda linea",
  "Terza linea",
  "Mediano di mischia",
  "Mediano di apertura",
  "Centro",
  "Ala",
  "Estremo",
] as const;
export type Role = (typeof ROLES)[number];

export type RoleGroupKey = "Mischia" | "Mediano di mischia" | "Mediano di apertura" | "Trequarti";

export const ROLE_GROUPS: {
  key: RoleGroupKey;
  label: string;
  roles: Role[];
  required: number;
}[] = [
  { key: "Mischia", label: "Mischia", roles: ["Pilone", "Tallonatore", "Seconda linea", "Terza linea"], required: 12 },
  { key: "Mediano di mischia", label: "Mediano di mischia", roles: ["Mediano di mischia"], required: 2 },
  { key: "Mediano di apertura", label: "Mediano di apertura", roles: ["Mediano di apertura"], required: 2 },
  { key: "Trequarti", label: "Trequarti", roles: ["Centro", "Ala", "Estremo"], required: 6 },
];

export function getRoleGroup(role: string): RoleGroupKey | null {
  for (const g of ROLE_GROUPS) if ((g.roles as readonly string[]).includes(role)) return g.key;
  return null;
}