import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, PlugZap } from 'lucide-react'
import { api, type Settings as SettingsData } from '../lib/api'
import { ErrorNotice, Loading, Status } from '../components/ui'

export default function Settings() {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsData>('/settings'),
  })
  if (query.isPending) return <Loading />
  if (!query.data) return <ErrorNotice error={query.error} />
  return <ProviderSettings settings={query.data} />
}
function ProviderSettings({ settings }: { settings: SettingsData }) {
  const client = useQueryClient()
  const [provider, setProvider] = useState(settings.provider)
  const [model, setModel] = useState(settings.model)
  const [saved, setSaved] = useState(false)
  const current = settings.providers.find((item) => item.id === provider)
  const save = useMutation({
    mutationFn: () => api('/settings', 'PUT', { provider, model }),
    onSuccess: () => {
      setSaved(true)
      client.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const test = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; message: string }>('/settings/test', 'POST', {
        provider,
        model,
      }),
  })
  return (
    <div className="screen-enter max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light">Settings</h1>
        <p className="mt-1 text-sm text-[#7A7870]">
          Your local learning workspace and the models behind it.
        </p>
      </div>
      <section className="rounded-xl border border-[#E3E0D8] bg-white p-6">
        <h2 className="font-display text-xl">Learning assistant</h2>
        <p className="mb-5 mt-2 text-sm text-[#7A7870]">
          Choose a provider and model. Connections are configured on this laptop; API keys stay on
          the server.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setSaved(false)
            save.mutate()
          }}
        >
          <label htmlFor="provider" className="field-label">
            Provider
          </label>
          <select
            id="provider"
            className="field"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value)
              setModel(
                settings.providers.find((item) => item.id === event.target.value)?.model || '',
              )
              setSaved(false)
              test.reset()
            }}
          >
            {settings.providers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.configured ? '' : ' — setup needed'}
              </option>
            ))}
          </select>
          <label htmlFor="model" className="field-label">
            {provider === 'azure' ? 'Azure deployment name' : 'Model name'}
          </label>
          <input
            id="model"
            className="field"
            required
            value={model}
            onChange={(event) => {
              setModel(event.target.value)
              setSaved(false)
              test.reset()
            }}
            placeholder={
              provider === 'azure'
                ? 'Your configured deployment name'
                : provider === 'ollama'
                  ? 'A model installed in Ollama'
                  : 'Provider model ID'
            }
          />
          {current?.base_url && (
            <p className="mt-2 break-all text-xs text-[#A8A5A0]">Endpoint: {current.base_url}</p>
          )}
          {!current?.configured && (
            <p className="mt-3 rounded-lg border border-[#E8D9AA] bg-[#FAF5EA] p-3 text-xs text-[#8C7537]">
              Configure this provider’s connection in the project .env and restart the backend
              before selecting it.
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              className="btn"
              disabled={save.isPending || !model.trim() || !current?.configured}
            >
              {save.isPending ? 'Saving…' : 'Save model settings'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={test.isPending || !model.trim() || !current?.configured}
              onClick={() => test.mutate()}
            >
              <PlugZap size={14} />
              {test.isPending ? 'Testing…' : 'Test connection'}
            </button>
          </div>
          <ErrorNotice error={save.error || test.error} />
          {test.data && (
            <div
              role="status"
              className={`mt-4 rounded-lg p-3 text-sm ${
                test.data.ok ? 'bg-[#EFF4EE] text-[#5B7A58]' : 'bg-[#FFF4F1] text-[#A8554E]'
              }`}
            >
              {test.data.message}
            </div>
          )}
          {saved && (
            <p role="status" className="mt-3 flex items-center gap-1 text-sm text-[#5B7A58]">
              <Check size={14} /> Settings saved
            </p>
          )}
        </form>
      </section>
      <section className="mt-5 rounded-xl border border-[#E3E0D8] bg-white p-6">
        <h2 className="font-display text-xl">Evidence and retrieval</h2>
        <p className="mt-3 text-sm text-[#7A7870]">
          Supplied material takes priority. Without supporting evidence, the assistant explains what
          is missing instead of inventing an answer.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-[#A8A5A0]">Embedding provider</dt>
          <dd>{settings.embedding.provider}</dd>
          <dt className="text-[#A8A5A0]">Embedding model</dt>
          <dd className="break-all">{settings.embedding.model}</dd>
          <dt className="text-[#A8A5A0]">Dimensions</dt>
          <dd>{settings.embedding.dimensions}</dd>
        </dl>
        <p className="mt-4 text-xs text-[#A8A5A0]">
          Embedding configuration is managed in .env. Changing it may require reindexing existing
          sources.
        </p>
      </section>
      <div className="mt-6 text-xs leading-relaxed text-[#A8A5A0]">
        Your journeys, notes and progress live in the local database. Azure, OpenAI and OpenRouter
        send requests to their selected services. Ollama uses your configured local model endpoint.
      </div>
    </div>
  )
}
