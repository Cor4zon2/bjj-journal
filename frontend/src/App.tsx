import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { createQueryClient } from './api/queryClient'
import { AuthGate } from './auth/AuthGate'
import { Layout } from './components/Layout'
import { HomePage } from './features/home/HomePage'
import { ClassHistoryPage } from './features/log/ClassHistoryPage'
import { EditClassPage } from './features/log/EditClassPage'
import { NewClassPage } from './features/log/NewClassPage'
import { MistakesPage } from './features/mistakes/MistakesPage'
import { TechniqueListPage } from './features/techniques/TechniqueListPage'
import { TechniquePage } from './features/techniques/TechniquePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="log" element={<ClassHistoryPage />} />
        <Route path="log/new" element={<NewClassPage />} />
        <Route path="log/:id/edit" element={<EditClassPage />} />
        <Route path="mistakes" element={<MistakesPage />} />
        <Route path="techniques" element={<TechniqueListPage />} />
        <Route path="techniques/:slug" element={<TechniquePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthGate>
          <AppRoutes />
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
