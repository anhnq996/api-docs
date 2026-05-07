import type { ApiSpec } from "./apiSpec";
import { spec as sampleSpec } from "./apiSpec";

export interface Project {
  id: string;
  name: string;
  description: string;
  spec: ApiSpec;
  sourceName: string;
  createdAt: string;
  color: string;
}

const STORAGE_KEY = "nebula.projects.v1";

const COLORS = [
  "from-indigo-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-violet-500 to-purple-500",
];

export function randomColor(i = Math.floor(Math.random() * COLORS.length)) {
  return COLORS[i % COLORS.length];
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const seed: Project[] = [
    {
      id: "sample-nebula",
      name: sampleSpec.info.title,
      description: sampleSpec.info.description,
      spec: sampleSpec,
      sourceName: "Built-in sample",
      createdAt: new Date().toISOString(),
      color: COLORS[0],
    },
  ];
  saveProjects(seed);
  return seed;
}

export function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore
  }
}
