// components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ isAuthenticated, allowedRoles = [], allowedPaths = [], children }) => {
  const userRole = localStorage.getItem('userRole'); // nebo z kontextu
  const currentPath = window.location.pathname;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedPaths.length && !allowedPaths.includes(currentPath)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
