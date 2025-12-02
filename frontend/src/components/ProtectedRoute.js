// components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ isAuthenticated, allowedRoles = [], allowedPaths = [], children }) => {
  const userRole = localStorage.getItem('userRole'); // nebo z kontextu
  const currentPath = window.location.pathname;

  // povol i dynamické cesty typu /objednavka-pt-detail/123 pokud má user povolenou základní route
  const isPathAllowed =
    !allowedPaths.length ||
    allowedPaths.some((allowed) => currentPath === allowed || currentPath.startsWith(`${allowed}/`));

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!isPathAllowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
