'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { collection, doc, onSnapshot, orderBy, query as firestoreQuery, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Drawer, FormControl, IconButton, InputLabel, MenuItem, Select, TextField as MuiTextField, Typography as MuiTypography, ThemeProvider, createTheme } from '@mui/material'
import type { TypographyProps as MuiTypographyProps } from '@mui/material/Typography'
import type { TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import MuiStack, { type StackProps as MuiStackProps } from '@mui/material/Stack'
import { Add, Bolt, CloudUpload, Download, GridView, Help, Menu, NotificationsNone, People, Search, SettingsOutlined, CleaningServices } from '@mui/icons-material'
import { getFirebaseServices } from '../../lib/firebase'

type Status = 'New' | 'Contacted' | 'Converted' | 'Lost'
type Lead = { name: string; phone: string; product: string; dealer: string; dealerId?: string; source: string; status: Status; pincode: string; time: string; initials: string }
type Dealer = { id: string; name: string; pincodePrefixes: string[]; city?: string; contactEmail?: string }
type CsvDataset = { headers: string[]; rows: string[][] }

const statusStyles: Record<Status, { bg: string; color: string }> = { New: { bg: '#e7f3ff', color: '#1565c0' }, Contacted: { bg: '#fff4df', color: '#a45a00' }, Converted: { bg: '#e7f7ee', color: '#18794e' }, Lost: { bg: '#f3f4f6', color: '#68707c' } }
const nav = [
  { label: 'Overview', href: '/dashboard', section: 'Overview' },
  { label: 'Leads', href: '/dashboard/leads', section: 'Leads' },
  { label: 'Dealers', href: '/dashboard/dealers', section: 'Dealers' },
  { label: 'Reports', href: '/dashboard/reports', section: 'Reports' },
  { label: 'CSV Cleaner', href: '/dashboard/csv-cleaner', section: 'CSV Cleaner' },
]
const settingsRoute = { href: '/dashboard/settings', section: 'Settings' }
const products = ['PuREPower Home 3kWh', 'PuREPower Home 5kWh', 'PuREPower Commercial 10kWh']
const sources = ['Website', 'Voice Agent', 'WhatsApp', 'Dealer Walk-in']
const fallbackDealers: Dealer[] = [
  { id: 'D01', name: 'Sri Sai Power Solutions', pincodePrefixes: ['500'], city: 'Hyderabad', contactEmail: 'd01@example.com' },
  { id: 'D02', name: 'Kandi Energy Point', pincodePrefixes: ['502'], city: 'Sangareddy', contactEmail: 'd02@example.com' },
  { id: 'D03', name: 'Warangal Green Systems', pincodePrefixes: ['506'], city: 'Warangal', contactEmail: 'd03@example.com' },
  { id: 'D04', name: 'Karimnagar Solar Hub', pincodePrefixes: ['505'], city: 'Karimnagar', contactEmail: 'd04@example.com' },
  { id: 'D05', name: 'Vizag Home Power', pincodePrefixes: ['530', '531'], city: 'Visakhapatnam', contactEmail: 'd05@example.com' },
  { id: 'D06', name: 'Krishna Energy Store', pincodePrefixes: ['520', '521'], city: 'Vijayawada', contactEmail: 'd06@example.com' },
  { id: 'D07', name: 'Guntur Battery World', pincodePrefixes: ['522'], city: 'Guntur', contactEmail: 'd07@example.com' },
  { id: 'D08', name: 'Tirupati PowerHouse', pincodePrefixes: ['517'], city: 'Tirupati', contactEmail: 'd08@example.com' },
]

const theme = createTheme({
  palette: { primary: { main: '#0e6b7a', contrastText: '#ffffff' }, secondary: { main: '#b9e34a', contrastText: '#092f3c' }, background: { default: '#f7f9fc', paper: '#ffffff' }, text: { primary: '#182230', secondary: '#53606d' }, divider: '#e7eaf0' },
  shape: { borderRadius: 10 },
  typography: { fontFamily: 'Inter, Arial, Helvetica, sans-serif', button: { fontWeight: 700, textTransform: 'none' } },
  components: { MuiButton: { defaultProps: { size: 'medium' }, styleOverrides: { root: { minHeight: 40, borderRadius: 10, paddingInline: 16, boxShadow: 'none' }, contained: { boxShadow: 'none' } } }, MuiTextField: { defaultProps: { size: 'small' } }, MuiSelect: { defaultProps: { size: 'small' } }, MuiCard: { styleOverrides: { root: { borderColor: 'divider' } } } }
})

function StatusChip({ status }: { status: Status }) { return <Chip label={status} size="small" sx={{ bgcolor: statusStyles[status].bg, color: statusStyles[status].color, fontWeight: 700 }} /> }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <Card elevation={0} sx={{ flex: 1, minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}><CardContent><Typography color="text.secondary" variant="body2" fontWeight={600}>{label}</Typography><Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>{value}</Typography><Typography variant="caption" color="text.secondary">{detail}</Typography></CardContent></Card> }
type StackProps = MuiStackProps & Pick<CSSProperties, 'alignItems' | 'justifyContent' | 'gap'>
type TypographyProps = MuiTypographyProps & Pick<CSSProperties, 'fontWeight' | 'textAlign'>
type TextFieldProps = MuiTextFieldProps & {
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  InputProps?: { startAdornment?: React.ReactNode }
}

function Typography({ fontWeight, textAlign, sx, ...props }: TypographyProps) {
  const typographySx = Array.isArray(sx) ? sx : sx ? [sx] : []
  return <MuiTypography {...props} sx={[...typographySx, { fontWeight, textAlign }]} />
}

function TextField({ inputProps, InputProps, slotProps, ...props }: TextFieldProps) {
  return (
    <MuiTextField
      {...props}
      slotProps={{
        ...slotProps,
        ...(inputProps ? { htmlInput: inputProps } : {}),
        ...(InputProps ? { input: InputProps } : {}),
      }}
    />
  )
}

function Stack({ alignItems, justifyContent, gap, sx, ...props }: StackProps) {
  const stackSx = Array.isArray(sx) ? sx : sx ? [sx] : []
  const layoutSx = { alignItems, justifyContent, gap }
  return <MuiStack {...props} sx={[...stackSx, layoutSx]} />
}

function SidebarContent({ section, user, mobile = false, onNavigate }: { section: string; user: User; mobile?: boolean; onNavigate?: () => void }) {
  return <Box component="aside" sx={{ width: 248, boxSizing: 'border-box', height: mobile ? '100%' : '100vh', position: mobile ? 'relative' : 'fixed', top: 0, left: 0, zIndex: 1200, bgcolor: '#092f3c', color: 'white', py: 2, pl: 3, pr: 2, display: { xs: mobile ? 'flex' : 'none', md: mobile ? 'none' : 'flex' }, flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', flexShrink: 0, '& .MuiButton-root': { width: '100%', boxSizing: 'border-box' } }}>
    <Stack direction="row" gap={1.2} alignItems="center" sx={{ px: 1, py: 1.5, mb: 3 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: '#b9e34a', color: '#092f3c', display: 'grid', placeItems: 'center' }}><Bolt /></Box>
      <Box><Typography fontWeight={800}>Pure Energy</Typography><Typography variant="caption" sx={{ color: '#90afb6' }}>MIS Assistant</Typography></Box>
    </Stack>
    <Typography variant="overline" sx={{ color: '#6f979f', px: 1.5 }}>Workspace</Typography>
    <Stack gap={.5} sx={{ mt: 1 }}>
      {nav.map((item) => <Button key={item.href} component={Link} href={item.href} onClick={onNavigate} startIcon={item.section === 'CSV Cleaner' ? <CleaningServices /> : item.section === 'Overview' ? <GridView /> : <People />} sx={{ justifyContent: 'flex-start', px: 1.5, py: 1.2, color: section === item.section ? '#092f3c' : '#c1d4d7', bgcolor: section === item.section ? '#b9e34a' : 'transparent', '&:hover': { bgcolor: section === item.section ? '#b9e34a' : '#164653' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>{item.label}</Button>)}
    </Stack>
    <Box sx={{ mt: 'auto' }}>
      <Button component={Link} href={settingsRoute.href} onClick={onNavigate} startIcon={<SettingsOutlined />} sx={{ color: section === settingsRoute.section ? '#b9e34a' : '#c1d4d7', textTransform: 'none' }}>Settings</Button>
      <Stack direction="row" gap={1.2} alignItems="center" sx={{ mt: 2, px: 1 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#e4eef0', color: '#1a5a68', fontSize: 13 }}>{user.displayName?.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}</Avatar>
        <Box><Typography variant="body2" fontWeight={700}>{user.displayName || user.email || 'Signed in'}</Typography><Typography variant="caption" sx={{ color: '#90afb6' }}>Admin</Typography></Box>
      </Stack>
    </Box>
  </Box>
}

function getDealer(pincode: string, dealerList: Dealer[]) {
  return dealerList.find((dealer) => dealer.pincodePrefixes.includes(pincode.slice(0, 3))) ?? { id: 'INHOUSE', name: 'In-house Sales' }
}

function formatLeadTime(value: unknown) {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return 'Recently'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(value.toDate())
}

function parseCsv(text: string): CsvDataset {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        inQuotes = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      inQuotes = true
    } else if (character === ',') {
      record.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
      if (character === '\r' && text[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }
  if (inQuotes) throw new Error('CSV contains an unterminated quoted field.')
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  if (!records.length) return { headers: [], rows: [] }

  const isBlank = (values: string[]) => values.every((value) => !value.trim())
  const firstRecordIndex = records.findIndex((values) => !isBlank(values))
  if (firstRecordIndex < 0) return { headers: [], rows: records }

  const firstRecord = records[firstRecordIndex]
  firstRecord[0] = firstRecord[0].replace(/^\uFEFF/, '')
  const followingRecords = records.slice(firstRecordIndex + 1).filter((values) => !isBlank(values)).slice(0, 8)
  const isDataLike = (value: string) => {
    const trimmed = value.trim()
    return /^[-+]?\d+(?:[.,]\d+)?$/.test(trimmed) ||
      /^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed) ||
      /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed) ||
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)
  }
  const populated = firstRecord.filter((value) => value.trim())
  const dataLikeCount = populated.filter(isDataLike).length
  const matchingDataColumns = firstRecord.reduce((count, value, column) => {
    if (!followingRecords.length || !value.trim()) return count
    const values = followingRecords.map((values) => values[column] ?? '').filter((item) => item.trim())
    if (!values.length) return count
    const matching = values.filter((item) => isDataLike(item) === isDataLike(value)).length
    return count + (matching / values.length >= 0.75 ? 1 : 0)
  }, 0)
  // Headerless input is inferred when a first-row value looks like data and its column types repeat below.
  const hasHeader = !(dataLikeCount >= 1 && matchingDataColumns / Math.max(populated.length, 1) >= 0.75)
  const width = records.reduce((maximum, values) => Math.max(maximum, values.length), 0)
  const headers = Array.from({ length: width }, (_, column) => {
    const header = hasHeader ? firstRecord[column] ?? '' : ''
    return header.trim() ? header : `Column ${column + 1}`
  })
  const dataRows = hasHeader
    ? [...records.slice(0, firstRecordIndex), ...records.slice(firstRecordIndex + 1)]
    : records
  return { headers, rows: dataRows.map((values) => Array.from({ length: width }, (_, column) => values[column] ?? '')) }
}
function csvValue(value: string) { return `"${value.replaceAll('"', '""')}"` }

export default function Page() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [firebaseError, setFirebaseError] = useState('')
  const [operationError, setOperationError] = useState('')
  const [dealerNotice, setDealerNotice] = useState('')
  const [section, setSection] = useState('Overview')
  const [leads, setLeads] = useState<Lead[]>([])
  const [dealerList, setDealerList] = useState<Dealer[]>(fallbackDealers)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All statuses')
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvName, setCsvName] = useState('')
  const [csvNotice, setCsvNotice] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const route = [...nav, settingsRoute].find((item) => item.href === pathname)
    if (route) {
      setSection(route.section)
    } else if (pathname !== '/dashboard') {
      router.replace('/dashboard')
    } else {
      setSection('Overview')
    }
  }, [pathname, router])

  useEffect(() => {
    const services = getFirebaseServices()
    if (!services) {
      setFirebaseError('Firebase is not configured. Add the Web app settings to .env.local.')
      setAuthLoading(false)
      return
    }
    return onAuthStateChanged(
      services.auth,
      (currentUser) => {
        setUser(currentUser)
        setAuthLoading(false)
        if (!currentUser) router.replace('/login')
      },
      (error) => {
        console.error('Firebase Authentication state failed:', error)
        setFirebaseError('Could not verify your sign-in. Check Firebase Authentication configuration.')
        setAuthLoading(false)
      },
    )
  }, [router])

  useEffect(() => {
    if (!user) return
    const services = getFirebaseServices()
    if (!services) return
    const unsubscribeDealers = onSnapshot(
      collection(services.db, 'dealers'),
      (snapshot) => {
        const loadedDealers: Dealer[] = []
        for (const dealerDoc of snapshot.docs) {
          const data = dealerDoc.data()
          if (
            typeof data.name !== 'string' ||
            !data.name.trim() ||
            typeof data.pincode_prefixes !== 'string' ||
            !/^[0-9]{3}(?:\|[0-9]{3})*$/.test(data.pincode_prefixes)
          ) {
            console.error('Invalid Firestore dealer document:', dealerDoc.id)
            setDealerList(fallbackDealers)
            setDealerNotice('Dealer data in Firestore is invalid. Using the built-in list until it is corrected.')
            return
          }
          loadedDealers.push({
            id: dealerDoc.id,
            name: data.name.trim(),
            pincodePrefixes: data.pincode_prefixes.split('|'),
            ...(typeof data.city === 'string' && data.city.trim() ? { city: data.city.trim() } : {}),
            ...(typeof data.contact_email === 'string' && data.contact_email.trim() ? { contactEmail: data.contact_email.trim() } : {}),
          })
        }
        if (!loadedDealers.length) {
          setDealerList(fallbackDealers)
          setDealerNotice('No dealers are saved in Firestore yet. Using the built-in list until dealers.csv is loaded.')
          return
        }
        setDealerList(loadedDealers)
        setDealerNotice('')
      },
      (error) => {
        console.error('Firestore dealer listener failed:', error)
        setDealerList(fallbackDealers)
        setDealerNotice('Could not load dealers from Firestore. Using the built-in list; verify dealer routing data.')
      },
    )
    const unsubscribeLeads = onSnapshot(
      firestoreQuery(collection(services.db, 'leads'), orderBy('created_on', 'desc')),
      (snapshot) => {
        setLeads(snapshot.docs.map((leadDoc) => {
          const data = leadDoc.data()
          const name = String(data.name ?? '')
          const status = ['New', 'Contacted', 'Converted', 'Lost'].includes(data.status) ? data.status as Status : 'New'
          return {
            name,
            phone: String(data.phone ?? leadDoc.id),
            product: String(data.product ?? ''),
            dealer: String(data.dealer_name ?? ''),
            dealerId: typeof data.dealer_id === 'string' ? data.dealer_id : undefined,
            source: String(data.source ?? ''),
            status,
            pincode: String(data.pincode ?? ''),
            time: formatLeadTime(data.created_on),
            initials: name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase(),
          }
        }))
      },
      (error) => {
        console.error('Firestore leads listener failed:', error)
        setFirebaseError('Could not load leads. Check Firestore setup and access rules.')
      },
    )
    return () => {
      unsubscribeDealers()
      unsubscribeLeads()
    }
  }, [user])

  const visible = useMemo(() => leads.filter((lead) => `${lead.name} ${lead.phone} ${lead.product} ${lead.dealer}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All statuses' || lead.status === filter)), [leads, query, filter])
  const cleaned = useMemo(() => {
    const seen = new Set<string>()
    return csvRows.filter((row) => {
      if (row.every((value) => !value.trim())) return false
      const key = JSON.stringify(row)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [csvRows])
  const blankCount = csvRows.filter((row) => row.every((value) => !value.trim())).length
  const duplicateCount = csvRows.length - cleaned.length - blankCount

  const handleCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    setCsvRows([])
    setCsvHeaders([])
    setCsvName('')
    setCsvNotice(`Loading ${file.name}…`)
    void file.text().then((text) => {
      const dataset = parseCsv(text)
      if (!dataset.headers.length) {
        setCsvNotice('No CSV records found. Please upload a file with at least one non-empty row.')
        return
      }
      setCsvName(file.name)
      setCsvHeaders(dataset.headers)
      setCsvRows(dataset.rows)
      setCsvNotice(`Loaded ${dataset.rows.length} rows. Blank rows and exact duplicates will be removed from the cleaned export.`)
    }).catch((error: unknown) => {
      console.error('CSV upload failed:', error)
      setCsvNotice(error instanceof Error ? `Could not read CSV: ${error.message}` : 'Could not read the selected CSV file.')
    })
  }
  const downloadCsv = () => {
    if (!csvHeaders.length || !cleaned.length) return
    const body = [csvHeaders.map(csvValue).join(','), ...cleaned.map((row) => csvHeaders.map((_, column) => csvValue(row[column] ?? '')).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `cleaned-${csvName || 'leads.csv'}`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function createLead(lead: Lead) {
    setOperationError('')
    const services = getFirebaseServices()
    if (!services) throw new Error('Firebase is not configured.')
    const phone = lead.phone.replace(/[\s-]/g, '').replace(/^\+91/, '')
    if (!/^[0-9]{10}$/.test(phone) || !/^[0-9]{6}$/.test(lead.pincode)) {
      throw new Error('Enter a valid 10-digit mobile number and 6-digit pincode.')
    }
    const dealer = getDealer(lead.pincode, dealerList)
    const leadRef = doc(services.db, 'leads', phone)
    await runTransaction(services.db, async (transaction) => {
      const existing = await transaction.get(leadRef)
      if (existing.exists()) throw new Error('A lead with this mobile number already exists.')
      transaction.set(leadRef, {
        lead_id: phone,
        name: lead.name.trim(),
        phone,
        pincode: lead.pincode,
        product: lead.product,
        source: lead.source,
        status: 'New',
        dealer_id: dealer.id,
        dealer_name: dealer.name,
        created_on: serverTimestamp(),
      })
    })
    router.push('/dashboard/leads')
  }

  async function handleSignOut() {
    const services = getFirebaseServices()
    if (!services) return
    try {
      await signOut(services.auth)
      router.replace('/login')
    } catch (error) {
      console.error('Firebase sign-out failed:', error)
      setOperationError('Could not sign out. Please try again.')
    }
  }

  async function updateLeadStatus(phone: string, status: Status) {
    const services = getFirebaseServices()
    if (!services) return
    setOperationError('')
    try {
      await updateDoc(doc(services.db, 'leads', phone), { status })
    } catch (error) {
      console.error('Firestore lead status update failed:', error)
      setOperationError('Could not update the lead status. Check Firestore access rules and try again.')
    }
  }

  if (authLoading) {
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f7f9fc' }}><Typography color="text.secondary">Checking your sign-in…</Typography></Box>
  }
  if (!user) {
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: '#f7f9fc' }}>
      <Alert severity="error">{firebaseError || 'Redirecting to sign in…'}</Alert>
    </Box>
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', overflowX: 'hidden' }}>
        <SidebarContent section={section} user={user} />
        <Drawer anchor="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} sx={{ display: { md: 'none' } }}>
          <SidebarContent section={section} user={user} mobile onNavigate={() => setMobileNavOpen(false)} />
        </Drawer>
        <Box component="main" sx={{ flex: 1, minWidth: 0, ml: { md: '248px' }, overflowX: 'hidden' }}>
          <Box component="header" sx={{ minHeight: 72, px: { xs: 2, md: 4 }, bgcolor: 'white', borderBottom: '1px solid #e7eaf0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Stack direction="row" gap={1.5} alignItems="center" sx={{ minWidth: 0 }}>
              <IconButton aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} sx={{ display: { md: 'none' } }}><Menu /></IconButton>
              <Box sx={{ minWidth: 0 }}><Typography variant="h6" fontWeight={800}>{section}</Typography><Typography variant="caption" color="text.secondary">{user.email || 'Signed in'}</Typography></Box>
            </Stack>
            <Stack direction="row" gap={1} alignItems="center">
              <IconButton aria-label="Notifications"><NotificationsNone /></IconButton>
              <Button size="medium" variant="outlined" startIcon={<Help />} sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', borderColor: '#d9e0e6', color: '#53606d' }}>Help center</Button>
              <Button size="small" onClick={handleSignOut}>Sign out</Button>
            </Stack>
          </Box>
          <Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: 1500, boxSizing: 'border-box', mx: 'auto' }}>
            {firebaseError && <Alert severity="error" sx={{ mb: 2 }}>{firebaseError}</Alert>}
            {dealerNotice && <Alert severity="warning" sx={{ mb: 2 }}>{dealerNotice}</Alert>}
            {operationError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError('')}>{operationError}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
              <Box><Typography variant="h4" fontWeight={800}>Good morning{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Manage lead routing and prepare clean data imports.</Typography></Box>
              {section !== 'CSV Cleaner' && <Button variant="contained" startIcon={<Add />} onClick={() => setSection('New lead')} sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: '#095766' }, textTransform: 'none', borderRadius: 2, fontWeight: 700 }}>Add new lead</Button>}
            </Stack>
            {section === 'CSV Cleaner'
              ? <CsvCleaner rows={csvRows} cleaned={cleaned} headers={csvHeaders} fileName={csvName} notice={csvNotice} duplicateCount={duplicateCount} onUpload={handleCsv} onDownload={downloadCsv} />
              : section === 'Dealers'
                ? <DealerDirectory dealers={dealerList} leads={leads} />
              : section === 'New lead'
                ? <NewLead dealerList={dealerList} onCancel={() => setSection('Overview')} onCreate={createLead} />
                : <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 3 }}>
                    <Metric label="Total leads" value={String(leads.length)} detail="Across all sources" />
                    <Metric label="New today" value={String(leads.filter((lead) => lead.status === 'New').length)} detail="Needs follow-up" />
                    <Metric label="Conversion rate" value="24.8%" detail="Up 4.2% this month" />
                  </Stack>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                    <CardContent>
                      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between" sx={{ mb: 2 }}>
                        <Typography variant="h6" fontWeight={800}>Recent leads</Typography>
                        <Stack direction="row" gap={1}>
                          <TextField placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
                          <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Status</InputLabel><Select label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}><MenuItem value="All statuses">All statuses</MenuItem>{(['New', 'Contacted', 'Converted', 'Lost'] as Status[]).map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl>
                        </Stack>
                      </Stack>
                      <Divider />
                      {visible.map((lead) => <Stack key={lead.phone} direction="row" alignItems="center" gap={2} sx={{ py: 1.8, borderBottom: '1px solid #eef1f4' }}>
                        <Avatar sx={{ bgcolor: '#e4eef0', color: '#1a5a68' }}>{lead.initials}</Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700}>{lead.name}</Typography><Typography variant="body2" color="text.secondary">{lead.product}{lead.dealer ? ` · ${lead.dealer}` : ''}</Typography></Box>
                        <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 110 }}><Typography variant="body2">{lead.pincode}</Typography><Typography variant="caption" color="text.secondary">{lead.source} · {lead.time}</Typography></Box>
                        <Select size="small" value={lead.status} onChange={(event) => { const status = event.target.value; if (['New', 'Contacted', 'Converted', 'Lost'].includes(status)) void updateLeadStatus(lead.phone, status as Status) }} aria-label={`Status for ${lead.name}`} sx={{ minWidth: 120 }}>{(['New', 'Contacted', 'Converted', 'Lost'] as Status[]).map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select>
                      </Stack>)}
                    </CardContent>
                  </Card>
                </>}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

function DealerDirectory({ dealers, leads }: { dealers: Dealer[]; leads: Lead[] }) {
  return <Stack gap={2.5} sx={{ minWidth: 0 }}>
    <Box>
      <Typography variant="h5" fontWeight={800}>Dealer directory</Typography>
      <Typography color="text.secondary" sx={{ mt: .5 }}>Dealers and pincode prefixes used to route incoming leads.</Typography>
    </Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
      <Metric label="Active dealers" value={String(dealers.length)} detail="Loaded dealer records" />
      <Metric label="Assigned leads" value={String(leads.filter((lead) => lead.dealerId && dealers.some((dealer) => dealer.id === lead.dealerId)).length)} detail="Matched to a listed dealer" />
    </Stack>
    <Card elevation={0} sx={{ minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <CardContent sx={{ minWidth: 0 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 1.5, borderBottom: '1px solid #eef1f4', whiteSpace: 'nowrap' }, '& th': { color: 'text.secondary', fontSize: 12, fontWeight: 700 }, '& tbody tr:last-child td': { borderBottom: 0 } }}>
            <thead><tr><th>Dealer</th><th>City</th><th>Pincode prefixes</th><th>Contact email</th><th>Assigned leads</th></tr></thead>
            <tbody>{dealers.map((dealer) => {
              const assignedLeads = leads.filter((lead) => lead.dealerId === dealer.id || (!lead.dealerId && lead.dealer === dealer.name)).length
              return <tr key={dealer.id}>
                <td><Typography fontWeight={700}>{dealer.name}</Typography><Typography variant="caption" color="text.secondary">{dealer.id}</Typography></td>
                <td>{dealer.city || '—'}</td>
                <td>{dealer.pincodePrefixes.join(', ')}</td>
                <td>{dealer.contactEmail || '—'}</td>
                <td>{assignedLeads}</td>
              </tr>
            })}</tbody>
          </Box>
        </Box>
      </CardContent>
    </Card>
    {!dealers.length && <Alert severity="warning">No dealers are currently available for lead routing.</Alert>}
  </Stack>
}

function CsvCleaner({ rows, cleaned, headers, fileName, notice, duplicateCount, onUpload, onDownload }: { rows: string[][]; cleaned: string[][]; headers: string[]; fileName: string; notice: string; duplicateCount: number; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onDownload: () => void }) {
  return <Stack gap={2.5} sx={{ minWidth: 0 }}>
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} sx={{ alignItems: { sm: 'center' } }}>
          <Box><Typography variant="h5" fontWeight={800}>Clean a CSV file</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Remove blank rows and exact duplicates before importing leads.</Typography></Box>
          <Button component="label" variant="contained" startIcon={<CloudUpload />} sx={{ bgcolor: 'primary.main', textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'center' } }}>Upload CSV<input hidden type="file" accept=".csv,text/csv" onChange={onUpload} /></Button>
        </Stack>
        {notice && <Alert severity={notice.startsWith('Could not') ? 'error' : 'info'} sx={{ mt: 3 }}>{notice}</Alert>}
      </CardContent>
    </Card>
    {rows.length > 0 && <>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <Metric label="Rows loaded" value={String(rows.length)} detail={fileName} />
        <Metric label="Rows removed" value={String(rows.length - cleaned.length)} detail={`${duplicateCount} duplicate rows`} />
        <Metric label="Ready to export" value={String(cleaned.length)} detail="Cleaned rows" />
      </Stack>
      <Card elevation={0} sx={{ minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
            <Typography variant="h6" fontWeight={800}>Cleaned preview</Typography>
            <Button size="medium" variant="outlined" startIcon={<Download />} onClick={onDownload} disabled={!cleaned.length} sx={{ textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'center' } }}>Download cleaned CSV</Button>
          </Stack>
          <Box sx={{ maxHeight: { xs: 360, md: 480 }, overflow: 'auto', border: '1px solid #eef1f4', borderRadius: 1 }}>
            <Box component="table" sx={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, '& th, & td': { textAlign: 'left', p: 1.2, borderBottom: '1px solid #eef1f4', whiteSpace: 'nowrap' }, '& th': { position: 'sticky', top: 0, zIndex: 1, color: 'text.secondary', fontSize: 12, bgcolor: 'background.paper' }, '& tbody tr:last-child td': { borderBottom: 0 } }}>
              <thead><tr>{headers.map((header, column) => <th key={`${header}-${column}`}>{header}</th>)}</tr></thead>
              <tbody>{cleaned.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, column) => <td key={column}>{row[column] ?? ''}</td>)}</tr>)}</tbody>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </>}
  </Stack>
}

function NewLead({ dealerList, onCancel, onCreate }: { dealerList: Dealer[]; onCancel: () => void; onCreate: (lead: Lead) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', phone: '', pincode: '', product: '', source: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const phone = form.phone.replace(/[\s-]/g, '').replace(/^\+91/, '')
    if (!form.name.trim()) return setError('Enter the customer name.')
    if (!/^[0-9]{10}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.')
    if (!/^[0-9]{6}$/.test(form.pincode)) return setError('Enter a valid 6-digit pincode.')
    if (!form.product || !form.source) return setError('Choose a product and lead source.')

    const dealer = getDealer(form.pincode, dealerList)
    const initials = form.name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase()
    setSaving(true)
    try {
      await onCreate({
        ...form,
        phone,
        name: form.name.trim(),
        dealer: dealer.name,
        status: 'New',
        time: 'Just now',
        initials,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create the lead.')
    } finally {
      setSaving(false)
    }
  }

  return <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, maxWidth: 760 }}>
    <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="h5" fontWeight={800}>Capture a new lead</Typography>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={submit}>
        <Stack gap={2} sx={{ mt: 3 }}>
          <TextField label="Customer name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <TextField label="Mobile number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputProps={{ inputMode: 'tel' }} required />
          <TextField label="Pincode" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} inputProps={{ inputMode: 'numeric' }} required />
          <TextField select label="Product" value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} required>
            {products.map((product) => <MenuItem key={product} value={product}>{product}</MenuItem>)}
          </TextField>
          <TextField select label="Lead source" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required>
            {sources.map((source) => <MenuItem key={source} value={source}>{source}</MenuItem>)}
          </TextField>
          <Stack direction="row" justifyContent="flex-end" gap={1}>
            <Button onClick={onCancel} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" disabled={saving} variant="contained" sx={{ bgcolor: 'primary.main', textTransform: 'none' }}>
              {saving ? 'Saving…' : 'Create lead'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </CardContent>
  </Card>
}
