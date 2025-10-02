import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'admin-lte/dist/css/adminlte.min.css';
import './css/App.css';
import LeftMenu from './LeftMenu';
import ServiceSheet from './components/ServiceSheet';
import ServiceConfig from './components/ServiceConfig';
import Analytics from './components/Analytics';
import ImportPLOR from './components/ImportPLOR';
import Calculation from './components/Calculation';
import Login from './components/Login';
import Register from './components/Register';
import ZakladniSlevy from './components/ZakladniSlevy';
import PolozkyB2B from './components/PolozkyB2B';
import AxLiveProducts from './components/AxLiveProducts';
import ObjednavkyB2B from './components/ObjednavkyB2B';
import ObjednavkaB2BDetail from './components/ObjednavkaB2BDetail';
import VehicleTemplatesViewer from './components/VehicleTemplatesViewer'; 
import VehicleViewer from './components/VehicleViewer'; 
import { AuthProvider } from './AuthContext'; // Importujte AuthProvider
// Komponenta pro ochranu cest
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('authToken');
    return !!token;
  });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };


// Styly pro hlavní obsah
const mainContentStyle = {
  marginLeft: isSidebarExpanded ? '250px' : '0px',
  transition: 'margin-left 0.3s ease',
  // Další potřebné styly pro hlavní obsah
};

return (
  <AuthProvider>
  <Router>
    <div style={{ display: 'flex' }}>
    <LeftMenu isSidebarExpanded={isSidebarExpanded} />
      <div style={mainContentStyle}>
        <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
          {isSidebarExpanded ? 'Zmenšit' : 'Zvětšit'} Menu
        </button>
        <Routes>

              <Route path="/login" element={!isAuthenticated ? <Login setIsAuthenticated={setIsAuthenticated} /> : <Navigate replace to="/servicesheet" />} />
              <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate replace to="/servicesheet" />} />
              <Route path="/servicesheet" element={<ProtectedRoute isAuthenticated={isAuthenticated}><ServiceSheet /></ProtectedRoute>} />
              <Route path="/serviceconfig" element={<ProtectedRoute isAuthenticated={isAuthenticated}><ServiceConfig /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Analytics /></ProtectedRoute>} />
              <Route path="/import-plor" element={<ProtectedRoute isAuthenticated={isAuthenticated}><ImportPLOR /></ProtectedRoute>} />
              <Route path="/calculation" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Calculation/></ProtectedRoute>} />
              <Route path="/zakladni_slevy" element={<ZakladniSlevy />} />
              <Route path="/polozkyb2b" element={<PolozkyB2B />} />
              <Route path="/ax-live-products" element={<ProtectedRoute isAuthenticated={isAuthenticated}><AxLiveProducts /></ProtectedRoute>} />
              <Route path="/objednavky-b2b" element={<ProtectedRoute isAuthenticated={isAuthenticated}><ObjednavkyB2B /></ProtectedRoute>} />
              <Route path="/objednavka-b2b-detail/:orderId" element={<ObjednavkaB2BDetail />} />
              <Route path="/vehicle-templates" element={<ProtectedRoute isAuthenticated={isAuthenticated}><VehicleTemplatesViewer /></ProtectedRoute>} />
              <Route path="/vehicle-viewer" element={<ProtectedRoute isAuthenticated={isAuthenticated}><VehicleViewer /></ProtectedRoute>} />

              <Route path="/" element={<Navigate replace to="/servicesheet" />} />
            </Routes>
          </div>
        </div>
        
    </Router>
    </AuthProvider>

  );
}

export default App;
