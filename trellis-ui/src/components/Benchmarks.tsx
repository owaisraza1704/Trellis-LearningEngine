import benchmark from '../../public/benchmarks/trellis-v1.json'

export default function Benchmarks() {
  const { dataset, paired_correctness: paired, test, methodology, run } = benchmark
  const { trellis, baseline } = test
  const citations = trellis.metrics.citation_precision
  const recall = trellis.metrics.retrieval_recall_at_8
  const context = trellis.metrics.thread_context
  const expectedStatus = trellis.metrics.expected_status
  const matchedStatuses = Math.round(expectedStatus.score * expectedStatus.scored_rows)
  const number = new Intl.NumberFormat('en-US')
  const runDate = new Date(run.finished_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const tokenRatio =
    trellis.product_usage.total_tokens.total / baseline.product_usage.total_tokens.total
  const comparisons = [
    { label: 'Trellis', score: paired.trellis_score, color: 'bg-[#5B7A58]' },
    { label: 'One-pass RAG baseline', score: paired.baseline_score, color: 'bg-[#A8A5A0]' },
  ]

  return (
    <section
      id="benchmarks"
      aria-labelledby="benchmark-heading"
      className="scroll-mt-28 max-w-6xl mx-auto px-6 sm:px-8 py-20 border-t border-[#E3E0D8]"
    >
      <div className="max-w-2xl mb-10">
        <p className="text-xs text-[#4C6749] uppercase tracking-widest mb-4">
          Benchmarks · {runDate}
        </p>
        <h2
          id="benchmark-heading"
          className="font-display text-3xl sm:text-4xl font-light tracking-tight text-[#1A1916] mb-4"
        >
          Answer quality, measured.
        </h2>
        <p className="text-[#5A5850] leading-relaxed">
          Trellis scored higher than a one-pass RAG baseline on this benchmark. These are
          model-judged results; independent human review is still pending.
        </p>
        <p className="mt-4 text-xs text-[#5A5850]">
          {dataset.total_cases} benchmark cases · {dataset.test_cases} in the test split ·{' '}
          {Object.keys(dataset.category_counts).length} question categories
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="min-w-0 rounded-xl border border-[#D4E0D3] bg-[#F0F4EF] p-6 sm:p-8">
          <figcaption className="mb-8">
            <h3 className="font-display text-xl font-medium text-[#1A1916] mb-2">
              Answer correctness
            </h3>
            <p className="text-sm leading-relaxed text-[#5A5850]">
              Mean LLM-judge score, out of 1. Compared across {paired.paired_rows} paired test
              responses with a score for both configurations.
            </p>
          </figcaption>
          <div className="space-y-6">
            {comparisons.map(({ label, score, color }) => (
              <div key={label}>
                <div className="flex justify-between items-baseline gap-3 mb-2">
                  <span className="text-sm text-[#2D2C28]">{label}</span>
                  <span className="font-display text-2xl tabular-nums text-[#1A1916]">
                    {score.toFixed(3)}
                  </span>
                </div>
                <div aria-hidden="true" className="h-3 rounded-full bg-white overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${score * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-7 text-xs leading-relaxed text-[#5A5850]">
            A graded evaluation signal. It does not represent a factual-accuracy percentage.
          </p>
        </figure>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <article className="min-w-0 rounded-xl border border-[#E3E0D8] bg-white p-6">
            <h3 className="text-sm font-medium text-[#3D3C38] mb-3">Citation precision</h3>
            <p className="font-display text-4xl font-light tabular-nums text-[#1A1916] mb-2">
              {(citations.score * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-[#5A5850] leading-relaxed">
              {citations.supported_citations} of {citations.total_citations} citation links were
              judged supported on the test split. This does not measure support for every claim.
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-[#E3E0D8] bg-white p-6">
            <h3 className="text-sm font-medium text-[#3D3C38] mb-3">Initial retrieval recall@8</h3>
            <p className="font-display text-4xl font-light tabular-nums text-[#1A1916] mb-2">
              {(recall.score * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-[#5A5850] leading-relaxed">
              Mean share of known relevant passages found in the first eight results, across{' '}
              {recall.scored_rows} labelled test responses. Later evidence gathering is excluded.
            </p>
          </article>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#E3E0D8] p-6 sm:p-8">
        <h3 className="font-display text-xl font-medium text-[#1A1916] mb-4">
          The tradeoff: more time and tokens
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-[#3D3C38] mb-1">Median response time</p>
            <p className="text-[#5A5850] leading-relaxed">
              <span className="font-medium text-[#1A1916]">
                {trellis.latency_seconds.median.toFixed(2)}s
              </span>{' '}
              for Trellis, versus {baseline.latency_seconds.median.toFixed(2)}s for the baseline.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[#3D3C38] mb-1">Product token usage</p>
            <p className="text-[#5A5850] leading-relaxed">
              <span className="font-medium text-[#1A1916]">{tokenRatio.toFixed(1)}×</span> the
              baseline: {number.format(trellis.product_usage.total_tokens.total)} versus{' '}
              {number.format(baseline.product_usage.total_tokens.total)} tokens across{' '}
              {trellis.total_rows} test responses.
            </p>
          </div>
        </div>
        <p className="text-xs text-[#5A5850] leading-relaxed mt-5">
          Includes Trellis’s internal checks and query embeddings. Excludes benchmark judging,
          corpus setup, and live web search. Measurements describe this run, not a response-time
          guarantee.
        </p>
      </div>

      <details className="mt-6 rounded-xl border border-[#E3E0D8] bg-white group">
        <summary className="cursor-pointer px-6 py-5 text-sm font-medium text-[#3D3C38] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4A5FA5]">
          How we measured
        </summary>
        <div className="px-6 pb-6 text-sm text-[#5A5850] leading-relaxed space-y-6">
          <p>
            The versioned benchmark contains {dataset.total_cases} cases across{' '}
            {Object.keys(dataset.category_counts).length} categories, with {dataset.dev_cases}{' '}
            development cases and {dataset.test_cases} separate test cases. The figures above use
            the test split, evaluated with {methodology.framework}. Both configurations used{' '}
            {run.model}, the same embeddings, scoped conversation histories, source fixtures, and
            pgvector ranking.
          </p>
          <div>
            <h3 className="font-medium text-[#1A1916] mb-2">What is the baseline?</h3>
            <p>
              The one-pass RAG baseline retrieves with the original question, writes one cited
              draft, and checks citation IDs. Trellis also resolves follow-ups, evaluates grounding,
              can correct a draft, gathers additional evidence when needed, and can offer labelled
              general knowledge where permitted.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#E3E0D8]">
            <table className="w-full text-left text-sm">
              <caption className="text-left px-4 py-3 font-medium text-[#1A1916] bg-[#F7F6F2]">
                Test split: {trellis.total_rows} responses per configuration
              </caption>
              <thead className="border-y border-[#E3E0D8]">
                <tr>
                  <th scope="col" className="p-4 font-medium">
                    Measure
                  </th>
                  <th scope="col" className="p-4 font-medium">
                    Trellis
                  </th>
                  <th scope="col" className="p-4 font-medium">
                    Baseline
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E0D8]">
                <tr>
                  <th scope="row" className="p-4 font-normal">
                    Sourced answers
                  </th>
                  <td className="p-4 tabular-nums">{trellis.coverage.answered.count}</td>
                  <td className="p-4 tabular-nums">{baseline.coverage.answered.count}</td>
                </tr>
                <tr>
                  <th scope="row" className="p-4 font-normal">
                    Labelled general knowledge
                  </th>
                  <td className="p-4 tabular-nums">{trellis.coverage.unverified.count}</td>
                  <td className="p-4 tabular-nums">{baseline.coverage.unverified.count}</td>
                </tr>
                <tr>
                  <th scope="row" className="p-4 font-normal">
                    Withheld answers
                  </th>
                  <td className="p-4 tabular-nums">{trellis.coverage.abstained.count}</td>
                  <td className="p-4 tabular-nums">{baseline.coverage.abstained.count}</td>
                </tr>
                <tr>
                  <th scope="row" className="p-4 font-normal">
                    p95 response time
                  </th>
                  <td className="p-4 tabular-nums">{trellis.latency_seconds.p95.toFixed(2)}s</td>
                  <td className="p-4 tabular-nums">{baseline.latency_seconds.p95.toFixed(2)}s</td>
                </tr>
                <tr>
                  <th scope="row" className="p-4 font-normal">
                    Follow-up resolution score
                  </th>
                  <td className="p-4 tabular-nums">
                    {context.score.toFixed(3)}/1 ({context.scored_rows} responses)
                  </td>
                  <td className="p-4">Not measured; no separate resolver</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Trellis’s response type matched expectations in {matchedStatuses} of{' '}
            {expectedStatus.scored_rows} responses. The remaining{' '}
            {expectedStatus.scored_rows - matchedStatuses} involved conflicting sources and need
            review. The baseline had {baseline.metrics.answer_correctness.error_rows} unavailable
            correctness judgment; it was excluded from the paired comparison.
          </p>
          <div>
            <h3 className="font-medium text-[#1A1916] mb-2">How to interpret these results</h3>
            <p>
              Reference facts and relevance labels are AI-authored and await independent human
              review. The same model generated and judged answers, which can introduce bias. Results
              come from {run.repetitions} run per case with {run.workers} concurrent workers and
              frozen web candidates; live search and page fetching were not tested. These are
              provisional findings for this dataset, not a claim of superiority over other AI
              products.
            </p>
          </div>
        </div>
      </details>

      <a
        href="/benchmarks/trellis-v1.json"
        download
        className="inline-flex mt-6 text-sm text-[#4A5FA5] underline underline-offset-4 hover:text-[#354780] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4A5FA5]"
      >
        Download benchmark results
      </a>
    </section>
  )
}
