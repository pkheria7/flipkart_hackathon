export function MapLegend() {
  const items = [
    { color: 'bg-status-structural', label: 'Structural' },
    { color: 'bg-btp-cyan', label: 'Responsive' },
    { color: 'bg-status-seasonal', label: 'Seasonal' },
    { color: 'bg-status-route', label: 'Patrol route' },
  ]

  return (
    <div className="glass-navy px-3 py-2 !rounded-xl !p-2.5">
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-btp-cyan/80">
        Legend
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[10px] text-civic-white/80">
            <span className={`h-2 w-2 rounded-full ${item.color}`} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
