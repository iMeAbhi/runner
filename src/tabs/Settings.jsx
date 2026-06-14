import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { THEMES, MOOD_ACCENTS } from '../lib/theme.js';
import GlassCard from '../components/GlassCard.jsx';

/** Tab D — minimalist settings: secure config, holidays, leaves, themes, data. */
export default function Settings() {
  const { settings, updateSettings, updateNested, customHolidays, usingCustomHolidays, exportBackup, exportCsv, sync } = useApp();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.ping(settings);
      setTestResult({ ok: true, msg: res.message || 'Connected ✓' });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <header>
        <p className="text-sm text-ink-soft">Configure your vault</p>
        <h1 className="font-display text-3xl font-bold text-ink">Settings</h1>
      </header>

      {/* Backend connection — just the deployed Apps Script URL */}
      <Section title="Backend Connection" subtitle="Paste your deployed Apps Script URL. Stored only in this browser.">
        <Field label="Apps Script URL">
          <input
            value={settings.APPS_SCRIPT_URL}
            onChange={(e) => updateSettings({ APPS_SCRIPT_URL: e.target.value.trim() })}
            placeholder="https://script.google.com/macros/s/.../exec"
            className={inputCls}
          />
        </Field>
        <Field label="Home Location">
          <input
            value={settings.HOME_LOCATION}
            onChange={(e) => updateSettings({ HOME_LOCATION: e.target.value })}
            placeholder="Hyderabad"
            className={inputCls}
          />
        </Field>

        <div className="flex items-center gap-3">
          <button onClick={test} disabled={testing} className="rounded-3xl bg-accent/90 px-4 py-2 text-sm font-semibold text-black shadow-glow active:scale-95 disabled:opacity-40">
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <SyncBadge sync={sync} />
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.ok ? 'text-accent-2' : 'text-red-300'}`}>{testResult.msg}</p>
        )}
      </Section>

      {/* Leave allocation */}
      <Section title="Annual Leave Allocation" subtitle="Base limits and used counts per category.">
        {Object.keys(settings.ANNUAL_LEAVES).map((k) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-24 text-sm capitalize text-ink">{k}</span>
            <label className="flex-1 text-[10px] text-ink-soft">
              Total
              <input
                type="number"
                min="0"
                value={settings.ANNUAL_LEAVES[k]}
                onChange={(e) => updateNested('ANNUAL_LEAVES', { [k]: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
            <label className="flex-1 text-[10px] text-ink-soft">
              Used
              <input
                type="number"
                min="0"
                value={settings.leavesUsed[k] || 0}
                onChange={(e) => updateNested('leavesUsed', { [k]: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
          </div>
        ))}
      </Section>

      {/* Custom holiday calendar */}
      <Section
        title="Company Holiday Calendar"
        subtitle={
          usingCustomHolidays
            ? `Custom list active — ${customHolidays.length} holidays override the default calendar.`
            : 'Paste your corporate list to override the built-in default calendar.'
        }
      >
        <textarea
          value={settings.customHolidaysText}
          onChange={(e) => updateSettings({ customHolidaysText: e.target.value })}
          rows={6}
          placeholder={'2026-01-26, Republic Day\n2026-08-15, Independence Day\n26/10/2026 - Diwali'}
          className={`${inputCls} font-mono text-xs`}
        />
        {usingCustomHolidays && (
          <button onClick={() => updateSettings({ customHolidaysText: '' })} className="text-xs text-ink-soft underline">
            Clear & restore default calendar
          </button>
        )}
      </Section>

      {/* Themes */}
      <Section title="Appearance" subtitle="Liquid Material theme profiles.">
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSettings({ theme: t.id })}
              className={`rounded-4xl p-4 text-left transition ${
                settings.theme === t.id ? 'bg-accent/20 ring-2 ring-accent shadow-glow' : 'glass'
              }`}
            >
              <p className="font-display font-bold text-ink">{t.label}</p>
              <p className="text-[11px] text-ink-soft">{t.hint}</p>
            </button>
          ))}
        </div>

        {settings.theme === 'mood' && (
          <div className="mt-2">
            <p className="mb-2 text-xs font-medium text-ink-soft">Mood accent</p>
            <div className="flex flex-wrap gap-2">
              {MOOD_ACCENTS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => updateSettings({ moodAccent: m.id })}
                  className={`flex items-center gap-2 rounded-3xl px-3 py-2 text-xs transition ${
                    settings.moodAccent === m.id ? 'ring-2 ring-white/40' : 'glass'
                  }`}
                  style={{ background: `rgb(${m.accent} / 0.18)` }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${m.accent})` }} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Data control */}
      <Section title="Data & Backup" subtitle="Export your local datasets anytime.">
        <div className="flex gap-3">
          <button onClick={exportBackup} className="glass flex-1 rounded-3xl py-3 text-sm font-semibold text-ink active:scale-95">
            Export JSON
          </button>
          <button onClick={exportCsv} className="glass flex-1 rounded-3xl py-3 text-sm font-semibold text-ink active:scale-95">
            Export CSV
          </button>
        </div>
        <p className="text-[11px] text-ink-soft">
          {sync.lastSync ? `Last synced ${new Date(sync.lastSync).toLocaleString()}` : 'Not synced yet'}
        </p>
      </Section>

      <p className="pt-2 text-center text-[11px] text-ink-soft/60">Voyage · offline-first · v1.0</p>
    </div>
  );
}

const inputCls =
  'mt-1 w-full min-w-0 rounded-3xl bg-white/10 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-accent';

function Section({ title, subtitle, children }) {
  return (
    <GlassCard className="space-y-3 p-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
      </div>
      {children}
    </GlassCard>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function SyncBadge({ sync }) {
  const map = {
    ok: { c: 'text-accent-2', t: 'Synced' },
    syncing: { c: 'text-accent', t: 'Syncing…' },
    offline: { c: 'text-ink-soft', t: 'Offline' },
    error: { c: 'text-red-300', t: 'Sync error' },
    idle: { c: 'text-ink-soft', t: 'Not configured' },
  };
  const s = map[sync.status] || map.idle;
  return <span className={`text-xs font-medium ${s.c}`}>● {s.t}</span>;
}
