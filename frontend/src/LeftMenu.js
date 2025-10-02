import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Toolbar,
  IconButton,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  CarRepair,
  Assessment,
  AttachMoney,
  Business,
  Settings,
  DirectionsCar,
  ListAlt,
  Storage,
  ChevronLeft,
} from '@mui/icons-material';
import { styled } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const drawerWidth = 240;

const CustomDrawer = styled(Drawer)(({ theme, open }) => ({
  '& .MuiDrawer-paper': {
    width: open ? drawerWidth : 0,
    overflowX: 'hidden',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    background: 'linear-gradient(to bottom, #f7f7f7, #e0e0e0)',
    boxShadow: open ? '4px 0px 10px rgba(0, 0, 0, 0.2)' : 'none',
  },
}));

function LeftMenu({ open, handleDrawerToggle }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [openMenus, setOpenMenus] = useState({});

  const handleClick = (title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const menuItems = [
    {
      title: 'Servis Zlín',
      icon: <CarRepair />,
      items: [
        { title: 'Kalendář', path: '/calendar' },
        { title: 'Nákladní pneuservis', path: '/servicesheet?deviceId=3' },
        { title: 'Osobní pneuservis', path: '' },
        { title: 'Autoservis', path: '' },
      ],
    },
    {
      title: 'Analýza',
      icon: <Assessment />,
      items: [
        { title: 'Položky AX', path: '/ax-live-products' },
        { title: 'Import Ceníků', path: '/catalog-import' },
        { title: 'Ceníky', path: '/catalog-viewer' },
        { title: 'Import kalkulačního ceníku', path: '/import-plor' },
        { title: 'Položky B2B', path: '/polozkyb2b' },
        { title: 'Dashboard', path: '/dashboard' },
        { title: 'Položky Tavinox', path: '/polozkytavinox' },
      ],
    },
    {
      title: 'Ceny',
      icon: <AttachMoney />,
      items: [
        { title: 'Správa položek a ceníků', path: '/productPricingManagement' },
        { title: 'Položky AX', path: '/ax-live-products' },
        { title: 'Položky B2B', path: '/polozkyb2b' },
        { title: 'Aktivní Položky B2B', path: '/ax-current-b2b-prices' },
        { title: 'Produkty - Aktivní pravidla', path: '/ProductList' },
        { title: 'Nákupní slevy', path: '/nakupni_slevy' },
        { title: 'Základní slevy', path: '/zakladni_slevy' },
        { title: 'Základní slevy Tavinox', path: '/zakladni_slevy_tav' },
        { title: 'Netto ceny', path: '/Netto' },
        { title: 'Akce položka', path: '/akce_polozka' },
        { title: 'Výprodej', path: '/Vyprodej' },
        { title: 'Ceny B2B - dočasný', path: '/cenyb2b-docasny' },
      ],
    },
    {
      title: 'B2B',
      icon: <Business />,
      items: [
        { title: 'Klienti', path: '/klientimap' },
        { title: 'Objednávky Pneu-B2B', path: '/objednavky-b2b' },
        { title: 'Objednávky Pneu-tyres', path: '/objednavky-pt' },
        { title: 'Objednávky Tavinox', path: '/objednavky-tav' },
        { title: 'Položky Pneu-B2B', path: '/polozkyb2b' },
        { title: 'Objednávky SE', path: '/se_orderlist' },
      ],
    },
    {
      title: 'Vozový park',
      icon: <DirectionsCar />,
      items: [
        { title: 'Správa vozidel', path: '/vehicle-viewer', icon: <ListAlt /> },
        { title: 'Šablony vozidel', path: '/vehicle-templates', icon: <ListAlt /> },
      ],
    },
    {
      title: 'WMS',
      icon: <Storage />,
      items: [
        { title: 'Objednávky', path: '/objednavkyWMS' },
        { title: 'Sklady', path: '/WarehouseVisualization' },
        { title: 'Nastavení skladů', path: '/warehouse-setup' },
        { title: 'Generátor čárových kódů', path: '/qrgenerator' },
        { title: 'Příjem', path: '/NP_OrderList' },
        { title: 'Poč. inventura', path: '/initial-inventory' },
      ],
    },
    {
      title: 'Nastavení',
      icon: <Settings />,
      items: [
        { title: 'Konfigurace Servis', path: '/serviceconfig' },
        { title: 'Konfigurace Číselníků', path: '/catalog-management', icon: <Storage /> },
      ],
    },
  ];

  const renderMenuItems = (items, depth = 0) => {
    return items.map((item) => {
      if (item.items) {
        return (
          <React.Fragment key={item.title}>
            <ListItemButton onClick={() => handleClick(item.title)} sx={{ pl: depth * 3 }}>
              {item.icon && (
                <ListItemIcon sx={{ color: '#e23c31' }}>{item.icon}</ListItemIcon>
              )}
              <ListItemText primary={item.title} />
              {openMenus[item.title] ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={openMenus[item.title]} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderMenuItems(item.items, depth + 1)}
              </List>
            </Collapse>
          </React.Fragment>
        );
      } else {
        return (
          <ListItemButton
            key={item.title}
            component={NavLink}
            to={item.path}
            sx={{
              pl: depth * 3,
              '&.active': { backgroundColor: theme.palette.action.selected },
              '&:hover': { backgroundColor: '#ffe5e5' },
            }}
            onClick={isMobile ? handleDrawerToggle : undefined}
          >
            <ListItemText primary={item.title} />
          </ListItemButton>
        );
      }
    });
  };

  return (
    <CustomDrawer
      variant={isMobile ? 'temporary' : 'persistent'}
      open={open}
      onClose={handleDrawerToggle}
    >
      <Toolbar sx={{ justifyContent: 'flex-end' }}>
        <IconButton
          size="small"
          onClick={handleDrawerToggle}
          title="Skrýt menu"
          sx={{ backgroundColor: 'white', boxShadow: 1 }}
        >
          <ChevronLeft />
        </IconButton>
      </Toolbar>
      <List>{renderMenuItems(menuItems)}</List>
    </CustomDrawer>
  );
}

export default LeftMenu;
