import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar = () => {
  return (
    <aside className="main-sidebar sidebar-dark-primary elevation-4">
      {/* Vaše logo */}
      <a href="index3.html" className="brand-link">
        <img src="/path/to/your/logo.png" alt="Logo" className="brand-image img-circle elevation-3" style={{ opacity: '.8' }} />
        <span className="brand-text font-weight-light">Název aplikace</span>
      </a>

      <div className="sidebar">
        {/* Uživatelský panel (volitelně) */}
        <div className="user-panel mt-3 pb-3 mb-3 d-flex">
          <div className="image">
            <img src="/path/to/user/image.jpg" className="img-circle elevation-2" alt="Uživatelský obrázek" />
          </div>
          <div className="info">
            <a href="#" className="d-block">Uživatelské jméno</a>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="mt-2">
          <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
            {/* Přidání položek menu zde */}
            <li className="nav-item">
              <Link to="/" className="nav-link">
                <i className="nav-icon fas fa-home"></i>
                <p>Domů</p>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/about" className="nav-link">
                <i className="nav-icon fas fa-user"></i>
                <p>O nás</p>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/contact" className="nav-link">
                <i className="nav-icon fas fa-envelope"></i>
                <p>Kontakt</p>
              </Link>
            </li>
            <li className="nav-item has-treeview">
              <a href="#/" className="nav-link">
                <i className="nav-icon fas fa-warehouse"></i>
                <p>
                  WMS
                  <i className="right fas fa-angle-left"></i>
                </p>
              </a>
              <ul className="nav nav-treeview">
                <li className="nav-item">
                  <Link to="/objednavkyWMS" className="nav-link">
                    <i className="far fa-circle nav-icon"></i>
                    <p>Objednávky</p>
                  </Link>
                </li>
            {/* Další položky menu podle potřeby */}
          </ul>
        </nav>
        {/* Konec Sidebar Menu */}
      </div>
    </aside>
  );
};

export default Sidebar;
