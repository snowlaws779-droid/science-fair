export const scienceCategories = [
  "PHYSICS", "CHEMISTRY", "BIOLOGY", "ENGINEERING", "ENVIRONMENT", "TECHNOLOGY",
] as const;

export type ScienceCategory = (typeof scienceCategories)[number];

export type Project = {
  id: string;
  slug: string;
  title: string;
  categories: ScienceCategory[];
  studentNames: string[];
  grade: string;
  coverImage: string;
  shortDescription: string;
  question: string;
  idea: string;
  experiment: string;
  findings: string;
};

export type NavigationItem = { label: string; href: string };
export type Highlight = { value: string; label: string };
export type ProcessStep = { id: string; title: string; description: string };

export const placeholders = {
  scienceCategory: "[SCIENCE CATEGORY]",
  filteredProjects: "[PROJECTS IN THIS SCIENCE CATEGORY]",
} as const;

export type EventConfig = {
  year: string;
  dates: string;
  location: string;
  introduction: string;
  description: string;
  featuredDescription: string;
  galleryDescription: string;
  fieldDescription: string;
  exhibitMedia: string;
  navigation: NavigationItem[];
  highlights: Highlight[];
  processSteps: ProcessStep[];
  exhibits: string[];
};

export const eventConfig: EventConfig = {
  year: "[EVENT YEAR]",
  dates: "[EVENT DATE / TIME]",
  location: "[EVENT LOCATION]",
  introduction: "[SCIENCE WEEK INTRODUCTION]",
  description: "[EVENT DESCRIPTION]",
  featuredDescription: "[FEATURED PROJECTS DESCRIPTION]",
  galleryDescription: "[PROJECT GALLERY DESCRIPTION]",
  fieldDescription: "[FIELD DESCRIPTION]",
  exhibitMedia: "[EXHIBIT MEDIA]",
  navigation: [
    { label: "About", href: "#about" },
    { label: "Projects", href: "#projects" },
    { label: "Science", href: "#fields" },
    { label: "Visit", href: "#visit" },
  ],
  highlights: [
    { value: "[STATISTIC]", label: "[STATISTIC LABEL]" },
    { value: "[STATISTIC]", label: "[STATISTIC LABEL]" },
    { value: "[STATISTIC]", label: "[STATISTIC LABEL]" },
  ],
  processSteps: [
    { id: "01", title: "[PROCESS STEP TITLE]", description: "[PROCESS STEP DESCRIPTION]" },
    { id: "02", title: "[PROCESS STEP TITLE]", description: "[PROCESS STEP DESCRIPTION]" },
    { id: "03", title: "[PROCESS STEP TITLE]", description: "[PROCESS STEP DESCRIPTION]" },
  ],
  exhibits: ["[EXHIBIT TITLE]", "[EXHIBIT TITLE]", "[EXHIBIT TITLE]"],
};

// Six structural slots demonstrate the editorial layout. Replace a slot only
// when the corresponding real project and its category assignments are known.
export const projects: Project[] = Array.from({ length: 6 }, (_, index) => {
  const id = String(index + 1).padStart(2, "0");
  return {
    id,
    slug: `project-slot-${id}`,
    title: `[PROJECT TITLE ${id}]`,
    categories: [],
    studentNames: ["[STUDENT / TEAM NAME]"],
    grade: "[GRADE]",
    coverImage: "[PROJECT IMAGE]",
    shortDescription: "[PROJECT DESCRIPTION]",
    question: "[PROJECT QUESTION]",
    idea: "[PROJECT IDEA]",
    experiment: "[PROJECT EXPERIMENT]",
    findings: "[PROJECT FINDINGS]",
  };
});
