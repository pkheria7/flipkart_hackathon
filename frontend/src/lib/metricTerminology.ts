/** Officer-friendly labels for all technical metrics used in the platform. */

export interface MetricTerm {
  officerLabel: string
  technicalLabel: string
  shortHelp: string
  detailedHelp: string
}

export const METRIC: Record<string, MetricTerm> = {
  roi: {
    officerLabel: 'Enforcement Priority',
    technicalLabel: 'ROI score',
    shortHelp: 'How valuable this hotspot is for enforcement action.',
    detailedHelp:
      'Higher score means this hotspot is expected to give stronger traffic-impact benefit per officer-hour deployed.',
  },
  lcle: {
    officerLabel: 'Road Space Blocked',
    technicalLabel: 'LCLE %',
    shortHelp: 'Estimated usable road space lost due to parked vehicles.',
    detailedHelp:
      'Lane Clearance Loss Estimate measures how much road capacity may be blocked by parking pressure. Higher % = more severe blockage.',
  },
  bci: {
    officerLabel: 'Network Importance',
    technicalLabel: 'BCI',
    shortHelp: 'How important this road segment is in the surrounding network.',
    detailedHelp:
      'Betweenness Centrality Index — higher values mean disruptions here can affect more movement routes across the city.',
  },
  violations: {
    officerLabel: 'Violation Count',
    technicalLabel: 'FTVR records',
    shortHelp: 'Number of parking violation records linked to this hotspot.',
    detailedHelp: 'Total challan/FTVR records assigned to this cluster from the dataset.',
  },
  persistence: {
    officerLabel: 'Repeat Pressure',
    technicalLabel: 'Persistence',
    shortHelp: 'How strongly the hotspot keeps appearing over time.',
    detailedHelp:
      'Persistence score reflects how consistently this hotspot appears across multiple time windows — higher means it is a chronic problem.',
  },
  recurrence: {
    officerLabel: 'Recurrence Rate',
    technicalLabel: 'Recurrence',
    shortHelp: 'How often the hotspot returns after enforcement or across windows.',
    detailedHelp:
      'A value near 1.0 means the hotspot almost always recurs. Lower values suggest enforcement may have had effect.',
  },
  peakWindow: {
    officerLabel: 'Peak Violation Window',
    technicalLabel: 'Peak window (IST)',
    shortHelp: 'Time window when violation records are highest.',
    detailedHelp:
      'Derived from challan activity timestamps converted to IST. Patrol during this window is expected to be most effective.',
  },
}

export const CLASSIFICATION_TERM: Record<string, MetricTerm> = {
  STRUCTURAL: {
    officerLabel: 'Structural Issue',
    technicalLabel: 'STRUCTURAL',
    shortHelp: 'Likely needs infrastructure, signage, towing, or BBMP/BTP coordination.',
    detailedHelp:
      'This hotspot shows patterns consistent with a road-design or infrastructure problem. Patrol alone may not resolve it — escalation to BBMP or BTP infrastructure review is recommended.',
  },
  RESPONSIVE: {
    officerLabel: 'Patrol-Responsive',
    technicalLabel: 'RESPONSIVE',
    shortHelp: 'Likely manageable through targeted patrol or enforcement.',
    detailedHelp:
      'This hotspot responds well to enforcement presence. Targeted patrol during the peak window is expected to reduce violations.',
  },
  SEASONAL: {
    officerLabel: 'Seasonal Pattern',
    technicalLabel: 'SEASONAL',
    shortHelp: 'Likely tied to specific days, windows, events, or recurring local patterns.',
    detailedHelp:
      'Violation patterns here appear linked to seasonal activity, weekly cycles, or local events. Plan enforcement around the identified peak windows.',
  },
}
