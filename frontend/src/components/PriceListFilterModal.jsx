import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel, Box
} from '@mui/material';
import { Formik, Form } from 'formik';
import axios from 'axios';

const PriceListFilterModal = ({ open, onClose, onApply, initialValues = { filterId: '', isActive: true } }) => {
  const [filterTemplates, setFilterTemplates] = useState([]);

  const loadFilterTemplates = (isActive) => {
    axios.get(`${process.env.REACT_APP_API_URL}/filter-templates`, {
      params: { isActive }
    })
    .then((res) => setFilterTemplates(res.data))
    .catch((err) => console.error(err));
  };

  useEffect(() => {
    if (open) loadFilterTemplates(initialValues.isActive);
  }, [open, initialValues.isActive]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Filtr ceníků</DialogTitle>
      <Formik
        initialValues={{ filterId: '', isActive: true }}
        onSubmit={(values) => {
          onApply(values); // předáme pouze filtry bez volání endpointu
          onClose();
        }}
      >
        {({ values, handleChange, setFieldValue }) => (
          <Form>
            <DialogContent>
              <FormControlLabel
                control={
                  <Checkbox
                    name="isActive"
                    checked={values.isActive}
                    onChange={(e) => {
                      setFieldValue('isActive', e.target.checked);
                      loadFilterTemplates(e.target.checked);
                    }}
                  />
                }
                label="Aktivní"
              />
              <Box mt={2}>
                <FormControl fullWidth>
                  <InputLabel>Vyberte ceník</InputLabel>
                  <Select
  name="filterId"
  label="Vyberte ceník"
  value={values.filterId}
  onChange={handleChange}
>
  {filterTemplates.map((ft) => (
    <MenuItem key={ft.filterId} value={ft.filterId}>
      {ft.filterName}
    </MenuItem>
  ))}
</Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose}>Zrušit</Button>
              <Button type="submit" variant="contained">Použít filtry</Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default PriceListFilterModal;
