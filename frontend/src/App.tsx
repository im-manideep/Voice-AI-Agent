import { Route, Routes } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Hero } from './components/landing/Hero'
import { SessionScreen } from './components/session/SessionScreen'
import { ProgressDashboard } from './components/progress/ProgressDashboard'

export default function App() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/progress" element={<ProgressDashboard />} />
      </Routes>
    </div>
  )
}
