// ShelfConfiguratorModal.jsx
import React, { useState, useRef } from 'react';
import {
  Modal,
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  TextField,
  Paper,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import { Formik, Form, FieldArray } from 'formik';
import { searchProducts, assignProductToSlot } from './warehouseService';

/* ------------------------------------------------------------------ */
/* Umístění a vzhled MUI modalu                                       */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Generátor slotů pro každé patro                                     */
/* ------------------------------------------------------------------ */
function generatePalletSlotsForFloors(floors, numberOfSlots) {
  const slots = [];
  floors.forEach((floor) => {
    for (let pos = 1; pos <= numberOfSlots; pos += 1) {
      slots.push({
        floor_number: floor.floorNumber,
        position: pos,
        product_id: null,
        status: 'volno',
      });
    }
  });
  return slots;
}

/* ------------------------------------------------------------------ */
/* Hlavní komponenta                                                  */
/* ------------------------------------------------------------------ */
export default function ShelfConfiguratorModal({
  open = false,
  onClose,
  shelf,
  onSubmit,
  templateSettings,
}) {
  /* --------------------- Možnosti výšky pater ----------------------- */
  const baseFloorHeights = [2.5, 3.0, 3.5];
  const dataFloorHeights = (shelf.floors || [])
    .map((f) => Number(f.height))
    .filter(Boolean);
  const templateFloorHeights =
    templateSettings?.floor_heights?.map(Number) || [];
  const floorHeightOptions = [
    ...baseFloorHeights,
    ...templateFloorHeights,
    ...dataFloorHeights,
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)
    .map((h) => ({ label: `${h} m`, value: h }));

  /* --------------------- Možnosti šířky sekcí ----------------------- */
  const baseSectionWidths = [1.0, 1.5];
  const dataSectionWidths = (shelf.sections || [])
    .map((s) => Number(s.width))
    .filter(Boolean);
  const templateSectionWidths =
    templateSettings?.section_widths?.map(Number) || [];
  const sectionWidthOptions = [
    ...baseSectionWidths,
    ...templateSectionWidths,
    ...dataSectionWidths,
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)
    .map((w) => ({ label: `${w} m`, value: w }));

  /* ------------------- Transformace vstupních dat ------------------- */
  const toFloors = (data) =>
    !data || data.length === 0
      ? [{ floorNumber: 1, height: floorHeightOptions[0].value }]
      : data.map((f) => ({
          floorNumber: f.floorNumber ?? f.floor_number,
          height: f.height,
        }));

  const defaultFloors = toFloors(shelf.floors);

  const toSections = (sections, floors) =>
    (sections || []).map((sec) =>
      sec.palletSlots && sec.palletSlots.length
        ? sec
        : {
            ...sec,
            palletSlots: generatePalletSlotsForFloors(
              floors,
              sec.numberOfPalletSlots || 0
            ),
          }
    );

  const defaultSections = toSections(shelf.sections, defaultFloors);

  /* ---------------------------- Formik ------------------------------ */
  const initialValues = {
    shelfName: shelf.name ?? '',
    floors: defaultFloors,
    floorCount: defaultFloors.length,
    globalFloorHeight: defaultFloors[0].height,
    applyGlobal: false,
    sectionCount: defaultSections.length,
    sections: defaultSections,
  };

  /* --------------- Stavy a debounce pro vyhledávání ----------------- */
  const [searchLoading, setSearchLoading] = useState(false);
  const [productOptions, setProductOptions] = useState([]);
  const debounceTimer = useRef(null);

  const debouncedSearch = (query) => {
    if (!query || query.length < 2) {
      setProductOptions([]);
      return;
    }
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchProducts(query.trim());
        setProductOptions(res);
      } catch (err) {
        console.error('Chyba při vyhledávání produktů:', err);
        setProductOptions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  };

  /* ---------------------- Render JSX ------------------------------- */
  return (
    <Modal open={Boolean(open)} onClose={onClose} keepMounted>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>
          Konfigurace regálu: {shelf.name}
        </Typography>

        <Formik
          initialValues={initialValues}
          enableReinitialize
          onSubmit={(values) => {
            const updatedSections = values.sections.map((sec) => ({
              ...sec,
              palletSlots: generatePalletSlotsForFloors(
                values.floors,
                sec.numberOfPalletSlots || 0
              ),
            }));
            onSubmit({
              shelfId: shelf.id,
              buildingId: shelf.building_id,
              shelfName: values.shelfName,
              floors: values.floors,
              sections: updatedSections,
            });
            onClose();
          }}
        >
          {({ values, handleChange, setFieldValue }) => {
            /* ----------- Dynamic helpers (patra / sekce) --------------- */
            const handleFloorCountChange = (e) => {
              const count = Number(e.target.value);
              if (Number.isNaN(count) || count < 0) return;
              const cur = values.floors;
              if (count > cur.length) {
                const add = Array.from({ length: count - cur.length }, (_, i) => ({
                  floorNumber: cur.length + i + 1,
                  height: values.globalFloorHeight,
                }));
                setFieldValue('floors', [...cur, ...add]);
              } else {
                setFieldValue('floors', cur.slice(0, count));
              }
              setFieldValue('floorCount', count);
            };

            const handleSectionCountChange = (e) => {
              const count = Number(e.target.value);
              if (Number.isNaN(count) || count < 0) return;
              const cur = values.sections;
              if (count > cur.length) {
                const add = Array.from({ length: count - cur.length }, (_, i) => ({
                  name: `Sekce ${cur.length + i + 1}`,
                  width: sectionWidthOptions[0].value,
                  numberOfPalletSlots: 0,
                  palletSlots: [],
                }));
                setFieldValue('sections', [...cur, ...add]);
              } else {
                setFieldValue('sections', cur.slice(0, count));
              }
              setFieldValue('sectionCount', count);
            };

            const applyGlobalHeight = () => {
              setFieldValue(
                'floors',
                values.floors.map((f) => ({ ...f, height: values.globalFloorHeight }))
              );
            };

            /* ------------ Při výběru produktu u slotu ------------------ */
            const handleSelectProduct = async (secIdx, slotIdx, product) => {
              const base = `sections.${secIdx}.palletSlots.${slotIdx}`;
              setFieldValue(`${base}.product_id`, product?.Kod_produktu2 || '');
              setFieldValue(`${base}.status`, product ? 'obsazeno' : 'volno');
              const slotId = values.sections?.[secIdx]?.palletSlots?.[slotIdx]?.id;
              if (slotId) {
                try {
                  await assignProductToSlot(slotId, product ? product.Kod_produktu2 : null);
                } catch (err) {
                  console.error('Chyba při přiřazení produktu k slotu:', err);
                }
              }
            };

            /* ---------------------- JSX návrat ------------------------- */
            return (
              <Form>
                {/* Název regálu */}
                <TextField
                  label="Název regálu"
                  name="shelfName"
                  value={values.shelfName}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                />

                {/* Počet pater */}
                <Typography variant="subtitle1" sx={{ mt: 2 }}>
                  Počet pater
                </Typography>
                <TextField
                  name="floorCount"
                  type="number"
                  value={values.floorCount}
                  onChange={handleFloorCountChange}
                  fullWidth
                  margin="normal"
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      name="applyGlobal"
                      checked={values.applyGlobal}
                      onChange={handleChange}
                    />
                  }
                  label="Použít jednotnou výšku pro všechna patra"
                />

                {values.applyGlobal && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Select
                      name="globalFloorHeight"
                      value={values.globalFloorHeight}
                      onChange={handleChange}
                      sx={{ mr: 2, minWidth: 120 }}
                    >
                      {floorHeightOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button variant="outlined" onClick={applyGlobalHeight}>
                      Aplikovat
                    </Button>
                  </Box>
                )}

                {/* Tabulka pater */}
                <Typography variant="subtitle1">Patera</Typography>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Patro</TableCell>
                        <TableCell>Výška</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {values.floors.map((floor, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{floor.floorNumber}</TableCell>
                          <TableCell>
                            <Select
                              fullWidth
                              name={`floors.${idx}.height`}
                              value={floor.height}
                              onChange={handleChange}
                            >
                              {floorHeightOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Počet sekcí */}
                <Typography variant="subtitle1">Počet sekcí</Typography>
                <TextField
                  name="sectionCount"
                  type="number"
                  value={values.sectionCount}
                  onChange={handleSectionCountChange}
                  fullWidth
                  margin="normal"
                />

                {/* Sekce */}
                <Typography variant="subtitle1" sx={{ mt: 2 }}>
                  Sekce
                </Typography>
                <FieldArray name="sections">
                  {() =>
                    values.sections.map((section, secIdx) => (
                      <Box
                        key={secIdx}
                        mb={2}
                        p={1}
                        border={1}
                        borderColor="grey.300"
                        borderRadius={2}
                      >
                        <Typography variant="subtitle2">Sekce {secIdx + 1}</Typography>

                        <TextField
                          label="Název sekce"
                          name={`sections.${secIdx}.name`}
                          value={section.name}
                          onChange={handleChange}
                          fullWidth
                          variant="standard"
                        />

                        <Select
                          fullWidth
                          name={`sections.${secIdx}.width`}
                          value={section.width}
                          onChange={handleChange}
                          variant="standard"
                          sx={{ mb: 1 }}
                        >
                          {sectionWidthOptions.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>

                        <TextField
                          label="Paletových míst"
                          name={`sections.${secIdx}.numberOfPalletSlots`}
                          type="number"
                          value={section.numberOfPalletSlots ?? ''}
                          onChange={handleChange}
                          fullWidth
                          variant="standard"
                        />

                        {/* Sloty */}
                        {section.palletSlots?.length > 0 && (
                          <TableContainer component={Paper} sx={{ mt: 1 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Floor</TableCell>
                                  <TableCell>Position</TableCell>
                                  <TableCell>Product</TableCell>
                                  <TableCell>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {section.palletSlots.map((slot, slotIdx) => (
                                  <TableRow key={slotIdx}>
                                    <TableCell>
                                      <TextField
                                        variant="standard"
                                        name={`sections.${secIdx}.palletSlots.${slotIdx}.floor_number`}
                                        type="number"
                                        value={slot.floor_number}
                                        onChange={handleChange}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <TextField
                                        variant="standard"
                                        name={`sections.${secIdx}.palletSlots.${slotIdx}.position`}
                                        type="number"
                                        value={slot.position}
                                        onChange={handleChange}
                                      />
                                    </TableCell>
                                    <TableCell sx={{ minWidth: 200 }}>
                                      <Autocomplete
                                        size="small"
                                        freeSolo
                                        loading={searchLoading}
                                        options={productOptions}
                                        getOptionLabel={(opt) =>
                                          opt.Kod_produktu2
                                            ? `${opt.Kod_produktu2} – ${opt.Nazev}`
                                            : opt
                                        }
                                        value={
                                          slot.product_id
                                            ? {
                                                Kod_produktu2: slot.product_id,
                                                Nazev: '',
                                              }
                                            : null
                                        }
                                        onInputChange={(_, newInput) =>
                                          debouncedSearch(newInput)
                                        }
                                        onChange={(_, newVal) =>
                                          handleSelectProduct(secIdx, slotIdx, newVal)
                                        }
                                        renderInput={(params) => (
                                          <TextField
                                            {...params}
                                            variant="standard"
                                            placeholder="kód / název"
                                            InputProps={{
                                              ...params.InputProps,
                                              endAdornment: (
                                                <>
                                                  {searchLoading ? (
                                                    <CircularProgress size={16} />
                                                  ) : null}
                                                  {params.InputProps.endAdornment}
                                                </>
                                              ),
                                            }}
                                          />
                                        )}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        variant="standard"
                                        name={`sections.${secIdx}.palletSlots.${slotIdx}.status`}
                                        value={slot.status}
                                        onChange={handleChange}
                                      >
                                        <MenuItem value="volno">Volno</MenuItem>
                                        <MenuItem value="obsazeno">Obsazeno</MenuItem>
                                        <MenuItem value="rezervovano">
                                          Rezervováno
                                        </MenuItem>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </Box>
                    ))
                  }
                </FieldArray>

                {/* Tlačítka */}
                <Box display="flex" justifyContent="flex-end" mt={2}>
                  <Button onClick={onClose} sx={{ mr: 2 }}>
                    Zrušit
                  </Button>
                  <Button type="submit" variant="contained" color="primary">
                    Uložit konfiguraci
                  </Button>
                </Box>
              </Form>
            );
          }}
        </Formik>
      </Box>
    </Modal>
  );
}
