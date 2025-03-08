import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Shield, ShieldAlert } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import Navbar from './components/Navbar';

function App() {
  // Demo authentication state - in real app, use proper auth management
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  const handleLogin = (credentials: { username: string; password: string }) => {
    // Demo credentials
    if (credentials.username === 'demo' && credentials.password === 'cid2025') {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route 
            path="/login" 
            element={
              <LoginPage onLogin={handleLogin} isAuthenticated={isAuthenticated} />
            } 
          />
          <Route 
            path="/upload" 
            element={
              isAuthenticated ? <UploadPage /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;