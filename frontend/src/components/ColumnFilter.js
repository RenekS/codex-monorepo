// ColumnFilter.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TextField, IconButton, Menu, MenuItem, ListItemText } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

function ColumnFilter({ filterName, initialValue, onChange, filterType = 'local' }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [filterValue, setFilterValue] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const paramValue = searchParams.get(filterName);
    if (paramValue) {
      setFilterValue(paramValue);
    } else {
      setFilterValue('');
    }
  }, [filterName, location.search]);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSearch = () => {
    const value = filterValue.trim();
    const searchParams = new URLSearchParams(location.search);
    if (value) {
      searchParams.set(filterName, value);
    } else {
      searchParams.delete(filterName);
    }
    navigate(`${location.pathname}?${searchParams.toString()}`);
    onChange(filterName, value, filterType);
    handleMenuClose();
  };

  const handleClearFilter = () => {
    setFilterValue('');
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete(filterName);
    navigate(`${location.pathname}?${searchParams.toString()}`);
    onChange(filterName, '', filterType);
  };

  return (
    <div>
      <IconButton onClick={handleMenuClick} size="small">
        <FilterListIcon fontSize="small" />
      </IconButton>
      {filterValue && (
        <IconButton onClick={handleClearFilter} size="small" color="secondary">
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
      <Menu
        id="filter-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem>
          <ListItemText>
            <TextField
              size="small"
              label="Filtr"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              fullWidth
              variant="outlined"
            />
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSearch}>
          <ListItemText primary="Použít" />
        </MenuItem>
      </Menu>
    </div>
  );
}

export default ColumnFilter;
