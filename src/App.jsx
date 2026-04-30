import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewClaim from './pages/NewClaim'
import ClaimDetail from './pages/ClaimDetail'
import CostEstimator from './pages/CostEstimator'
import DenialInsights from './pages/DenialInsights'
import Settings from './pages/Settings'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/new-claim', element: <NewClaim /> },
      { path: '/claims/:id', element: <ClaimDetail /> },
      { path: '/cost-estimator', element: <CostEstimator /> },
      { path: '/denial-insights', element: <DenialInsights /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
