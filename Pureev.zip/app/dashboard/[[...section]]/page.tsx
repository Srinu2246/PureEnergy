import DashboardClient from '../dashboard-client'

export function generateStaticParams() {
  return [
    { section: [] },
    { section: ['leads'] },
    { section: ['dealers'] },
    { section: ['reports'] },
    { section: ['csv-cleaner'] },
    { section: ['settings'] },
  ]
}

export default function DashboardPage() {
  return <DashboardClient />
}
