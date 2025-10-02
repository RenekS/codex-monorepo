import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField
} from '@mui/material';
import BackspaceIcon from '@mui/icons-material/Backspace';
import ClearIcon      from '@mui/icons-material/Clear';
import CheckIcon      from '@mui/icons-material/Check';
import CloseIcon      from '@mui/icons-material/Close';

export default function NumberPad({ value, onSubmit, onSubmitAddition, onCancel }) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [additionMode, setAdditionMode] = useState(false);
  const [overwrite, setOverwrite] = useState(true);

  const handleButtonClick = char => {
    if (!additionMode && overwrite) {
      setInputValue(char.toString());
      setOverwrite(false);
    } else {
      setInputValue(prev => (prev === '0' ? char.toString() : prev + char.toString()));
    }
  };
  const handleClear = () => { setInputValue('0'); setOverwrite(true); };
  const handleBackspace = () => setInputValue(prev => {
    const newVal = prev.length > 1 ? prev.slice(0, -1) : '0';
    if (newVal === '0') setOverwrite(true);
    return newVal;
  });
  const handlePlusClick = () => { setAdditionMode(true); setInputValue('0'); setOverwrite(true); };
  const handleConfirm = () => {
    const num = parseInt(inputValue, 10);
    additionMode ? onSubmitAddition(num) : onSubmit(num);
    setOverwrite(true);
    setAdditionMode(false);
  };

  return (
    <Box sx={{
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 350 },
      p: 2, bgcolor: 'background.paper', boxShadow: 3,
      borderRadius: 2, zIndex: 1300
    }}>
      <TextField
        fullWidth
        value={inputValue}
        InputProps={{ readOnly: true }}
        variant="outlined"
        sx={{ mb: 2, fontSize: '1.5em' }}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <Button
                key={n}
                variant="contained"
                fullWidth
                sx={{ height: 60, fontSize: '1.5em' }}
                onClick={() => handleButtonClick(n)}
              >
                {n}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained" fullWidth
              sx={{ height: 60, fontSize: '1.5em' }}
              onClick={() => handleButtonClick(0)}
            >
              0
            </Button>
            <Button
              variant="contained" fullWidth
              sx={{
                height: 60, fontSize: '1.5em',
                bgcolor: additionMode ? 'primary.light' : 'primary.main',
                '&:hover': { bgcolor: additionMode ? 'primary.light' : 'primary.main' }
              }}
              onClick={handlePlusClick}
            >
              +
            </Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button variant="contained" fullWidth sx={{ height: 60 }} onClick={handleBackspace}>
            <BackspaceIcon fontSize="large" />
          </Button>
          <Button variant="contained" fullWidth sx={{ height: 60 }} onClick={handleClear}>
            <ClearIcon fontSize="large" />
          </Button>
          <Button
            variant="contained" fullWidth
            sx={{ height: 60, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
            onClick={handleConfirm}
          >
            <CheckIcon fontSize="large" />
          </Button>
          <Button
            variant="contained" fullWidth
            sx={{ height: 60, bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
            onClick={onCancel}
          >
            <CloseIcon fontSize="large" />
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
