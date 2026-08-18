import { useState, type ReactNode } from 'react'
import {
  LayoutDashboard,
  Timer,
  Users,
  FolderKanban,
  BarChart3,
  FileText,
  Monitor,
  Sun,
  Moon,
  Settings
} from 'lucide-react'
import { useApp, type ViewKey } from '@/store/app'
import { Modal } from '@/components/ui'
import { IssuerSettings } from '@/views/Invoices'

const NAV: { key: ViewKey; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22} /> },
  { key: 'tracker', label: 'Time Tracker', icon: <Timer size={22} /> },
  { key: 'clients', label: 'Clients', icon: <Users size={22} /> },
  { key: 'projects', label: 'Projects', icon: <FolderKanban size={22} /> },
  { key: 'summary', label: 'Summary', icon: <BarChart3 size={22} /> },
  { key: 'invoices', label: 'Invoices', icon: <FileText size={22} /> }
]

function ThemeToggle({ compact = false }: { compact?: boolean }): ReactNode {
  const { settings, setTheme } = useApp()
  const theme = settings?.theme ?? 'system'
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return (
    <button
      title="Toggle theme"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
      className={`inline-flex items-center gap-2 rounded-xl text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${
        compact ? 'h-11 w-11 justify-center' : 'h-11 px-3'
      }`}
    >
      <Icon size={20} />
      {!compact && (
        <span className="text-[13px] font-medium capitalize">{theme}</span>
      )}
    </button>
  )
}

function NavButton({ item, active, onClick }: { item: (typeof NAV)[number]; active: boolean; onClick: () => void }): ReactNode {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-start gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition select-none ${
        active
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {item.icon}
      <span className="hidden lg:inline">{item.label}</span>
    </button>
  )
}

export function Layout({ children }: { children: ReactNode }): ReactNode {
  const { view, setView } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex h-full w-full flex-col bg-slate-100 dark:bg-slate-950 lg:flex-row">
      <aside className="hidden shrink-0 flex-col border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:flex lg:w-60">
        <div className="mb-6 flex items-center gap-2.5 px-3 pt-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Timer size={22} />
          </div>
          <div>
            <p className="text-[17px] font-bold leading-tight text-slate-900 dark:text-white">TimeTracker</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Work, tracked</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavButton key={item.key} item={item} active={view === item.key} onClick={() => setView(item.key)} />
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-slate-200 px-2 pt-3 dark:border-slate-800">
          <ThemeToggle />
          <button
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Settings size={20} />
          </button>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-t-lg text-[10px] font-semibold transition ${
              view === item.key ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <Modal open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <IssuerSettings onClose={() => setSettingsOpen(false)} />
      </Modal>
    </div>
  )
}