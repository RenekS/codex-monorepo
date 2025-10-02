import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Opravený import

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    console.log('Načítání tokenu z localStorage:', token); // Log pro ladění
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log('Dekódovaný token:', decoded); // Log dekódovaného tokenu
        setCurrentUser(decoded);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Chyba při dekódování tokenu:', error);
      }
    }
  }, []);

  const login = (token) => {
    console.log('Přihlašování uživatele, token:', token); // Log při přihlašování
    localStorage.setItem('authToken', token);
    try {
      const decoded = jwtDecode(token);
      console.log('Dekódovaný token při přihlášení:', decoded); // Log dekódovaného tokenu při přihlášení
      setCurrentUser(decoded);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Chyba při dekódování tokenu při přihlášení:', error);
    }
  };

  const logout = () => {
    console.log('Odhlášení uživatele'); // Log při odhlášení
    localStorage.removeItem('authToken');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    currentUser,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};