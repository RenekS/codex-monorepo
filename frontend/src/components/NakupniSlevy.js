// src/components/NakupniSlevy.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Importy z MUI
import {
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TableSortLabel,
  IconButton,
  Menu,
  MenuItem as MenuItemMenu
} from '@mui/material';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import SearchProductModal from './SearchProductModal';

function NakupniSlevy() {
  const [discounts, setDiscounts] = useState([]);
  const [groupedDiscounts, setGroupedDiscounts] = useState({});
  const [filters, setFilters] = useState({
    type: '',
    product_group_name: '',
    product_name: '',
    valid_from: '',
    valid_to: '',
    onlyActive: false
  });
  const [form, setForm] = useState({
    id: null,
    type: 'percentage',
    value: '',
    max_quantity: '',
    valid_from: '',
    valid_to: '',
    product_group_name: '',
    product_id: null,
    product_code: '',
    product_name: '',
    created_by: 1 // Příklad, změňte dle aktuálního uživatele
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [productGroups, setProductGroups] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProductGroup, setSelectedProductGroup] = useState('');
  const [orderBy, setOrderBy] = useState('valid_from');
  const [order, setOrder] = useState('asc');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedDiscount, setSelectedDiscount] = useState(null);

  // Načtení slev a produktových skupin z backendu
  useEffect(() => {
    fetchDiscounts();
    fetchProductGroups();
  }, [filters]);

  const fetchDiscounts = async () => {
    try {
      const params = { ...filters };
      if (filters.onlyActive) {
        const today = new Date().toISOString().split('T')[0];
        params.current_date = today;
      }
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-purchase-discounts`, { params });
      const data = response.data;

      // Seřazení a seskupení dat
      data.sort((a, b) => {
        if (a.product_group_name < b.product_group_name) return -1;
        if (a.product_group_name > b.product_group_name) return 1;
        if (a.type < b.type) return -1;
        if (a.type > b.type) return 1;
        return 0;
      });

      const grouped = data.reduce((groups, item) => {
        const groupKey = item.product_group_name || 'Neznámá skupina';
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
      }, {});

      setDiscounts(data);
      setGroupedDiscounts(grouped);
    } catch (error) {
      console.error('Error fetching purchase discounts:', error);
      alert('Chyba při načítání slev');
    }
  };

  const fetchProductGroups = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-product-groups`);
      setProductGroups(response.data);
    } catch (error) {
      console.error('Error fetching product groups:', error);
      alert('Chyba při načítání produktových skupin');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const newForm = { ...prev, [name]: value };
      if (name === 'type') {
        if (value === 'percentage') {
          newForm.product_id = null;
          newForm.product_code = '';
          newForm.product_name = '';
          newForm.product_group_name = '';
          setSelectedProductGroup('');
        } else if (value === 'net_price') {
          newForm.product_group_name = '';
          newForm.product_id = null;
          newForm.product_code = '';
          newForm.product_name = '';
          setSelectedProductGroup('');
        }
      }
      return newForm;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validace
    if (!form.type || !form.value || !form.valid_from || (!form.product_group_name && !form.product_id)) {
      alert('Prosím, vyplňte všechna povinná pole.');
      return;
    }

    // Data k odeslání na server
    const dataToSend = { ...form };
    dataToSend.product_group_name = form.type === 'percentage' ? form.product_group_name : selectedProductGroup;

    try {
      if (isEditing) {
        await axios.put(`${process.env.REACT_APP_API_URL}/update-purchase-discount/${form.id}`, dataToSend);
        alert('Sleva byla úspěšně aktualizována');
      } else {
        await axios.post(`${process.env.REACT_APP_API_URL}/create-purchase-discount`, dataToSend);
        alert('Sleva byla úspěšně vytvořena');
      }
      setShowForm(false);
      setIsEditing(false);
      fetchDiscounts();
      setForm({
        id: null,
        type: 'percentage',
        value: '',
        max_quantity: '',
        valid_from: '',
        valid_to: '',
        product_group_name: '',
        product_id: null,
        product_code: '',
        product_name: '',
        created_by: 1
      });
      setSelectedProductGroup('');
    } catch (error) {
      console.error('Error saving purchase discount:', error);
      alert('Chyba při ukládání slevy');
    }
  };

  const handleEdit = (discount) => {
    setForm({
      id: discount.id,
      type: discount.type,
      value: discount.value,
      max_quantity: discount.max_quantity || '',
      valid_from: discount.valid_from.split('T')[0],
      valid_to: discount.valid_to ? discount.valid_to.split('T')[0] : '',
      product_group_name: discount.product_group_name || '',
      product_id: discount.product_id || null,
      product_code: discount.product_id || '',
      product_name: discount.product_name || '',
      created_by: discount.created_by || 1
    });
    if (discount.type === 'net_price') {
      setSelectedProductGroup(discount.product_group_name || '');
    }
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Opravdu chcete tuto slevu odstranit?')) {
      try {
        await axios.delete(`${process.env.REACT_APP_API_URL}/delete-purchase-discount/${id}`);
        alert('Sleva byla úspěšně odstraněna');
        fetchDiscounts();
      } catch (error) {
        console.error('Error deleting purchase discount:', error);
        alert('Chyba při odstraňování slevy');
      }
    }
  };

  const handleAddNew = () => {
    setForm({
      id: null,
      type: 'percentage',
      value: '',
      max_quantity: '',
      valid_from: '',
      valid_to: '',
      product_group_name: '',
      product_id: null,
      product_code: '',
      product_name: '',
      created_by: 1
    });
    setSelectedProductGroup('');
    setIsEditing(false);
    setShowForm(true);
  };

  const openGroupModal = () => {
    setNewGroupName('');
    setShowGroupModal(true);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Název skupiny nesmí být prázdný.');
      return;
    }
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/create-product-group`, { name: newGroupName.trim() });
      alert('Produktová skupina byla úspěšně vytvořena.');
      fetchProductGroups();
      if (form.type === 'percentage') {
        setForm(prev => ({ ...prev, product_group_name: response.data.name }));
      } else {
        setSelectedProductGroup(response.data.name);
      }
      closeGroupModal();
    } catch (error) {
      console.error('Error creating product group:', error);
      alert('Chyba při vytváření produktové skupiny');
    }
  };

  const openProductModal = () => {
    if (!selectedProductGroup) {
      alert('Nejprve vyberte produktovou skupinu.');
      return;
    }
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
  };

  const handleSelectProduct = (product) => {
    setForm(prev => ({
      ...prev,
      product_id: product.ItemId,
      product_code: product.ItemId,
      product_name: product.ItemName
    }));
    setShowProductModal(false);
  };

  const handleShowHistory = async (productGroupName, productId) => {
    try {
      const params = {};
      if (productGroupName) {
        params.product_group_name = productGroupName;
      }
      if (productId) {
        params.product_id = productId;
      }
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-purchase-discounts`, {
        params
      });
      setHistory(response.data);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error fetching discount history:', error);
      alert('Chyba při načítání historie slev');
    }
  };

  const handleCloseHistoryModal = () => {
    setShowHistoryModal(false);
    setHistory([]);
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    setOrder(newOrder);
    setOrderBy(property);

    const sortedDiscounts = [...discounts].sort((a, b) => {
      if (a[property] < b[property]) return newOrder === 'asc' ? -1 : 1;
      if (a[property] > b[property]) return newOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setDiscounts(sortedDiscounts);

    // Aktualizace seskupených slev
    const grouped = sortedDiscounts.reduce((groups, item) => {
      const groupKey = item.product_group_name || 'Neznámá skupina';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {});
    setGroupedDiscounts(grouped);
  };

  return (
    <div className="container mt-4">
      <Typography variant="h4" gutterBottom>Správa Nákupních Slev</Typography>
      <div className="mb-3">
        <Button variant="contained" color="primary" onClick={handleAddNew}>Přidat Novou Slevu</Button>
      </div>

      {/* Filtrační Panel */}
      <Card className="mb-4">
        <CardHeader title="Filtry" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth style={{ marginLeft: 15 }}>
                <InputLabel id="filter-type-label">Typ Slevy</InputLabel>
                <Select
                  labelId="filter-type-label"
                  name="type"
                  value={filters.type}
                  onChange={handleFilterChange}
                  label="Typ Slevy"
                >
                  <MenuItem value=""><em>Vše</em></MenuItem>
                  <MenuItem value="percentage">Procentuální</MenuItem>
                  <MenuItem value="net_price">Netto Cena</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel id="filter-product-group-label">Produktová Skupina</InputLabel>
                <Select
                  labelId="filter-product-group-label"
                  name="product_group_name"
                  value={filters.product_group_name}
                  onChange={handleFilterChange}
                  label="Produktová Skupina"
                >
                  <MenuItem value=""><em>Vše</em></MenuItem>
                  {productGroups.map(group => (
                    <MenuItem key={group.id} value={group.name}>{group.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Produkt"
                name="product_name"
                value={filters.product_name || ''}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Platnost Od"
                type="date"
                name="valid_from"
                value={filters.valid_from}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Platnost Do"
                type="date"
                name="valid_to"
                value={filters.valid_to}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="onlyActive"
                    checked={filters.onlyActive}
                    onChange={handleFilterChange}
                  />
                }
                label="Jen aktivní"
                style={{ marginLeft: 15 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabulka Slev */}
      <Card>
        <CardHeader title="Seznam Nákupních Slev" />
        <CardContent>
          {Object.keys(groupedDiscounts).map(groupName => (
            <Accordion key={groupName} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{groupName}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer component={Paper}>
                  <Table aria-label="Seznam slev">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === 'id'}
                            direction={orderBy === 'id' ? order : 'asc'}
                            onClick={() => handleRequestSort('id')}
                          >
                            ID
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === 'type'}
                            direction={orderBy === 'type' ? order : 'asc'}
                            onClick={() => handleRequestSort('type')}
                          >
                            Typ Slevy
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Hodnota</TableCell>
                        <TableCell>Max. Množství</TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === 'valid_from'}
                            direction={orderBy === 'valid_from' ? order : 'asc'}
                            onClick={() => handleRequestSort('valid_from')}
                          >
                            Platnost Od
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={orderBy === 'valid_to'}
                            direction={orderBy === 'valid_to' ? order : 'asc'}
                            onClick={() => handleRequestSort('valid_to')}
                          >
                            Platnost Do
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Produkt</TableCell>
                        <TableCell>Marže 2_pult</TableCell>
                        <TableCell>Marže 3_vo</TableCell>
                        <TableCell>Akce</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupedDiscounts[groupName].map(discount => (
                        <TableRow
                          key={discount.id}
                          style={{
                            backgroundColor: discount.type === 'percentage' ? '#e3f2fd' : '#fce4ec'
                          }}
                        >
                          <TableCell>{discount.id}</TableCell>
                          <TableCell>{discount.type === 'percentage' ? 'Procentuální' : 'Netto Cena'}</TableCell>
                          <TableCell>{discount.type === 'percentage' ? `${discount.value}%` : `${discount.value} Kč`}</TableCell>
                          <TableCell>{discount.max_quantity || '-'}</TableCell>
                          <TableCell>{new Date(discount.valid_from).toLocaleDateString()}</TableCell>
                          <TableCell>{discount.valid_to ? new Date(discount.valid_to).toLocaleDateString() : 'Neomezená'}</TableCell>
                          <TableCell>
                            {discount.type === 'percentage' ? (
                              '-'
                            ) : (
                              <>
                                {discount.product_id} - {discount.product_name}
                              </>
                            )}
                          </TableCell>
                          <TableCell>{discount.margin_2_pult || '-'}</TableCell>
                          <TableCell>{discount.margin_3_vo || '-'}</TableCell>
                          <TableCell>
                            <IconButton
                              onClick={(event) => {
                                setMenuAnchorEl(event.currentTarget);
                                setSelectedDiscount(discount);
                              }}
                            >
                              <MoreVertIcon />
                            </IconButton>
                            <Menu
                              anchorEl={menuAnchorEl}
                              open={Boolean(menuAnchorEl) && selectedDiscount?.id === discount.id}
                              onClose={() => {
                                setMenuAnchorEl(null);
                                setSelectedDiscount(null);
                              }}
                            >
                              <MenuItemMenu onClick={() => {
                                handleShowHistory(discount.product_group_name, discount.product_id);
                                setMenuAnchorEl(null);
                                setSelectedDiscount(null);
                              }}>Historie</MenuItemMenu>
                              <MenuItemMenu onClick={() => {
                                handleEdit(discount);
                                setMenuAnchorEl(null);
                                setSelectedDiscount(null);
                              }}>Editovat</MenuItemMenu>
                              <MenuItemMenu onClick={() => {
                                handleDelete(discount.id);
                                setMenuAnchorEl(null);
                                setSelectedDiscount(null);
                              }}>Smazat</MenuItemMenu>
                            </Menu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>

      {/* Formulář pro Přidání/Editaci Slevy */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} fullWidth maxWidth="md">
        <DialogTitle>{isEditing ? 'Editovat Slevu' : 'Přidat Novou Slevu'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} style={{ marginTop: 8 }}>
            {/* První řádek */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="type-label">Typ Slevy</InputLabel>
                <Select
                  labelId="type-label"
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                  label="Typ Slevy"
                >
                  <MenuItem value="percentage">Procentuální</MenuItem>
                  <MenuItem value="net_price">Netto Cena</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={form.type === 'percentage' ? 'Procento (%)' : 'Cena (Kč)'}
                type="number"
                name="value"
                value={form.value}
                onChange={handleFormChange}
                required
                inputProps={{ min: 0 }}
              />
            </Grid>

            {/* Druhý řádek */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Platnost Od"
                type="date"
                name="valid_from"
                value={form.valid_from}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Platnost Do"
                type="date"
                name="valid_to"
                value={form.valid_to}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
                helperText="Nechte prázdné pro neomezenou platnost"
              />
            </Grid>

            {/* Třetí řádek */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max. Množství"
                type="number"
                name="max_quantity"
                value={form.max_quantity}
                onChange={handleFormChange}
                inputProps={{ min: 1 }}
                helperText="Maximální množství pro uplatnění slevy (kusově omezená sleva)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              {form.type === 'percentage' ? (
                <>
                  <FormControl fullWidth>
                    <InputLabel id="product-group-label">Produktová Skupina</InputLabel>
                    <Select
                      labelId="product-group-label"
                      name="product_group_name"
                      value={form.product_group_name}
                      onChange={handleFormChange}
                      label="Produktová Skupina"
                      required
                    >
                      <MenuItem value=""><em>Vyberte skupinu</em></MenuItem>
                      {productGroups.map(group => (
                        <MenuItem key={group.id} value={group.name}>{group.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="text" onClick={openGroupModal}>Přidat novou skupinu</Button>
                </>
              ) : (
                <>
                  <FormControl fullWidth>
                    <InputLabel id="product-group-label">Produktová Skupina</InputLabel>
                    <Select
                      labelId="product-group-label"
                      name="selectedProductGroup"
                      value={selectedProductGroup}
                      onChange={(e) => setSelectedProductGroup(e.target.value)}
                      label="Produktová Skupina"
                      required
                    >
                      <MenuItem value=""><em>Vyberte skupinu</em></MenuItem>
                      {productGroups.map(group => (
                        <MenuItem key={group.id} value={group.name}>{group.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="text" onClick={openGroupModal}>Přidat novou skupinu</Button>
                </>
              )}
            </Grid>

            {/* Pokud je typ slevy 'Netto cena', zobrazíme produktový kód a název na celou šířku */}
            {form.type === 'net_price' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Produkt"
                  name="product_name"
                  value={form.product_code && form.product_name ? `${form.product_code} - ${form.product_name}` : ''}
                  onClick={openProductModal}
                  InputProps={{
                    readOnly: true,
                  }}
                  required
                />
                {showProductModal && (
                  <SearchProductModal
                    isOpen={showProductModal}
                    onClose={closeProductModal}
                    onSelectItem={handleSelectProduct}
                    productGroup={selectedProductGroup}
                  />
                )}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowForm(false)} color="secondary">Zrušit</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {isEditing ? 'Uložit Změny' : 'Vytvořit Slevu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modální Okno pro Přidání Nové Produktové Skupiny */}
      <Dialog open={showGroupModal} onClose={closeGroupModal} fullWidth maxWidth="sm">
        <DialogTitle>Přidat Novou Produktovou Skupinu</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Název Skupiny"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            required
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGroupModal} color="secondary">Zrušit</Button>
          <Button onClick={handleAddGroup} variant="contained" color="primary">Přidat</Button>
        </DialogActions>
      </Dialog>

      {/* Modální Okno pro Zobrazení Historie Slev */}
      <Dialog open={showHistoryModal} onClose={handleCloseHistoryModal} fullWidth maxWidth="md">
        <DialogTitle>Historie Slev</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper}>
            <Table aria-label="Historie slev">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Typ Slevy</TableCell>
                  <TableCell>Hodnota</TableCell>
                  <TableCell>Max. Množství</TableCell>
                  <TableCell>Platnost Od</TableCell>
                  <TableCell>Platnost Do</TableCell>
                  <TableCell>Vytvořil</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map(discount => (
                  <TableRow key={discount.id}>
                    <TableCell>{discount.id}</TableCell>
                    <TableCell>{discount.type === 'percentage' ? 'Procentuální' : 'Netto Cena'}</TableCell>
                    <TableCell>{discount.type === 'percentage' ? `${discount.value}%` : `${discount.value} Kč`}</TableCell>
                    <TableCell>{discount.max_quantity || '-'}</TableCell>
                    <TableCell>{new Date(discount.valid_from).toLocaleDateString()}</TableCell>
                    <TableCell>{discount.valid_to ? new Date(discount.valid_to).toLocaleDateString() : 'Neomezená'}</TableCell>
                    <TableCell>{discount.created_by || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryModal} color="primary">Zavřít</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default NakupniSlevy;
