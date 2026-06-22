export type ReportCountItem = {
  label: string;
  value: number;
};

export type ReportPlaytimeItem = {
  label: string;
  seconds: number;
};

export type ReportGapExample = {
  id: string;
  title: string;
};

export type ReportCompleteness = {
  cover: number;
  description: number;
  releaseDate: number;
  externalIds: number;
};

export type ReportGapExamples = {
  missingCover: ReportGapExample[];
  missingDescriptionImage: ReportGapExample[];
  missingExternalIds: ReportGapExample[];
  brokenPath: ReportGapExample[];
};

export type ReportGaps = {
  missingCover: number;
  missingDescriptionImage: number;
  missingExternalIds: number;
  brokenPath: number;
  examples: ReportGapExamples;
};

export type ReportSummary = {
  totalGames: number;
  totalPlaySeconds: number;
  weekPlaySeconds: number;
  monthPlaySeconds: number;
  status: ReportCountItem[];
  tags: ReportCountItem[];
  developers: ReportCountItem[];
  playtime: ReportPlaytimeItem[];
  completeness: ReportCompleteness;
  gaps: ReportGaps;
};
