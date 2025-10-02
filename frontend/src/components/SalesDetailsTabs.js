// SalesDetailsTabs.js
import React, { useState } from 'react';
import { Box, Button, Tabs, Tab, Typography } from '@mui/material';
import SalesDetailsByYear from './SalesDetailsByYear';
import ProductGroupsView from './ProductGroupsView';

// Pomocná komponenta pro obsah záložek
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function SalesDetailsTabs({ detail, onBack, groupBy }) {
  const [tabValue, setTabValue] = useState(0);
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ p: 2 }}>
      {onBack && (
        <Button variant="contained" onClick={onBack} sx={{ mb: 2 }}>
          Zpět
        </Button>
      )}
      {detail ? (
        <Typography variant="h4" sx={{ mb: 2 }}>
          Detailní prodeje {detail.type === 'center' ? 'střediska' : 'obchodníka'}: {detail.type === 'center' ? detail.data.stredisko : detail.data.jmeno}
        </Typography>
      ) : (
        <Typography variant="h4" sx={{ mb: 2 }}>
          Detailní přehled
        </Typography>
      )}

      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        textColor="primary"
        indicatorColor="primary"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Tab
          label="Přehled prodejů"
          sx={{
            backgroundColor: tabValue === 0 ? '#1976d2' : '#eeeeee',
            color: tabValue === 0 ? '#ffffff' : 'rgba(0,0,0,0.7)',
            border: '1px solid',
            borderColor: 'divider',
            borderBottom: 'none',
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            textTransform: 'none',
            fontWeight: tabValue === 0 ? 'bold' : 'normal',
          }}
        />
        <Tab
          label="Přehled dle skupin produktů"
          sx={{
            backgroundColor: tabValue === 1 ? '#1976d2' : '#eeeeee',
            color: tabValue === 1 ? '#ffffff' : 'rgba(0,0,0,0.7)',
            border: '1px solid',
            borderColor: 'divider',
            borderBottom: 'none',
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            textTransform: 'none',
            fontWeight: tabValue === 1 ? 'bold' : 'normal',
          }}
        />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <SalesDetailsByYear detail={detail} groupBy={groupBy} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <ProductGroupsView detail={detail} groupBy={groupBy} />
      </TabPanel>
    </Box>
  );
}
