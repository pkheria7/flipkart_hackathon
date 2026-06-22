/**
 * Impact & Evidence — deterministic synthetic evidence model.
 *
 * Week 1 (baseline) is derived from REAL hotspot signals (violation_count,
 * recurrence, classification, ROI). Week 2 (enforcement / prioritised-patrol
 * window) applies a DETERMINISTIC, seeded post-enforcement assumption so the
 * numbers never change on refresh.
 *
 * These are evidence-readiness estimates, NOT measured causal outcomes.
 */

import hotspotsMock from '@/data/mock/hotspots.sample.json'
import type { Classification } from '@/types/common'
import { SeededRng } from '@/lib/seededRandom'

/** Minimal shape we need from a hotspot (works for mock + ApiHotspot). */
export interface HotspotLike {
  cluster_id: string
  assigned_station?: string | null
  violation_count?: number | null
  classification?: string | null
  recurrence?: number | null
  roi_score?: number | null
  persistence?: number | null
  feedback_structural_boost?: number | null
}

export type EvidenceStatus =
  | 'Evidence Ready'
  | 'Needs Field Check'
  | 'Monitor One More Week'
  | 'Escalate to BBMP/BTP'

export type NextAction =
  | 'Prepare brief'
  | 'Continue patrol'
  | 'Mark structural'
  | 'Needs BBMP coordination'

export type InsightTone = 'cleared' | 'amber' | 'structural' | 'cyan'

export interface EvidenceCluster {
  clusterId: string
  station: string
  classification: Classification
  week1Pressure: number
  week2Pressure: number
  changePct: number // negative = pressure reduced (good)
  recurrenceWeek1: number
  recurrenceWeek2: number
  roiScore: number
  evidenceStatus: EvidenceStatus
  nextAction: NextAction
}

export interface WeekSnapshot {
  label: string
  sublabel: string
  totalPressure: number
  structuralHotspots: number
  responsiveHotspots: number
  repeatRecurrence: number
  officerHours: number
  escalationReady: number
}

export interface ImpactKpis {
  pressureChangePct: number
  recurringBefore: number
  recurringAfter: number
  highRoiPrioritized: number
  patrolEfficiencyGainPct: number
  escalationBriefs: number
  stationCoverage: number
}

export interface TrendPoint {
  day: number
  label: string
  week: 1 | 2
  /** Indexed to Week 1 Day 1 = 100 (lower = improved). */
  pressureIdx: number
  recurrenceIdx: number
  structuralIdx: number
}

export interface OfficerInsight {
  text: string
  tone: InsightTone
}

export interface RecommendedAction {
  title: string
  detail: string
  tone: InsightTone
}

export interface BriefReadiness {
  ready: number
  stationReview: number
  bbmpEscalation: number
}

export interface ImpactEvidenceData {
  seed: string
  generatedFrom: 'live-hotspots' | 'synthetic-fallback'
  station: string
  week1: WeekSnapshot
  week2: WeekSnapshot
  kpis: ImpactKpis
  trend: TrendPoint[]
  clusters: EvidenceCluster[]
  insights: OfficerInsight[]
  recommendedActions: RecommendedAction[]
  briefReadiness: BriefReadiness
}

const FALLBACK_HOTSPOTS = hotspotsMock as HotspotLike[]

/** Per-classification deterministic reduction envelopes (pressure + recurrence). */
const PRESSURE_REDUCTION: Record<Classification, [number, number]> = {
  STRUCTURAL: [0.08, 0.16],
  RESPONSIVE: [0.18, 0.3],
  SEASONAL: [0.05, 0.13],
}

const RECURRENCE_DROP: Record<Classification, [number, number]> = {
  STRUCTURAL: [0.04, 0.1],
  RESPONSIVE: [0.12, 0.24],
  SEASONAL: [0.03, 0.1],
}

function normaliseClassification(value?: string | null): Classification {
  const v = (value ?? '').toUpperCase()
  if (v === 'STRUCTURAL' || v === 'RESPONSIVE' || v === 'SEASONAL') return v
  return 'RESPONSIVE'
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function classifyEvidence(
  classification: Classification,
  improvementPct: number,
  recurrenceWeek2: number,
  persistence: number,
  feedbackBoost: number,
): { evidenceStatus: EvidenceStatus; nextAction: NextAction } {
  const structuralPersistent =
    classification === 'STRUCTURAL' &&
    (feedbackBoost > 0 || persistence >= 40 || recurrenceWeek2 >= 0.6)

  if (structuralPersistent) {
    return { evidenceStatus: 'Escalate to BBMP/BTP', nextAction: 'Needs BBMP coordination' }
  }
  if (classification === 'RESPONSIVE' && recurrenceWeek2 >= 0.7) {
    return { evidenceStatus: 'Needs Field Check', nextAction: 'Mark structural' }
  }
  if (improvementPct >= 18) {
    return { evidenceStatus: 'Evidence Ready', nextAction: 'Prepare brief' }
  }
  if (improvementPct >= 8) {
    return { evidenceStatus: 'Needs Field Check', nextAction: 'Continue patrol' }
  }
  return { evidenceStatus: 'Monitor One More Week', nextAction: 'Continue patrol' }
}

function buildClusters(hotspots: HotspotLike[], seed: string): EvidenceCluster[] {
  return hotspots.map((h) => {
    const rng = new SeededRng(`${seed}|${h.cluster_id}`)
    const classification = normaliseClassification(h.classification)
    const week1Pressure = Math.max(1, Math.round(h.violation_count ?? 0))
    const recurrenceWeek1 = Math.min(1, Math.max(0, h.recurrence ?? 0))
    const persistence = h.persistence ?? 0
    const feedbackBoost = h.feedback_structural_boost ?? 0

    const [rMin, rMax] = PRESSURE_REDUCTION[classification]
    const reduction = rng.range(rMin, rMax)
    const week2Pressure = Math.max(1, Math.round(week1Pressure * (1 - reduction)))
    const changePct = round1(((week2Pressure - week1Pressure) / week1Pressure) * 100)

    const [drMin, drMax] = RECURRENCE_DROP[classification]
    const recurrenceWeek2 = round1(
      Math.max(0, recurrenceWeek1 * (1 - rng.range(drMin, drMax))) * 100,
    ) / 100

    const improvementPct = -changePct
    const { evidenceStatus, nextAction } = classifyEvidence(
      classification,
      improvementPct,
      recurrenceWeek2,
      persistence,
      feedbackBoost,
    )

    return {
      clusterId: h.cluster_id,
      station: (h.assigned_station ?? 'UNASSIGNED').toString(),
      classification,
      week1Pressure,
      week2Pressure,
      changePct,
      recurrenceWeek1: round1(recurrenceWeek1 * 100) / 100,
      recurrenceWeek2,
      roiScore: round1(h.roi_score ?? 0),
      evidenceStatus,
      nextAction,
    }
  })
}

function buildTrend(
  seed: string,
  totalW1: number,
  totalW2: number,
  recurringW1: number,
  recurringW2: number,
  structuralW1: number,
  structuralW2: number,
): TrendPoint[] {
  const rng = new SeededRng(`${seed}|trend`)
  const dailyPressure = (total: number) => total / 7
  const points: Array<{
    day: number
    week: 1 | 2
    pressure: number
    recurrence: number
    structural: number
  }> = []

  for (let day = 1; day <= 14; day++) {
    const week: 1 | 2 = day <= 7 ? 1 : 2
    const dayInWeek = (day - 1) % 7
    // gentle downward slope within each week + small deterministic jitter
    const slope = 1 - dayInWeek * 0.012
    const jitter = rng.range(0.95, 1.05)
    const pressure = (week === 1 ? dailyPressure(totalW1) : dailyPressure(totalW2)) * slope * jitter
    const recurrence = (week === 1 ? recurringW1 : recurringW2) * rng.range(0.92, 1.08)
    const structural = (week === 1 ? structuralW1 : structuralW2) * rng.range(0.96, 1.04)
    points.push({ day, week, pressure, recurrence, structural })
  }

  const base = points[0]
  const idx = (value: number, baseValue: number) =>
    baseValue <= 0 ? 100 : round1((value / baseValue) * 100)

  return points.map((p) => ({
    day: p.day,
    label: `D${p.day}`,
    week: p.week,
    pressureIdx: idx(p.pressure, base.pressure),
    recurrenceIdx: idx(p.recurrence, base.recurrence),
    structuralIdx: idx(p.structural, base.structural),
  }))
}

function buildInsights(
  kpis: ImpactKpis,
  clusters: EvidenceCluster[],
  briefReadiness: BriefReadiness,
): OfficerInsight[] {
  const insights: OfficerInsight[] = []

  if (kpis.pressureChangePct < 0) {
    insights.push({
      text: `Violation pressure reduced across ${clusters.length} clusters.`,
      tone: 'cleared',
    })
  } else {
    insights.push({
      text: `Violation pressure broadly flat — continue patrol.`,
      tone: 'amber',
    })
  }

  insights.push({
    text: `Recurring hotspots changed from ${kpis.recurringBefore} to ${kpis.recurringAfter}.`,
    tone: kpis.recurringAfter < kpis.recurringBefore ? 'cleared' : 'amber',
  })

  if (briefReadiness.bbmpEscalation > 0) {
    insights.push({
      text: `${briefReadiness.bbmpEscalation} cluster${briefReadiness.bbmpEscalation > 1 ? 's' : ''} still need escalation review.`,
      tone: 'structural',
    })
  }

  // Station that still needs the most attention (highest remaining Week-2 pressure).
  const byStation = new Map<string, number>()
  for (const c of clusters) {
    byStation.set(c.station, (byStation.get(c.station) ?? 0) + c.week2Pressure)
  }
  let worstStation = ''
  let worstPressure = -1
  for (const [station, pressure] of byStation) {
    if (pressure > worstPressure) {
      worstPressure = pressure
      worstStation = station
    }
  }
  if (worstStation) {
    insights.push({
      text: `Highest remaining pressure: ${worstStation.replace(/_/g, ' ')}.`,
      tone: 'cyan',
    })
  }

  return insights.slice(0, 4)
}

function buildRecommendedActions(
  clusters: EvidenceCluster[],
  briefReadiness: BriefReadiness,
): RecommendedAction[] {
  const actions: RecommendedAction[] = []

  if (briefReadiness.bbmpEscalation > 0) {
    actions.push({
      title: `Escalate ${briefReadiness.bbmpEscalation} cluster${briefReadiness.bbmpEscalation > 1 ? 's' : ''} to BBMP/BTP`,
      detail: 'Persistent recurrence needs BBMP/BTP coordination.',
      tone: 'structural',
    })
  }
  if (briefReadiness.ready > 0) {
    actions.push({
      title: `Prepare ${briefReadiness.ready} evidence brief${briefReadiness.ready > 1 ? 's' : ''}`,
      detail: 'Pressure reduced — ready for BTP review.',
      tone: 'cleared',
    })
  }

  const continuePatrol = clusters.filter((c) => c.nextAction === 'Continue patrol').length
  if (continuePatrol > 0) {
    actions.push({
      title: `Continue patrol on ${continuePatrol} cluster${continuePatrol > 1 ? 's' : ''}`,
      detail: 'Improving — keep the current patrol window running.',
      tone: 'cyan',
    })
  }

  if (!actions.length) {
    actions.push({
      title: 'Maintain current patrol plan',
      detail: 'No escalation required. Continue monitoring recurrence.',
      tone: 'cyan',
    })
  }

  return actions.slice(0, 3)
}

/**
 * Build the full deterministic Impact & Evidence dataset.
 *
 * @param seed   stable seed (e.g. `impact|<station>|week2`)
 * @param source optional real hotspots; falls back to deterministic mock set
 */
export function generateImpactEvidence(
  seed: string,
  source?: HotspotLike[] | null,
): ImpactEvidenceData {
  const usable = source && source.length ? source : FALLBACK_HOTSPOTS
  const generatedFrom: ImpactEvidenceData['generatedFrom'] =
    source && source.length ? 'live-hotspots' : 'synthetic-fallback'

  const clusters = buildClusters(usable, seed)

  const totalW1 = clusters.reduce((s, c) => s + c.week1Pressure, 0)
  const totalW2 = clusters.reduce((s, c) => s + c.week2Pressure, 0)

  const structuralW1 = clusters.filter((c) => c.classification === 'STRUCTURAL').length
  const responsiveW1 = clusters.filter((c) => c.classification === 'RESPONSIVE').length
  const recurringW1 = clusters.filter((c) => c.recurrenceWeek1 >= 0.5).length
  const recurringW2 = clusters.filter((c) => c.recurrenceWeek2 >= 0.5).length

  const briefReadiness: BriefReadiness = {
    ready: clusters.filter((c) => c.evidenceStatus === 'Evidence Ready').length,
    stationReview: clusters.filter(
      (c) =>
        c.evidenceStatus === 'Needs Field Check' ||
        c.evidenceStatus === 'Monitor One More Week',
    ).length,
    bbmpEscalation: clusters.filter((c) => c.evidenceStatus === 'Escalate to BBMP/BTP').length,
  }

  // Week-2 structural count: responsive clusters still recurring may shift toward structural.
  const structuralW2 =
    structuralW1 + clusters.filter((c) => c.nextAction === 'Mark structural').length

  const responsiveReductions = clusters
    .filter((c) => c.classification === 'RESPONSIVE')
    .map((c) => (c.week1Pressure - c.week2Pressure) / c.week1Pressure)

  const stations = new Set(clusters.map((c) => c.station))

  const kpis: ImpactKpis = {
    pressureChangePct: totalW1 > 0 ? round1(((totalW2 - totalW1) / totalW1) * 100) : 0,
    recurringBefore: recurringW1,
    recurringAfter: recurringW2,
    highRoiPrioritized: clusters.filter((c) => c.roiScore >= 70).length,
    patrolEfficiencyGainPct: Math.round(mean(responsiveReductions) * 100),
    escalationBriefs: briefReadiness.ready,
    stationCoverage: stations.size,
  }

  const officerHoursW1 = Math.round(totalW1 / 18)
  const officerHoursW2 = Math.round(totalW2 / 18)

  const week1: WeekSnapshot = {
    label: 'Week 1',
    sublabel: 'Baseline window',
    totalPressure: totalW1,
    structuralHotspots: structuralW1,
    responsiveHotspots: responsiveW1,
    repeatRecurrence: recurringW1,
    officerHours: officerHoursW1,
    escalationReady: clusters.filter(
      (c) => c.classification === 'STRUCTURAL' && c.recurrenceWeek1 >= 0.5,
    ).length,
  }

  const week2: WeekSnapshot = {
    label: 'Week 2',
    sublabel: 'Enforcement / prioritised patrol',
    totalPressure: totalW2,
    structuralHotspots: structuralW2,
    responsiveHotspots: clusters.filter(
      (c) => c.classification === 'RESPONSIVE' && c.nextAction !== 'Mark structural',
    ).length,
    repeatRecurrence: recurringW2,
    officerHours: officerHoursW2,
    escalationReady: briefReadiness.bbmpEscalation,
  }

  const trend = buildTrend(
    seed,
    totalW1,
    totalW2,
    recurringW1,
    recurringW2,
    structuralW1,
    structuralW2,
  )

  const insights = buildInsights(kpis, clusters, briefReadiness)
  const recommendedActions = buildRecommendedActions(clusters, briefReadiness)

  // Sort clusters: escalations first, then biggest improvements.
  const ordered = [...clusters].sort((a, b) => {
    const escA = a.evidenceStatus === 'Escalate to BBMP/BTP' ? 1 : 0
    const escB = b.evidenceStatus === 'Escalate to BBMP/BTP' ? 1 : 0
    if (escA !== escB) return escB - escA
    return a.changePct - b.changePct
  })

  return {
    seed,
    generatedFrom,
    station: 'ALL',
    week1,
    week2,
    kpis,
    trend,
    clusters: ordered,
    insights,
    recommendedActions,
    briefReadiness,
  }
}
