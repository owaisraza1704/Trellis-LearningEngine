import { generalKnowledgeLabel, generalKnowledgeNotice } from '../lib/response'

export default function GeneralKnowledgeNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? 'my-2 text-[11px] leading-relaxed text-[#6F6047]'
          : 'mb-4 rounded-lg border border-[#E6DCC8] bg-[#FBF7ED] p-3 text-xs text-[#6F6047]'
      }
    >
      <p className="font-medium">{generalKnowledgeLabel}</p>
      {!compact && <p className="mt-1 leading-relaxed">{generalKnowledgeNotice}</p>}
    </div>
  )
}
