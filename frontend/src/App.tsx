import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import ModelList from './pages/ModelList'
import Models from './pages/Models'
import Data from './pages/Data'
import Workflows from './pages/Workflows'
import WorkflowDesigner from './pages/WorkflowDesigner'
import Pages from './pages/Pages'
import PageEditor from './pages/PageEditor'
import DynamicPage from './pages/DynamicPage'
import Settings from './pages/Settings'
import Login from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="model-list" element={<ModelList />} />
        <Route path="models/:id" element={<Models />} />
        <Route path="data/:modelName" element={<Data />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="workflows/:id" element={<WorkflowDesigner />} />
        <Route path="pages" element={<Pages />} />
        <Route path="pages/:id" element={<PageEditor />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      {/* 动态页面路由 */}
      <Route path="/*" element={<DynamicPage />} />
    </Routes>
  )
}

export default App
