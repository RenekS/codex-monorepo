// WarehouseModal.jsx (upravený příklad s axios voláním)
import React from 'react';
import { Modal, Box, Button, TextField, Typography } from '@mui/material';
import { Formik, Form } from 'formik';
import { createWarehouse } from './warehouseService';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
};

function WarehouseModal({ open, onClose, onSuccess }) {
  const initialValues = {
    warehouseName: '',
    shelfCount: '',
  };

  const validate = (values) => {
    const errors = {};
    if (!values.warehouseName) {
      errors.warehouseName = 'Název skladu je povinný';
    }
    if (!values.shelfCount) {
      errors.shelfCount = 'Počet regálů je povinný';
    } else if (isNaN(values.shelfCount) || Number(values.shelfCount) <= 0) {
      errors.shelfCount = 'Zadejte platné číslo větší než 0';
    }
    return errors;
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>
          Přidat nový sklad
        </Typography>
        <Formik
          initialValues={initialValues}
          validate={validate}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const result = await createWarehouse(values.warehouseName, values.shelfCount);
              // Můžeš volitelně předat výsledek zpět parent komponentě
              if (onSuccess) onSuccess(result);
              onClose();
            } catch (error) {
              // Ošetři chybu dle potřeby
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting, values, errors, touched, handleChange, handleBlur }) => (
            <Form>
              <TextField
                label="Název skladu"
                name="warehouseName"
                value={values.warehouseName}
                onChange={handleChange}
                onBlur={handleBlur}
                fullWidth
                margin="normal"
                error={touched.warehouseName && Boolean(errors.warehouseName)}
                helperText={touched.warehouseName && errors.warehouseName}
              />
              <TextField
                label="Počet regálů"
                name="shelfCount"
                type="number"
                value={values.shelfCount}
                onChange={handleChange}
                onBlur={handleBlur}
                fullWidth
                margin="normal"
                error={touched.shelfCount && Boolean(errors.shelfCount)}
                helperText={touched.shelfCount && errors.shelfCount}
              />
              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
                  Uložit
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </Box>
    </Modal>
  );
}

export default WarehouseModal;
