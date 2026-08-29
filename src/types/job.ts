export type SourceId =
  | "jungle"
  | "himalayas"
  | "wwr"
  | "justjoin"
  | "nofluff"
  | "remoteok";

export type Track = "A" | "B";
export type JobStatus = "new" | "applied" | "rejected";

export type NormalizedJob = {
  source: SourceId;
  externalId: string;
  url: string;
  title: string;
  company: string;
  track: Track;
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

export type FilterInput = {
  title: string;
  company: string;
  description: string;
  location: string;
  tags: string[];
  track: Track;
  contractType: string | null;
  timezone: string | null;
};
