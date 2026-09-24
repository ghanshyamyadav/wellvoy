// Content types — validate every JSON file against these at build time (e.g. with Zod) so bad data fails the build, not the UI.
export type Row = { day: string; title: string; detail: string; leg: string };
export type Line = { label: string; sub: string; usd: number };
export type LegPlan = { id: string; nights: number; rows: Row[]; lines: Line[]; hub: string; departAirport: string };
export type Plan = { legs: LegPlan[]; rows: Row[]; lines: Line[]; totalUSD: number; days: number };

export type JourneyConfig = {
  diagnose: { tier: string; city: string; addons: string[] } | null;
  restore: { nights: number; room: string } | null;
  realign: { destination: string; nights: number; practice: string } | null;
  [futureLeg: string]: unknown;               // new legs slot in here
};

type LegBase = { id: string; order: number; label: string; color: string; optional: boolean; chapter: { number: string; title: string; where: string; duration: string; media: string } };
export type Content = {
  site: any;
  legs: {
    diagnose: LegBase & { cities: { id: string; name: string; airport: string; hotel: string }[]; tiers: { id: string; name: string; priceUSD: number; screeningDays: number; meta: string; blurb: string }[]; tests: { name: string; byTier: Record<string, string | null> }[]; addons: { id: string; group: string; name: string; priceUSD: number; extraDays: number; note: string }[] };
    restore: LegBase & { venue: { id: string; name: string; place: string; airport: string; hub: string; transferFromAirport: string }; durations: { nights: number; programme: string }[]; rooms: { id: string; name: string; note: string; rateUSD: number }[] };
    realign: LegBase & { destinations: { id: string; name: string; place: string; rateUSD: number; note: string; stay: string; airport: string; arriveFromRestoreHub: string; media: string | null }[]; durations: { nights: number }[]; practices: { id: string; name: string; note: string }[] };
    [k: string]: LegBase & Record<string, any>;
  };
  packages: { id: string; name: string; line: string; feeling: string; media: { card: string; hero: string }; config: JourneyConfig }[];
  media: { id: string; type: 'video' | 'image'; src: string | null; poster?: string | null }[];
};
