import { useEffect, type ReactNode } from 'react'
import { Layout } from '@/components/Layout'
import { useData } from '@/store/data'
import { useApp } from '@/store/app'
import Dashboard from '@/views/Dashboard'
import TimeTracker from '@/views/TimeTracker'
import Clients from '@/views/Clients'
import Projects from '@/views/Projects'
import Summary from '@/views/Summary'
import Invoices from '@/views/Invoices'

function viewFor(key: string): ReactNode {
  switch (key) {
    case 'dashboard':
      return <Dashboard />
    case 'tracker':
      return <TimeTracker />
    case 'clients':
      return <Clients />
    case 'projects':
      return <Projects />
    case 'summary':
      return <Summary />
    case 'invoices':
      return <Invoices />
    default:
      return <Dashboard />
  }
}

export default function App(): ReactNode {
  const view = useApp((s) => s.view)
  const refreshAll = useData((s) => s.refreshAll)
  const loadSettings = useApp((s) => s.loadSettings)

  useEffect(() => {
    refreshAll()
    loadSettings()
  }, [refreshAll, loadSettings])

  return <Layout>{viewFor(view)}</Layout>
}