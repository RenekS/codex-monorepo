import React, { useEffect, useState } from 'react';
import {
  Modal,
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  Paper,
} from '@mui/material';
import { Formik, Form, FieldArray } from 'formik';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  getTemplateSettings,
  createTemplateSettings,
  updateTemplateSettings,
  deleteTemplateSettings,
} from './warehouseService';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  maxHeight: '90vh',
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
  overflowY: 'auto',
};

function TemplateSettingsModal({ open, onClose, onSettingsUpdated }) {
  // Výchozí fallback hodnoty – vždy pouze jedna hodnota 1 v každém poli
  const defaultTemplates = {
    floor_heights: [1],
    section_widths: [1],
    pallet_sizes: [1],
  };

  // Lokální stav pro načtené šablony a případné id uložené šablon
  const [initialTemplates, setInitialTemplates] = useState(defaultTemplates);
  const [templateId, setTemplateId] = useState(null);

  // Načtení šablon z endpointu při otevření modalu
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const data = await getTemplateSettings();
        // Předpokládáme, že endpoint vrací objekt např.: { templateSettings: { id, floor_heights, ... } }
        if (data.templateSettings && data.templateSettings.floor_heights) {
          setInitialTemplates(data.templateSettings);
          setTemplateId(data.templateSettings.id);
        } else {
          setInitialTemplates(defaultTemplates);
          setTemplateId(null);
        }
      } catch (error) {
        console.error('Chyba při načítání šablon:', error);
        setInitialTemplates(defaultTemplates);
        setTemplateId(null);
      }
    }
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  // Funkce pro uložení šablon – vytvoříme nové nebo aktualizujeme stávající podle existence id
  const handleSubmit = async (values) => {
    // Transformace dat do očekávaného formátu
    const payload = {
      floorHeights: values.floor_heights,
      sectionWidths: values.section_widths,
      palletSizes: values.pallet_sizes,
    };
  
    try {
      let updatedData;
      if (templateId) {
        updatedData = await updateTemplateSettings(templateId, payload);
      } else {
        updatedData = await createTemplateSettings(payload);
      }
      // Zpracování odpovědi, aktualizace stavu atd.
      const newTemplates = updatedData.templateSettings || values;
      setInitialTemplates(newTemplates);
      setTemplateId(newTemplates.id || templateId);
      if (onSettingsUpdated) onSettingsUpdated(newTemplates);
      onClose();
    } catch (error) {
      console.error('Chyba při ukládání šablon:', error);
    }
  };

  // Funkce pro smazání šablon – pokud šablony existují (mají id), zavolá se příslušný endpoint
  const handleDelete = async () => {
    if (templateId && window.confirm('Opravdu chcete smazat šablony?')) {
      try {
        await deleteTemplateSettings(templateId);
        setInitialTemplates(defaultTemplates);
        setTemplateId(null);
        if (onSettingsUpdated) onSettingsUpdated(defaultTemplates);
        onClose();
      } catch (error) {
        console.error('Chyba při mazání šablon:', error);
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>
          Správa šablon
        </Typography>
        <Formik
          enableReinitialize
          initialValues={initialTemplates}
          onSubmit={handleSubmit}
        >
          {({ values, handleChange }) => (
            <Form>
              {/* Správa výšek pater */}
              <Typography variant="subtitle1" gutterBottom>
                Výšky pater (v metrech)
              </Typography>
              <FieldArray name="floor_heights">
                {({ push, remove }) => (
                  <div>
                    {values.floor_heights &&
                      values.floor_heights.map((item, index) => (
                        <Paper
                          key={index}
                          sx={{
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <TextField
                            name={`floor_heights.${index}`}
                            label="Výška"
                            type="number"
                            value={item}
                            onChange={handleChange}
                            sx={{ flexGrow: 1 }}
                          />
                          <IconButton onClick={() => remove(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </Paper>
                      ))}
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => push(1)}
                      sx={{ mb: 2 }}
                    >
                      Přidat výšku
                    </Button>
                  </div>
                )}
              </FieldArray>

              {/* Správa šířek sekcí */}
              <Typography variant="subtitle1" gutterBottom>
                Šířky sekcí (v metrech)
              </Typography>
              <FieldArray name="section_widths">
                {({ push, remove }) => (
                  <div>
                    {values.section_widths &&
                      values.section_widths.map((item, index) => (
                        <Paper
                          key={index}
                          sx={{
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <TextField
                            name={`section_widths.${index}`}
                            label="Šířka"
                            type="number"
                            value={item}
                            onChange={handleChange}
                            sx={{ flexGrow: 1 }}
                          />
                          <IconButton onClick={() => remove(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </Paper>
                      ))}
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => push(1)}
                      sx={{ mb: 2 }}
                    >
                      Přidat šířku
                    </Button>
                  </div>
                )}
              </FieldArray>

              {/* Správa velikostí palet */}
              <Typography variant="subtitle1" gutterBottom>
                Velikost palety
              </Typography>
              <FieldArray name="pallet_sizes">
                {({ push, remove }) => (
                  <div>
                    {values.pallet_sizes &&
                      values.pallet_sizes.map((item, index) => (
                        <Paper
                          key={index}
                          sx={{
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <TextField
                            name={`pallet_sizes.${index}`}
                            label="Velikost palety"
                            type="text"
                            value={item}
                            onChange={handleChange}
                            sx={{ flexGrow: 1 }}
                          />
                          <IconButton onClick={() => remove(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </Paper>
                      ))}
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => push(1)}
                      sx={{ mb: 2 }}
                    >
                      Přidat velikost
                    </Button>
                  </div>
                )}
              </FieldArray>

              <Box display="flex" justifyContent="space-between">
                <Button type="submit" variant="contained" color="primary">
                  Uložit šablony
                </Button>
                {templateId && (
                  <Button variant="outlined" color="error" onClick={handleDelete}>
                    Smazat šablony
                  </Button>
                )}
              </Box>
            </Form>
          )}
        </Formik>
      </Box>
    </Modal>
  );
}

export default TemplateSettingsModal;
