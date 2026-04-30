import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewClaim from './pages/NewClaim'
import ClaimDetail from './pages/ClaimDetail'
import DenialInsights from './pages/DenialInsights'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-claim" element={<NewClaim />} />
          <Route path="/claims/:id" element={<ClaimDetail />} />
          <Route path="/denial-insights" element={<DenialInsights />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
