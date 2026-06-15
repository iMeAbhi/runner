import { useState } from 'react';
import { useApp, ACCENTS } from '../../context/AppContext.jsx';
import { parseHolidayText } from '../../data/holidays.js';

const THEMES = [
  { id: 'amoled', label: 'AMOLED Dark', hint: 'Pure black + neon glow' },
  { id: 'light', label: 'Clean Light', hint: 'Milk glass on pastel' },
  { id: 'mood', label: 'Material Mood', hint: 'Accent-led palette' },
  { id: 'sky', label: 'Contextual Sky', hint: 'Follows your clock' },
];

export default function Settings() {
  const { settings, updateSettings, refreshFromSheet, verifyConnection, exportBackup, notify } = useApp();
  const [holidayDraft, setHolidayDraft] = useState(settings.holidayText);
  const parsedCount = parseHolidayText(holidayDraft).length;

  const setLeave = (cat, field) => (e) => {
    const val = Math.max(0, Number(e.target.value) || 0);
    updateSettings(
      field === 'total'
        ? { leaves: { ...settings.leaves, [cat]: val } }
        : { leavesUsed: { ...settings.leavesUsed, [cat]: val } }
    );
  };

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="text-3xl font-black">Settings</h1>
        <p className="text-sm text-ink-dim">Everything is stored locally on this device.</p>
      </header>

      {/* Backend config */}
      <Section title="Backend">
        <Labeled label="Apps Script URL">
          <input
            value={settings.appsScriptUrl}
            onChange={(e) => updateSettings({ appsScriptUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/…/exec"
            className="glass w-full rounded-3xl px-3 py-2.5 text-sm text-ink outline-none"
          />
        </Labeled>
        <Labeled label="API access key (shared secret)">
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => updateSettings({ apiKey: e.target.value })}
            placeholder="paste the key from your sheet"
            className="glass w-full rounded-3xl px-3 py-2.5 text-sm text-ink outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] leading-tight text-ink-dim">
              Locks your backend so only this app can read/write your trips. Generate it in your sheet
              (<strong>Travel App</strong> menu → Generate API key), paste it here, then Verify.
            </span>
            <button
              type="button"
              onClick={verifyConnection}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-ink"
              style={{ background: 'rgb(var(--accent) / 0.3)' }}
            >
              Verify
            </button>
          </div>
        </Labeled>
        <Labeled label="Master Drive folder (for trip photos)">
          <input
            value={settings.driveFolderUrl}
            onChange={(e) => updateSettings({ driveFolderUrl: e.target.value })}
            placeholder="https://drive.google.com/drive/folders/…"
            className="glass w-full rounded-3xl px-3 py-2.5 text-sm text-ink outline-none"
          />
          <span className="text-[10px] text-ink-dim">
            Paste a folder you own. Each trip's photos go into a "City_YYYY-MM" sub-folder created inside it automatically.
          </span>
        </Labeled>
        <button onClick={refreshFromSheet} className="w-full rounded-3xl py-2.5 text-sm font-bold text-ink" style={{ background: 'rgb(var(--accent) / 0.3)' }}>
          Test & sync now
        </button>
      </Section>

      {/* Personal anchors — power the home / New Year / birthday insights */}
      <Section title="You & your places">
        <Labeled label="Home town (where 'going home' means)">
          <input
            value={settings.homeLocation}
            onChange={(e) => updateSettings({ homeLocation: e.target.value })}
            placeholder="e.g. Kolkata"
            className="glass w-full rounded-3xl px-3 py-2.5 text-sm text-ink outline-none"
          />
        </Labeled>
        <Labeled label="Current location (where you live now)">
          <input
            value={settings.currentLocation}
            onChange={(e) => updateSettings({ currentLocation: e.target.value })}
            placeholder="e.g. Hyderabad"
            className="glass w-full rounded-3xl px-3 py-2.5 text-sm text-ink outline-none"
          />
        </Labeled>
        <Labeled label="Birthday (for countdowns & 'birthdays away' insights)">
          <input
            type="date"
            value={settings.birthday}
            onChange={(e) => updateSettings({ birthday: e.target.value })}
            className="glass w-full rounded-3xl px-3 py-2.5 text-sm text-ink outline-none"
          />
          <span className="text-[10px] text-ink-dim">Only the month &amp; day are used — the year is ignored.</span>
        </Labeled>
      </Section>

      {/* Theme */}
      <Section title="Appearance">
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSettings({ theme: t.id })}
              className="glass rounded-3xl p-3 text-left"
              style={settings.theme === t.id ? { boxShadow: '0 0 0 2px rgb(var(--accent)), 0 0 20px -4px rgb(var(--accent))' } : undefined}
            >
              <p className="text-sm font-bold text-ink">{t.label}</p>
              <p className="text-[11px] text-ink-dim">{t.hint}</p>
            </button>
          ))}
        </div>
        {settings.theme === 'mood' && (
          <Labeled label="Travel accent">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACCENTS).map(([id, a]) => (
                <button
                  key={id}
                  onClick={() => updateSettings({ accent: id })}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: `rgb(${a.accent} / 0.22)`,
                    color: 'rgb(var(--ink))',
                    boxShadow: settings.accent === id ? `0 0 0 2px rgb(${a.accent})` : 'none',
                  }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${a.accent})` }} />
                  {a.name}
                </button>
              ))}
            </div>
          </Labeled>
        )}
      </Section>

      {/* Leave balances */}
      <Section title="Leave allocation">
        <div className="space-y-2">
          {Object.keys(settings.leaves).map((cat) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="w-20 text-sm font-semibold text-ink">{cat}</span>
              <NumInput label="total" value={settings.leaves[cat]} onChange={setLeave(cat, 'total')} />
              <NumInput label="used" value={settings.leavesUsed?.[cat] || 0} onChange={setLeave(cat, 'used')} />
            </div>
          ))}
        </div>
      </Section>

      {/* Custom holidays */}
      <Section title="Corporate holiday list">
        <p className="text-xs text-ink-dim">
          Paste one holiday per line (e.g. <code>2026-08-15, Independence Day</code>). When present, this
          fully overrides the default public-holiday calendar.
        </p>
        <textarea
          value={holidayDraft}
          onChange={(e) => setHolidayDraft(e.target.value)}
          rows={6}
          placeholder={'2026-08-15, Independence Day\n2026-10-20, Dussehra'}
          className="glass w-full rounded-3xl p-3 text-sm text-ink outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-dim">{parsedCount} holiday{parsedCount === 1 ? '' : 's'} detected</span>
          <button
            onClick={() => {
              updateSettings({ holidayText: holidayDraft });
              notify(parsedCount ? 'Custom holidays active' : 'Reverted to default calendar', 'ok');
            }}
            className="rounded-full px-4 py-2 text-sm font-bold text-ink"
            style={{ background: 'rgb(var(--accent) / 0.3)' }}
          >
            Save list
          </button>
        </div>
      </Section>

      {/* Data control */}
      <Section title="Data">
        <button onClick={exportBackup} className="w-full rounded-3xl py-2.5 text-sm font-bold text-ink glass">
          Export backup (JSON)
        </button>
      </Section>

      <p className="pt-2 text-center text-[11px] text-ink-dim">Travel Log & Leave Optimizer · offline-first PWA</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="glass rounded-4xl p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-dim">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-dim">
      {label}
      {children}
    </label>
  );
}

function NumInput({ label, value, onChange }) {
  return (
    <label className="flex flex-1 items-center gap-2 text-[11px] text-ink-dim">
      {label}
      <input type="number" min="0" value={value} onChange={onChange} className="glass w-full rounded-2xl px-2 py-1.5 text-sm text-ink outline-none" />
    </label>
  );
}
