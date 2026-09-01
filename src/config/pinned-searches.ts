export const pinnedSearches = [
  {
    id: "li-eu",
    label: "LinkedIn EU",
    href: "https://www.linkedin.com/jobs/search/?keywords=" +
      encodeURIComponent(
        '("Senior Frontend" OR "Staff Frontend" OR "Frontend Engineer" OR "Frontend Team Lead") AND (React OR TypeScript) AND (Remote OR "fully remote") NOT (hybrid OR "3 days" OR "US only" OR "United States only")',
      ),
  },
  {
    id: "li-pl",
    label: "LinkedIn Poland",
    href: "https://www.linkedin.com/jobs/search/?keywords=" +
      encodeURIComponent(
        '("Senior Frontend" OR "Frontend Lead" OR "React") AND (Remote OR "w pełni zdalnie" OR B2B) AND (Poland OR Polska OR "EU remote")',
      ),
  },
  {
    id: "wellfound",
    label: "Wellfound",
    href: "https://wellfound.com/role/l/frontend-engineer/remote",
  },
  {
    id: "rwfa",
    label: "Work From Anywhere",
    href: "https://www.realworkfromanywhere.com/",
  },
] as const;
