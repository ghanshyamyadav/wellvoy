// Reference implementation of the journey engine. Pure, framework-free, unit-testable.
// Legs are plugins: adding a fourth leg = new JSON file + one LegPlugin. The UI never hard-codes legs.
import type { Content, JourneyConfig, Plan, LegPlan, Row, Line } from './types';

export interface LegPlugin<C = unknown> {
  id: string;                                   // matches content/legs/<id>.json
  plan(cfg: C, ctx: { content: Content; startDay: number; prevHub: string | null }): LegPlan;
}

export const registry = new Map<string, LegPlugin<any>>();
export const registerLeg = (p: LegPlugin<any>) => registry.set(p.id, p);

const fill = (tpl: string, vars: Record<string, unknown>) =>
  tpl.replace(/\{([\w.]+)\}/g, (_, k) => String(k.split('.').reduce((o: any, p: string) => o?.[p], vars) ?? ''));
const range = (a: number, b: number) => (a === b ? `Day ${a}` : `Days ${a}–${b}`);

registerLeg({
  id: 'diagnose',
  plan(cfg: NonNullable<JourneyConfig['diagnose']>, { content, startDay }) {
    const L = content.legs.diagnose;
    const tier = L.tiers.find(t => t.id === cfg.tier)!, city = L.cities.find(c => c.id === cfg.city)!;
    const adds = L.addons.filter(a => cfg.addons.includes(a.id));
    const addDays = adds.reduce((s, a) => s + a.extraDays, 0);
    const nights = 2 + tier.screeningDays + addDays;
    const d0 = startDay, quick = adds.filter(a => !a.extraDays).map(a => a.name);
    const rows: Row[] = [
      { day: range(d0, d0), title: fill('Arrive in {city.name}', { city }), detail: fill('Met on arrival, private transfer to {city.hotel}, coordinator briefing', { city }), leg: 'diagnose' },
      { day: range(d0 + 1, d0 + tier.screeningDays), title: `${tier.name} screening`, detail: 'JCI-accredited partner hospital · private suite', leg: 'diagnose' },
      { day: range(d0 + 1 + tier.screeningDays, d0 + 1 + tier.screeningDays), title: 'Physician debrief' + (quick.length ? ' · ' + quick.join(', ') : ''), detail: 'Your personal health report, explained in person', leg: 'diagnose' },
    ];
    if (addDays) rows.push({ day: range(d0 + 2 + tier.screeningDays, d0 + 1 + tier.screeningDays + addDays), title: adds.filter(a => a.extraDays).map(a => a.name).join(' · '), detail: 'Procedures and supervised recovery', leg: 'diagnose' });
    const lines: Line[] = [{ label: `${tier.name} screening`, sub: `${nights} nights at ${city.hotel}, ${city.name}`, usd: tier.priceUSD }, ...adds.map(a => ({ label: a.name, sub: a.group, usd: a.priceUSD }))];
    return { id: 'diagnose', nights, rows, lines, hub: city.name, departAirport: city.airport };
  }
});

registerLeg({
  id: 'restore',
  plan(cfg: NonNullable<JourneyConfig['restore']>, { content, startDay, prevHub }) {
    const L = content.legs.restore, room = L.rooms.find(r => r.id === cfg.room)!, dur = L.durations.find(x => x.nights === cfg.nights)!;
    const n = cfg.nights, d0 = startDay;
    return {
      id: 'restore', nights: n, hub: L.venue.hub, departAirport: L.venue.airport,
      rows: [
        { day: range(d0, d0), title: prevHub ? 'Transfer to Kerala' : 'Arrive in Calicut', detail: prevHub ? `${prevHub} → Calicut by air, ${L.venue.transferFromAirport}` : `Met at Calicut airport, ${L.venue.transferFromAirport}`, leg: 'restore' },
        { day: range(d0 + 1, d0 + n - 1), title: `Restore · ${n} nights`, detail: `${room.name} · ${dur.programme} · Shirodhara · sattvic board`, leg: 'restore' },
      ],
      lines: [{ label: `${L.venue.name} Ayurveda retreat`, sub: `${n} nights · ${room.name}`, usd: n * room.rateUSD }],
    };
  }
});

registerLeg({
  id: 'realign',
  plan(cfg: NonNullable<JourneyConfig['realign']>, { content, startDay, prevHub }) {
    const L = content.legs.realign, dest = L.destinations.find(x => x.id === cfg.destination)!, pr = L.practices.find(p => p.id === cfg.practice)!;
    const n = cfg.nights, d0 = startDay;
    const detail = !prevHub ? 'Met on arrival, private transfer to the villa'
      : prevHub === content.legs.restore.venue.hub ? dest.arriveFromRestoreHub
      : `${prevHub} → ${dest.name} by air, private transfer`;   // TODO: move to content/transfers.json matrix
    return {
      id: 'realign', nights: n, hub: dest.name, departAirport: dest.airport,
      rows: [
        { day: range(d0, d0), title: prevHub ? `Transfer to ${dest.name}` : `Arrive in ${dest.name}`, detail, leg: 'realign' },
        { day: range(d0 + 1, d0 + n - 1), title: `Realign · ${n} nights`, detail: `${dest.place} · ${pr.name} · pranayama · meditation`, leg: 'realign' },
      ],
      lines: [{ label: `Yoga retreat, ${dest.name}`, sub: `${n} nights · ${dest.stay}`, usd: n * dest.rateUSD }],
    };
  }
});

export function planJourney(cfg: JourneyConfig, content: Content): Plan {
  const legs = Object.values(content.legs).sort((a, b) => a.order - b.order);
  let day = 1, prevHub: string | null = null, depart = '';
  const out: LegPlan[] = [];
  for (const leg of legs) {
    const legCfg = (cfg as any)[leg.id];
    if (!legCfg) continue;
    const p = registry.get(leg.id)!.plan(legCfg, { content, startDay: day, prevHub });
    out.push(p); day += p.nights; prevHub = p.hub; depart = p.departAirport;
  }
  const rows = out.flatMap(p => p.rows);
  rows.push({ day: `Day ${day}`, title: 'Depart', detail: `Private transfer to ${depart} · your report travels with you`, leg: 'depart' });
  const lines = out.flatMap(p => p.lines);
  return { legs: out, rows, lines, totalUSD: lines.reduce((s, l) => s + l.usd, 0), days: day };
}

export const formatPrice = (usd: number, cur: { symbol: string; rateFromUSD: number; roundTo: number }) =>
  cur.symbol + (Math.round((usd * cur.rateFromUSD) / cur.roundTo) * cur.roundTo).toLocaleString('en-US');
