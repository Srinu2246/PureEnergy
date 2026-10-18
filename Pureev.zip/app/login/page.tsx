'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Bolt } from '@mui/icons-material'
import { getFirebaseServices } from '../../lib/firebase'

type AuthMode = 'signin' | 'signup'

function authErrorMessage(code: string) {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/unauthorized-domain': 'This website is not authorized for Firebase sign-in.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in provider is disabled. In Firebase Console, open Authentication → Sign-in method and enable Email/Password or Google.',
    'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection.',
  }
  return messages[code] || 'Sign-in failed. Check your details and Firebase Authentication settings.'
}

export function AuthPage({ initialMode = 'signin' }: { initialMode?: AuthMode }) {
  const router = useRouter()
  const mode = initialMode
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    const services = getFirebaseServices()
    setConfigured(Boolean(services))
    if (initialMode === 'signin' && new URLSearchParams(window.location.search).get('registered') === '1') {
      setNotice('Account created. Sign in with your new email and password.')
    }
    if (!services) return
    return onAuthStateChanged(services.auth, (user) => {
      if (user && initialMode === 'signin') router.replace('/dashboard')
    })
  }, [initialMode, router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    const services = getFirebaseServices()
    if (!services) {
      setError('Firebase is not configured. Add the Firebase Web app settings to .env.local.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(services.auth, email.trim(), password)
        await signOut(services.auth)
        router.replace('/login?registered=1')
      } else {
        await signInWithEmailAndPassword(services.auth, email.trim(), password)
        router.replace('/dashboard')
      }
    } catch (authError) {
      const code = authError instanceof Error && 'code' in authError ? String(authError.code) : ''
      setError(authErrorMessage(code))
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setError('')
    const services = getFirebaseServices()
    if (!services) {
      setError('Firebase is not configured. Add the Firebase Web app settings to .env.local.')
      return
    }

    setLoading(true)
    try {
      await signInWithPopup(services.auth, new GoogleAuthProvider())
      router.replace('/dashboard')
    } catch (authError) {
      const code = authError instanceof Error && 'code' in authError ? String(authError.code) : ''
      setError(authErrorMessage(code))
    } finally {
      setLoading(false)
    }
  }

  const isConfigured = configured === true

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: '#f4f7f6',
        px: 2,
        py: 5,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 430, border: '1px solid #e6eeeb', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'grid', width: 38, height: 38, placeItems: 'center', borderRadius: 2, bgcolor: '#c5eb68', color: '#17383b' }}>
                  <Bolt />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>PuRE Energy</Typography>
                  <Typography variant="caption" color="text.secondary">Dealer operations</Typography>
                </Box>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {mode === 'signin' ? 'Sign in to continue to your lead dashboard.' : 'Register with email and password to get started.'}
              </Typography>
            </Box>

            {configured === false && (
              <Alert severity="warning">
                Firebase Web app configuration is missing. Add the project settings to <code>.env.local</code>.
              </Alert>
            )}
            {notice && <Alert severity="success">{notice}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}

            <Button
              variant="outlined"
              onClick={signInWithGoogle}
              disabled={loading || !isConfigured}
              sx={{ minHeight: 44, borderColor: '#d9e3df', color: '#284448' }}
            >
              Continue with Google
            </Button>

            <Divider><Typography variant="caption" color="text.secondary">OR WITH EMAIL</Typography></Divider>

            <Box component="form" onSubmit={submit}>
              <Stack spacing={2}>
                <TextField
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  slotProps={{ htmlInput: { minLength: 6 } }}
                  required
                  fullWidth
                />
                {mode === 'signup' && (
                  <TextField
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    slotProps={{ htmlInput: { minLength: 6 } }}
                    required
                    fullWidth
                  />
                )}
                <Button type="submit" variant="contained" disabled={loading || !isConfigured} sx={{ minHeight: 44 }}>
                  {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" sx={{ textAlign: 'center' }} color="text.secondary">
              {mode === 'signin' ? 'New to the workspace?' : 'Already have an account?'}{' '}
              <Button
                size="small"
                onClick={() => {
                  setError('')
                  router.push(mode === 'signin' ? '/signup' : '/login')
                }}
                sx={{ minWidth: 0, p: 0, verticalAlign: 'baseline' }}
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </Button>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

export default function LoginPage() {
  return <AuthPage initialMode="signin" />
}
