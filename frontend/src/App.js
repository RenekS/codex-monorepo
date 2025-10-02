// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, useMediaQuery, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import theme from './theme';
import './css/App.css';

import { AuthProvider } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LeftMenu from './LeftMenu';
import Login from './components/Login';
import Register from './components/Register';
import Unauthorized from './components/Unauthorized';

// vaše všechny ostatní komponenty
import InitialInventory from './components/InitialInventory';
import ServiceSheet from './components/ServiceSheet';
import ServiceConfig from './components/ServiceConfig';
import Analytics from './components/Analytics';
import ImportPLOR from './components/ImportPLOR';
import Calculation from './components/Calculation';
import ZakladniSlevy from './components/ZakladniSlevy';
import ZakladniSlevyTav from './components/ZakladniSlevyTav';
import NakupniSlevy from './components/NakupniSlevy';
import PoložkyB2B from './components/PolozkyB2B';
import AxLiveProducts from './components/AxLiveProducts';
import AxLiveProductsEdit from './components/AxLiveProductsEdit';
import ObjednavkyB2B from './components/ObjednavkyB2B';
import ObjednavkyPT from './components/ObjednavkyPT';
import ObjednavkyTav from './components/ObjednavkyTav';
import ObjednavkaB2BDetail from './components/ObjednavkaB2BDetail';
import ObjednavkaTavDetail from './components/ObjednavkaTavDetail';
import ObjednavkaPTDetail from './components/ObjednavkaPTDetail';
import VehicleTemplatesViewer from './components/VehicleTemplatesViewer';
import VehicleViewer from './components/VehicleViewer';
import SE_OrderList from './components/SE_OrderList';
import SE_OrderDetail from './components/SE_OrderDetail';
import SE_OrdersPicking from './components/SE_OrdersPicking';
import AkcePolozka from './components/AkcePolozka';
import Netto from './components/Netto';
import Vyprodej from './components/Vyprodej';
import ProductDetail from './components/ProductDetail';
import ProductList from './components/ProductList';
import AxCurrentB2BPrices from './components/AxCurrentB2BPrices';
import CenyB2BDocasny from './components/CenyB2BDocasny';
import CatalogManagement from './components/CatalogManagement';
import CatalogImport from './components/CatalogImport';
import CatalogViewer from './components/CatalogViewer';
import Calendar from './components/Calendar';
import ObjednavkyWMS from './components/OrderList';
import OrderDetail from './components/OrderDetail';
import WarehouseSetup from './components/WarehouseSetup';
import DashBoard from './components/DashBoard';
import WarehouseVisualization from './components/WarehouseVisualization';
import ProductPricingManagement from './components/ProductPricingManagement';
import SalesDetailsTabsWrapper from './components/SalesDetailsTabsWrapper';
import NP_OrderList from './components/NP_OrderList';
import NP_Detail from './pages/NP_Detail';
import QRGenerator from './components/QRGenerator';
import KlientiMap from './components/KlientiMap';
import PolozkyTavinox from './components/PolozkyTavinox'

const drawerWidth = 240;

// Hlavní layout se Sidebarem
const MainLayout = ({ open, handleDrawerToggle, children }) => (
  <div style={{ display: 'flex', height: '100vh' }}>
    <CssBaseline />

    {/* Plovoucí hamburger (zobrazený jen když je menu zavřené) */}
    <IconButton
      onClick={handleDrawerToggle}
      title="Zobrazit menu"
      sx={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 2000,
        backgroundColor: 'white',
        boxShadow: 2,
        display: open ? 'none' : 'inline-flex',
      }}
    >
      <MenuIcon />
    </IconButton>

    <LeftMenu open={open} handleDrawerToggle={handleDrawerToggle} />

    <main
      style={{
        flexGrow: 1,
        marginLeft: open ? drawerWidth : 0,
        transition: 'margin-left 0.3s',
        paddingTop: 0, // žádný top padding
        overflowY: 'auto',
      }}
    >
      {children}
    </main>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('authToken'));
  const [userRoutes, setUserRoutes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('userRoutes')) || [];
    } catch {
      return [];
    }
  });

  // Kdykoli se změní localStorage, aktualizujeme stav
  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('authToken'));
    try {
      setUserRoutes(JSON.parse(localStorage.getItem('userRoutes')) || []);
    } catch {
      setUserRoutes([]);
    }
  }, []);

  const isDesktopOrLaptop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(isDesktopOrLaptop);
  useEffect(() => setOpen(isDesktopOrLaptop), [isDesktopOrLaptop]);
  const handleDrawerToggle = () => setOpen((o) => !o);

  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Veřejné routy */}
            <Route
              path="/login"
              element={
                !isAuthenticated ? (
                  <Login setIsAuthenticated={setIsAuthenticated} setUserRoutes={setUserRoutes} />
                ) : (
                  <Navigate to="/servicesheet" replace />
                )
              }
            />
            <Route
              path="/register"
              element={!isAuthenticated ? <Register /> : <Navigate to="/servicesheet" replace />}
            />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Zabezpečené routy */}
            <Route
              path="/*"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} allowedPaths={userRoutes}>
                  <MainLayout open={open} handleDrawerToggle={handleDrawerToggle}>
                    <Routes>
                      {/* všechny vaše child routy */}
                      <Route path="/servicesheet" element={<ServiceSheet />} />
                      <Route path="/serviceconfig" element={<ServiceConfig />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/import-plor" element={<ImportPLOR />} />
                      <Route path="/calculation" element={<Calculation />} />
                      <Route path="/zakladni_slevy" element={<ZakladniSlevy />} />
                      <Route path="/zakladni_slevy_tav" element={<ZakladniSlevyTav />} />
                      <Route path="/nakupni_slevy" element={<NakupniSlevy />} />
                      <Route path="/akce_polozka" element={<AkcePolozka />} />
                      <Route path="/Netto" element={<Netto />} />
                      <Route path="/Vyprodej" element={<Vyprodej />} />
                      <Route path="/productdetail/:polozka" element={<ProductDetail />} />
                      <Route path="/polozkyb2b" element={<PoložkyB2B />} />
                      <Route path="/productlist" element={<ProductList />} />
                      <Route path="/ax-live-products" element={<AxLiveProducts />} />
                      <Route path="/ax-live-products-edit" element={<AxLiveProductsEdit />} />
                      <Route path="/objednavky-b2b" element={<ObjednavkyB2B />} />
                      <Route path="/objednavky-pt" element={<ObjednavkyPT />} />
                      <Route path="/objednavky-tav" element={<ObjednavkyTav />} />
                      <Route path="/objednavka-b2b-detail/:orderId" element={<ObjednavkaB2BDetail />} />
                      <Route path="/objednavka-tav-detail/:orderId" element={<ObjednavkaTavDetail />} />
                      <Route path="/objednavka-pt-detail/:orderId" element={<ObjednavkaPTDetail />} />
                      <Route path="/vehicle-templates" element={<VehicleTemplatesViewer />} />
                      <Route path="/vehicle-viewer" element={<VehicleViewer />} />
                      <Route path="/se_orderlist" element={<SE_OrderList />} />
                      <Route path="/eforder/:orderNumber" element={<SE_OrderDetail />} />
                      <Route path="/eforders-picking" element={<SE_OrdersPicking />} />
                      <Route path="/ax-current-b2b-prices" element={<AxCurrentB2BPrices />} />
                      <Route path="/cenyb2b-docasny" element={<CenyB2BDocasny />} />
                      <Route path="/catalog-management" element={<CatalogManagement />} />
                      <Route path="/catalog-import" element={<CatalogImport />} />
                      <Route path="/catalog-viewer" element={<CatalogViewer />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/objednavkyWMS" element={<ObjednavkyWMS />} />
                      <Route path="/order/:orderNumber" element={<OrderDetail />} />
                      <Route path="/warehouse-setup" element={<WarehouseSetup />} />
                      <Route path="/productpricingmanagement" element={<ProductPricingManagement />} />
                      <Route path="/dashboard" element={<DashBoard />} />
                      <Route path="/qrgenerator" element={<QRGenerator />} />
                      <Route path="/WarehouseVisualization" element={<WarehouseVisualization />} />
                      <Route path="/NP_OrderList" element={<NP_OrderList />} />
                      <Route path="np/detail/:id" element={<NP_Detail />} />
                      <Route path="/klientimap" element={<KlientiMap />} />
                      <Route path="/polozkytavinox" element={<PolozkyTavinox />} />
                      <Route path="/initial-inventory" element={<InitialInventory />} />
                      {/* fallback */}
                      <Route path="*" element={<Navigate to="/servicesheet" replace />} />
                    </Routes>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
