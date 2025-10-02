import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Box,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import axios from 'axios';

const AddTyreModal = ({ open, onClose, locationId, tyreLabel, tyreData }) => {
  const [manufacturers, setManufacturers] = useState([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [selectedPattern, setSelectedPattern] = useState('');
  const [loadIndexes, setLoadIndexes] = useState([]);
  const [selectedLoadIndex, setSelectedLoadIndex] = useState('');
  const [speedIndexes, setSpeedIndexes] = useState([]);
  const [selectedSpeedIndex, setSelectedSpeedIndex] = useState('');
  const [tyreNo, setTyreNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    'Vyberte výrobce',
    'Vyberte dezén',
    'Vyberte index nosnosti',
    'Vyberte rychlostní index',
    'Zadejte sériové číslo pneumatiky'
  ];

  useEffect(() => {
    const fetchManufacturers = async () => {
      if (!tyreData.tyreSize || !tyreData.tyreProfil || !tyreData.tyreRim) {
        setError(
          `Šířka, profil a průměr pneumatiky musí být zadány. Zadané hodnoty: TyreSize=${tyreData.tyreSize}, TyreProfil=${tyreData.tyreProfil}, TyreRim=${tyreData.tyreRim}`
        );
        return;
      }

      const formattedRim = parseFloat(
        tyreData.tyreRim.replace('R', '').replace(',', '.')
      ).toFixed(2);

      setLoading(true);
      setError('');
      try {
        console.log(
          `Načítání výrobců: width=${tyreData.tyreSize}, profile=${tyreData.tyreProfil}, diameter=${formattedRim}`
        );
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/getManufacturers`,
          {
            params: {
              width: tyreData.tyreSize,
              profile: tyreData.tyreProfil,
              diameter: formattedRim
            }
          }
        );
        console.log('Výrobci načteni:', response.data);
        setManufacturers(
          response.data.sort((a, b) =>
            a.Manufacturer.localeCompare(b.Manufacturer)
          )
        );
      } catch (error) {
        console.error('Chyba při načítání výrobců:', error);
        setError('Chyba při načítání výrobců');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchManufacturers();
    }
  }, [open, tyreData]);

  useEffect(() => {
    const fetchPatterns = async () => {
      if (!selectedManufacturer) return;

      const formattedRim = parseFloat(
        tyreData.tyreRim.replace('R', '').replace(',', '.')
      ).toFixed(2);

      setLoading(true);
      setError('');
      try {
        console.log(
          `Načítání dezénů: width=${tyreData.tyreSize}, profile=${tyreData.tyreProfil}, diameter=${formattedRim}, manufacturer=${selectedManufacturer}`
        );
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/getPatterns`,
          {
            params: {
              width: tyreData.tyreSize,
              profile: tyreData.tyreProfil,
              diameter: formattedRim,
              manufacturer: selectedManufacturer
            }
          }
        );
        console.log('Dezény načteny:', response.data);
        setPatterns(response.data);
      } catch (error) {
        console.error('Chyba při načítání dezénů:', error);
        setError('Chyba při načítání dezénů');
      } finally {
        setLoading(false);
      }
    };

    if (selectedManufacturer) {
      fetchPatterns();
    }
  }, [selectedManufacturer, tyreData]);

  useEffect(() => {
    const fetchLoadIndexes = async () => {
      if (!selectedPattern) return;

      const formattedRim = parseFloat(
        tyreData.tyreRim.replace('R', '').replace(',', '.')
      ).toFixed(2);

      setLoading(true);
      setError('');
      try {
        console.log(
          `Načítání indexů nosnosti: width=${tyreData.tyreSize}, profile=${tyreData.tyreProfil}, diameter=${formattedRim}, manufacturer=${selectedManufacturer}, pattern=${selectedPattern}`
        );
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/getLoadIndexes`,
          {
            params: {
              width: tyreData.tyreSize,
              profile: tyreData.tyreProfil,
              diameter: formattedRim,
              manufacturer: selectedManufacturer,
              pattern: selectedPattern
            }
          }
        );
        console.log('Indexy nosnosti načteny:', response.data);
        setLoadIndexes(response.data);
      } catch (error) {
        console.error('Chyba při načítání indexů nosnosti:', error);
        setError('Chyba při načítání indexů nosnosti');
      } finally {
        setLoading(false);
      }
    };

    if (selectedPattern) {
      fetchLoadIndexes();
    }
  }, [selectedPattern, tyreData]);

  useEffect(() => {
    const fetchSpeedIndexes = async () => {
      if (!selectedLoadIndex) return;

      const formattedRim = parseFloat(
        tyreData.tyreRim.replace('R', '').replace(',', '.')
      ).toFixed(2);

      setLoading(true);
      setError('');
      try {
        console.log(
          `Načítání rychlostních indexů: width=${tyreData.tyreSize}, profile=${tyreData.tyreProfil}, diameter=${formattedRim}, manufacturer=${selectedManufacturer}, pattern=${selectedPattern}, loadIndex=${selectedLoadIndex}`
        );
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/getSpeedIndexes`,
          {
            params: {
              width: tyreData.tyreSize,
              profile: tyreData.tyreProfil,
              diameter: formattedRim,
              manufacturer: selectedManufacturer,
              pattern: selectedPattern,
              loadIndex: selectedLoadIndex
            }
          }
        );
        console.log('Rychlostní indexy načteny:', response.data);
        setSpeedIndexes(response.data);
      } catch (error) {
        console.error('Chyba při načítání rychlostních indexů:', error);
        setError('Chyba při načítání rychlostních indexů');
      } finally {
        setLoading(false);
      }
    };

    if (selectedLoadIndex) {
      fetchSpeedIndexes();
    }
  }, [selectedLoadIndex, tyreData]);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    try {
      const formattedRim = parseFloat(
        tyreData.tyreRim.replace('R', '').replace(',', '.')
      ).toFixed(2);

      const formattedLoadIndex = selectedLoadIndex.includes('/')
        ? selectedLoadIndex
        : `${selectedLoadIndex}/${selectedLoadIndex}`;
      const formattedSpeedIndex = selectedSpeedIndex.includes('/')
        ? selectedSpeedIndex
        : `${selectedSpeedIndex}/${selectedSpeedIndex}`;

      console.log(
        `Načítání pneumatiky: width=${tyreData.tyreSize}, profile=${tyreData.tyreProfil}, diameter=${formattedRim}, manufacturer=${selectedManufacturer}, pattern=${selectedPattern}, loadIndex=${formattedLoadIndex}, speedIndex=${formattedSpeedIndex}`
      );
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/getTires`,
        {
          params: {
            width: tyreData.tyreSize,
            profile: tyreData.tyreProfil,
            diameter: formattedRim,
            manufacturer: selectedManufacturer,
            pattern: selectedPattern,
            loadIndex: formattedLoadIndex,
            speedIndex: formattedSpeedIndex
          }
        }
      );

      const partNo = response.data.PartNo;
      console.log('Pneumatika načtena:', partNo);

      await axios.post(`${process.env.REACT_APP_API_URL}/updateTire`, {
        tyreLabel,
        partNo,
        RZ: tyreData.RZ,
        tyreNo
      });

      onClose();
    } catch (error) {
      console.error('Chyba při načítání nebo aktualizaci pneumatiky:', error);
      alert('Chyba při načítání nebo aktualizaci pneumatiky');
    }
  };

  const getDialogTitle = () => {
    let title = selectedManufacturer || 'Přidat pneu';

    if (tyreData.tyreSize && tyreData.tyreProfil && tyreData.tyreRim) {
      title += ` ${tyreData.tyreSize}/${tyreData.tyreProfil} ${tyreData.tyreRim}`;
    }

    if (selectedPattern) {
      title += ` ${selectedPattern}`;
    }

    if (selectedLoadIndex) {
      title += ` ${selectedLoadIndex}`;
    }

    if (selectedSpeedIndex) {
      title += ` ${selectedSpeedIndex}`;
    }

    return title;
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label, index) => (
            <Step key={index}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box color="red">{error}</Box>
        ) : (
          <>
            {activeStep === 0 && (
              <TextField
                select
                label="Výrobce"
                value={selectedManufacturer}
                onChange={(e) => {
                  setSelectedManufacturer(e.target.value);
                  handleNext();
                }}
                fullWidth
                margin="normal"
              >
                {manufacturers.map((manufacturer, index) => (
                  <MenuItem key={index} value={manufacturer.Manufacturer}>
                    {manufacturer.Manufacturer}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {activeStep === 1 && (
              <TextField
                select
                label="Dezén"
                value={selectedPattern}
                onChange={(e) => {
                  setSelectedPattern(e.target.value);
                  handleNext();
                }}
                fullWidth
                margin="normal"
              >
                {patterns.map((pattern, index) => (
                  <MenuItem key={index} value={pattern.Pattern}>
                    {pattern.Pattern}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {activeStep === 2 && (
              <TextField
                select
                label="Index nosnosti"
                value={selectedLoadIndex}
                onChange={(e) => {
                  setSelectedLoadIndex(e.target.value);
                  handleNext();
                }}
                fullWidth
                margin="normal"
              >
                {loadIndexes.map((loadIndex, index) => (
                  <MenuItem key={index} value={loadIndex}>
                    {loadIndex}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {activeStep === 3 && (
              <TextField
                select
                label="Rychlostní index"
                value={selectedSpeedIndex}
                onChange={(e) => {
                  setSelectedSpeedIndex(e.target.value);
                  handleNext();
                }}
                fullWidth
                margin="normal"
              >
                {speedIndexes.map((speedIndex, index) => (
                  <MenuItem key={index} value={speedIndex}>
                    {speedIndex}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {activeStep === 4 && (
              <TextField
                label="Sériové číslo pneumatiky"
                value={tyreNo}
                onChange={(e) => setTyreNo(e.target.value)}
                fullWidth
                margin="normal"
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        {activeStep > 0 && <Button onClick={handleBack}>Zpět</Button>}
        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext}>Další</Button>
        ) : (
          <Button onClick={handleSubmit} color="primary">
            Odeslat
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddTyreModal;
