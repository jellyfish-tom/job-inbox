export const SOURCE_IDS = [
  "himalayas",
  "wwr",
  "remoteok",
  "jungle",
  "justjoin",
  "nofluff",
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export type JobStatus = "new" | "applied" | "rejected";

export type NormalizedJob = {
  source: SourceId;
  externalId: string;
  url: string;
  title: string;
  company: string;
  description: string;
  location: string;
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryRaw: string | null;
  hardRequired: string[];
  hardNice: string[];
  softRequired: string[];
  softNice: string[];
  rawJson: string;
  postedAt: string | null;
};

export type FieldKind = "fetch" | "match" | "both";

export type SourceField = {
  id: string;
  label: string;
  kind: FieldKind;
  valueType: "tokens" | "enum";
  enumValues?: string[];
  queryKey?: string;
};

export type SourceCapabilities = {
  source: SourceId;
  fields: SourceField[];
};

export type SourceFilter = {
  values: Record<string, string[]>;
  exclude: string[];
};

export type MatchInput = {
  title: string;
  description: string;
  tags: string[];
  fields: Record<string, string[]>;
};
