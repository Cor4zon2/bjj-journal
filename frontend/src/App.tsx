import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { createQueryClient } from './api/queryClient'
import { AuthGate } from './auth/AuthGate'
import { Layout } from './components/Layout'
import { TechniqueListPage } from './features/techniques/TechniqueListPage'
import { TechniquePage } from './features/techniques/TechniquePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/techniques" replace />} />
        <Route path="techniques" element={<TechniqueListPage />} />
        <Route path="techniques/:slug" element={<TechniquePage />} />
        <Route path="*" element={<Navigate to="/techniques" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <AppRoutes />
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
