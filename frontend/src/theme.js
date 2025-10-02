// theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#000000', // Černá barva pro primární prvky
    },
    secondary: {
      main: '#e23c31', // Červená barva pro sekundární prvky
    },
    background: {
      default: '#ffffff', // Bílá barva pozadí
    },
    text: {
      primary: '#000000', // Černý text
      secondary: '#ffffff', // Bílý text
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(to right, #ffffff 15%, #e23c31 85%)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(to bottom, #f7f7f7, #e0e0e0)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
        containedPrimary: {
          backgroundColor: '#000000',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
          },
        },
        containedSecondary: {
          backgroundColor: '#e23c31',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#d32f2f',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: '#e0e0e0',
            '&:hover': {
              backgroundColor: '#d5d5d5',
            },
          },
          '&:hover': {
            backgroundColor: '#f5f5f5',
          },
        },
      },
    },
  },
});

export default theme;
