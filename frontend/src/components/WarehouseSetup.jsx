import React, { useState, useEffect } from 'react';
import { Box, Button, Card, CardContent, Typography, Grid } from '@mui/material';
import WarehouseModal from './WarehouseModal';
import ShelfConfiguratorModal from './ShelfConfiguratorModal';
import TemplateSettingsModal from './TemplateSettingsModal';
import { 
  getWarehouses, 
  getTemplateSettings, 
  updateWarehouse, 
  deleteWarehouse, 
  deleteShelf, 
  addShelf, 
  updateShelfDetails 
} from './warehouseService';

function WarehouseSetup() {
  const [warehouses, setWarehouses] = useState([]);
  const [templateData, setTemplateData] = useState({
    floor_heights: [2.5, 3.0, 3.5],
    section_widths: [1.0, 1.5],
    pallet_sizes: ['800x1200', '1200x1000'],
  });
  const [openWarehouseModal, setOpenWarehouseModal] = useState(false);
  const [openShelfModal, setOpenShelfModal] = useState(false);
  const [openTemplateModal, setOpenTemplateModal] = useState(false); // deklarace zde
  const [selectedShelf, setSelectedShelf] = useState(null);

  // Načtení skladů při vstupu do aplikace
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const data = await getWarehouses();
        const fetchedWarehouses = data.warehouses ? data.warehouses : data;
        const normalizedWarehouses = Array.isArray(fetchedWarehouses)
          ? fetchedWarehouses.map((w) => ({
              ...w,
              shelves: Array.isArray(w.shelves) ? w.shelves : [],
            }))
          : [];
        setWarehouses(normalizedWarehouses);
      } catch (error) {
        console.error('Chyba při načítání skladů:', error);
      }
    }
    fetchWarehouses();
  }, []);

  // Načtení šablon z endpointu templateSettings
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const data = await getTemplateSettings();
        setTemplateData(
          data.templateSettings && data.templateSettings.floor_heights
            ? data.templateSettings
            : {
                floor_heights: [2.5, 3.0, 3.5],
                section_widths: [1.0, 1.5],
                pallet_sizes: ['800x1200', '1200x1000'],
              }
        );
      } catch (error) {
        console.error('Chyba při načítání šablon:', error);
        setTemplateData({
          floor_heights: [2.5, 3.0, 3.5],
          section_widths: [1.0, 1.5],
          pallet_sizes: ['800x1200', '1200x1000'],
        });
      }
    }
    fetchTemplates();
  }, []);

  // Funkce pro přidání nového regálu přes API (addShelf)
  const handleAddShelf = async (warehouseId) => {
    const shelfName = `Nový regál`; // Zde můžete upravit logiku získávání názvu
    try {
      const newShelf = await addShelf(warehouseId, shelfName);
      setWarehouses((prev) =>
        prev.map((warehouse) =>
          warehouse.id === warehouseId
            ? {
                ...warehouse,
                shelves: [
                  ...warehouse.shelves,
                  { id: newShelf.shelfId, name: newShelf.shelfName, floors: [], sections: [] },
                ],
              }
            : warehouse
        )
      );
    } catch (error) {
      console.error('Chyba při přidávání regálu:', error);
    }
  };

  // Funkce pro upsert regálu při úpravě (ShelfConfiguratorModal)
  const handleUpdateShelf = async (updatedShelf) => {
    try {
      // Použijeme updatedShelf.shelfId místo updatedShelf.id
      const shelfData = {
        shelfId: updatedShelf.shelfId,
        buildingId: selectedShelf.warehouseId, // nebo shelf.building_id podle konvence
        shelfName: updatedShelf.shelfName,
        floors: updatedShelf.floors,
        sections: updatedShelf.sections,
      };
      const result = await updateShelfDetails(shelfData);
      setWarehouses((prev) =>
        prev.map((warehouse) =>
          warehouse.id === selectedShelf.warehouseId
            ? {
                ...warehouse,
                shelves: warehouse.shelves.map((shelf) =>
                  shelf.id === updatedShelf.shelfId ? { ...shelf, ...shelfData } : shelf
                ),
              }
            : warehouse
        )
      );
    } catch (error) {
      console.error('Chyba při upsertu regálu:', error);
    } finally {
      setOpenShelfModal(false);
      setSelectedShelf(null);
    }
  };

  // Otevření modalu pro přidání skladu
  const handleOpenWarehouseModal = () => setOpenWarehouseModal(true);
  const handleCloseWarehouseModal = () => setOpenWarehouseModal(false);

  // Otevření modalu pro úpravu regálu
  const handleEditShelf = (warehouseId, shelfId) => {
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    if (warehouse) {
      const shelf = warehouse.shelves.find((s) => s.id === shelfId);
      console.log('Editing shelf:', shelf);
      if (shelf) {
        setSelectedShelf({ warehouseId, shelf });
        setOpenShelfModal(true);
      }
    }
  };

  // Smazání regálu
  const handleDeleteShelf = async (shelfId, warehouseId) => {
    if (window.confirm('Opravdu chcete smazat tento regál?')) {
      try {
        await deleteShelf(shelfId);
        setWarehouses((prev) =>
          prev.map((w) =>
            w.id === warehouseId ? { ...w, shelves: w.shelves.filter((s) => s.id !== shelfId) } : w
          )
        );
      } catch (error) {
        console.error('Chyba při mazání regálu:', error);
      }
    }
  };

  // Úprava budovy pomocí promptu
  const handleEditWarehouse = async (warehouse) => {
    const newName = window.prompt('Zadejte nový název budovy:', warehouse.name);
    if (newName && newName.trim() !== '') {
      try {
        await updateWarehouse(warehouse.id, newName);
        setWarehouses((prev) =>
          prev.map((w) => (w.id === warehouse.id ? { ...w, name: newName } : w))
        );
      } catch (error) {
        console.error('Chyba při aktualizaci budovy:', error);
      }
    }
  };

  // Smazání budovy
  const handleDeleteWarehouse = async (buildingId) => {
    if (window.confirm('Opravdu chcete smazat tuto budovu?')) {
      try {
        await deleteWarehouse(buildingId);
        setWarehouses((prev) => prev.filter((w) => w.id !== buildingId));
      } catch (error) {
        console.error('Chyba při mazání budovy:', error);
      }
    }
  };

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Správa skladu
      </Typography>
      <Box mb={2}>
        <Button variant="contained" color="primary" onClick={handleOpenWarehouseModal} sx={{ mr: 2 }}>
          Přidat sklad
        </Button>
        <Button variant="outlined" onClick={() => setOpenTemplateModal(true)}>
          Správa šablon
        </Button>
      </Box>

      {/* Modal pro přidání skladu */}
      <WarehouseModal 
        open={openWarehouseModal} 
        onClose={handleCloseWarehouseModal} 
        onSubmit={(values) => {
          // Vytvoření nového skladu lokálně
          const { warehouseName, shelfCount } = values;
          const shelves = Array.from({ length: Number(shelfCount) }, (_, i) => ({
            id: i + 1,
            name: `Regál ${i + 1}`,
            floors: Array.from({ length: 5 }, (_, j) => ({
              floorNumber: j + 1,
              height: templateData.floor_heights[0],
            })),
            sections: Array.from({ length: 3 }, (_, k) => ({
              name: `Sekce ${k + 1}`,
              width: templateData.section_widths[0],
              numberOfPalletSlots: 0,
            })),
          }));
          const newWarehouse = {
            id: warehouses.length + 1,
            name: warehouseName,
            shelves: shelves,
          };
          setWarehouses([...warehouses, newWarehouse]);
        }} 
      />

      {/* Tlačítko pro přidání regálu */}
      {warehouses.length > 0 && (
        <Box mb={2}>
          {/* Předpokládáme, že regály se přidávají do prvního skladu */}
          <Button variant="outlined" onClick={() => handleAddShelf(warehouses[0].id)}>
            Přidat regál
          </Button>
        </Box>
      )}

      <Box mt={2}>
        {warehouses.map((warehouse) => (
          <Card key={warehouse.id} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">{warehouse.name}</Typography>
              <Typography variant="body2">
                Počet regálů: {warehouse.shelves?.length || 0}
              </Typography>
              <Box mt={1}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => handleEditWarehouse(warehouse)} 
                  sx={{ mr: 1 }}
                >
                  Upravit budovu
                </Button>
                <Button 
                  variant="outlined" 
                  size="small" 
                  color="error" 
                  onClick={() => handleDeleteWarehouse(warehouse.id)}
                >
                  Smazat budovu
                </Button>
              </Box>
              <Grid container spacing={2} mt={1}>
                {warehouse.shelves?.map((shelf) => (
                  <Grid item xs={12} key={shelf.id}>
                    <Card variant="outlined" sx={{ mb: 1 }}>
                      <CardContent>
                        <Typography variant="subtitle1">{shelf.name}</Typography>
                        <Typography variant="body2">
                          Pater: {shelf.floors?.length || 0}, Sekcí: {shelf.sections?.length || 0}
                        </Typography>
                        <Box mt={1}>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => handleEditShelf(warehouse.id, shelf.id)} 
                            sx={{ mr: 1 }}
                          >
                            Upravit regál
                          </Button>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            color="error" 
                            onClick={() => handleDeleteShelf(shelf.id, warehouse.id)}
                          >
                            Smazat regál
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>

      {selectedShelf && (
        <ShelfConfiguratorModal 
          open={openShelfModal} 
          onClose={() => setOpenShelfModal(false)} 
          shelf={selectedShelf.shelf} 
          onSubmit={handleUpdateShelf} 
          templateSettings={templateData} 
        />
      )}

      <TemplateSettingsModal 
        open={openTemplateModal} 
        onClose={() => setOpenTemplateModal(false)} 
        initialTemplates={templateData} 
        onSave={(newTemplates) => setTemplateData(newTemplates)} 
      />
    </Box>
  );
}

export default WarehouseSetup;
