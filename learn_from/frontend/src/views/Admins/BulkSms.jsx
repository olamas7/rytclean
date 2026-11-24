import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
  Checkbox,
  Button,
  Box,
  Pagination,
  Autocomplete,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import axios from 'axios';
import { Delete, Save, Search, Send } from '@mui/icons-material';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import { ConfirmDialog } from 'utils/controls/confirmation';

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover
  },
  // hide last border
  '& > td, & > th': {
    border: 0
  }
}));

const BulkSms = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [hostelOptions, setHostelOptions] = useState([]);
  const [selectedHostels, setSelectedHostels] = useState([]);
  const [message, setMessage] = useState('');
  const [savedMessages, setSavedMessages] = useState([]);
  const [templateTitle, setTemplateTitle] = useState('');
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetching all clients for SMS (includes all roles)
      // The server-side now groups by phone to avoid duplicates
      const response = await axios.get(`/api/api/admins/all-clients-for-sms`);
      setClients(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch clients.');
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHostels = async () => {
    try {
      const response = await axios.get('/api/login/hostels');
      if (response.data.code === 1) {
        setHostelOptions(response.data.data.map((hostel) => ({ id: hostel.id, label: hostel.name })));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch hostels.');
      console.error('Error fetching hostels:', err);
    }
  };

  const fetchSavedMessages = async () => {
    try {
      const response = await axios.get('/api/api/admins/sms-templates');
      setSavedMessages(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch saved messages.');
      console.error('Error fetching saved messages:', err);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchHostels();
    fetchSavedMessages();
  }, []);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const selectedHostelNames = selectedHostels.map((hostel) => hostel.label);
  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      (client.username && client.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.fullname && client.fullname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.phone && client.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesHostel = selectedHostelNames.length === 0 || selectedHostelNames.includes(client.hostel);

    return matchesSearch && matchesHostel;
  });
  const pageCount = Math.max(Math.ceil(filteredClients.length / rowsPerPage), 1);
  const paginatedClients = filteredClients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const selectedFilteredClientsCount = filteredClients.filter((client) => selectedClients.includes(client.phone)).length;

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  const handleHostelsChange = (event, newValue) => {
    setSelectedHostels(newValue);
    setPage(0);
  };

  const handleSelectAllClick = (event) => {
    const filteredPhones = filteredClients.map((client) => client.phone);

    if (event.target.checked) {
      setSelectedClients([...new Set([...selectedClients, ...filteredPhones])]);
      return;
    }

    setSelectedClients(selectedClients.filter((phone) => !filteredPhones.includes(phone)));
  };

  const handleClick = (event, phone) => {
    const selectedIndex = selectedClients.indexOf(phone);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedClients, phone);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedClients.slice(1));
    } else if (selectedIndex === selectedClients.length - 1) {
      newSelected = newSelected.concat(selectedClients.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selectedClients.slice(0, selectedIndex), selectedClients.slice(selectedIndex + 1));
    }

    setSelectedClients(newSelected);
  };

  const isSelected = (phone) => selectedClients.indexOf(phone) !== -1;

  const handleSendClick = () => {
    if (selectedClients.length === 0) {
      setError('Please select at least one client.');
      return;
    }
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }
    setOpenConfirmDialog(true);
  };

  const handleOpenTemplateDialog = () => {
    if (!message.trim()) {
      setError('Please enter a message before saving it.');
      return;
    }

    setTemplateTitle('');
    setOpenTemplateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim()) {
      setError('Please enter a short title for this saved message.');
      return;
    }

    try {
      const response = await axios.post('/api/api/admins/sms-templates', {
        title: templateTitle,
        message
      });
      setSavedMessages((prev) => [response.data.template, ...prev]);
      setSuccess(response.data.message || 'Message saved successfully.');
      setOpenTemplateDialog(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save message.');
    }
  };

  const handleUseTemplate = (templateMessage) => {
    setMessage(templateMessage);
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      const response = await axios.delete(`/api/api/admins/sms-templates/${templateId}`);
      setSavedMessages((prev) => prev.filter((template) => template.id !== templateId));
      setSuccess(response.data.message || 'Saved message deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete saved message.');
    }
  };

  const handleConfirmSend = async () => {
    setOpenConfirmDialog(false);
    setSending(true);
    try {
      // Find full client objects for selected phones
      const recipientsData = clients
        .filter((c) => selectedClients.includes(c.phone))
        .map((c) => ({
          phone: c.phone,
          username: c.username,
          fullname: c.fullname
        }));

      const response = await axios.post(`/api/api/admins/send-bulk-sms`, {
        recipients: recipientsData,
        message: message
      });
      setSuccess(response.data.message || 'Messages sent successfully!');
      setMessage(''); // Clear message after success
      setSelectedClients([]); // Clear selection after success
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send messages.');
      console.error('Error sending SMS:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">Bulk SMS Messaging</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <ConfirmDialog
        open={openConfirmDialog}
        handleClose={() => setOpenConfirmDialog(false)}
        onConfirm={handleConfirmSend}
        message={`Are you sure you want to send this message to ${selectedClients.length} recipients?`}
        title="Confirm Send SMS"
        confirmButton="Yes, Send"
      />

      <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Save Message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            label="Template Title"
            value={templateTitle}
            onChange={(event) => setTemplateTitle(event.target.value)}
            placeholder="e.g. Maintenance Notice"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField fullWidth multiline minRows={4} label="Message Preview" value={message} InputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTemplateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTemplate} startIcon={<Save />}>
            Save Template
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={3}>
        {/* Message Composition Area */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h4" gutterBottom>
              Compose Message
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Button size="small" onClick={() => setMessage((prev) => prev + ' {username} ')} sx={{ mr: 1 }}>
                Insert Phone Number
              </Button>
              <Button size="small" onClick={() => setMessage((prev) => prev + ' {fullname} ')}>
                Insert Fullname
              </Button>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              label="Message Content"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here... Use {username} for phone number and {fullname} as placeholders."
              sx={{ mb: 2 }}
            />
            <Typography variant="caption" display="block" sx={{ mb: 2, textAlign: 'right' }}>
              {message.length} characters
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <Send />}
              onClick={handleSendClick}
              disabled={sending || selectedClients.length === 0 || !message.trim()}
            >
              {sending ? 'Sending...' : `Send to ${selectedClients.length} Recipients`}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<Save />}
              onClick={handleOpenTemplateDialog}
              disabled={!message.trim()}
              sx={{ mt: 1.5 }}
            >
              Save Message
            </Button>

            <Box sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h5">Saved Messages</Typography>
                <Chip label={savedMessages.length} size="small" />
              </Stack>
              <TableContainer sx={{ maxHeight: 230, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Preview</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {savedMessages.length > 0 ? (
                      savedMessages.map((template) => (
                        <TableRow key={template.id} hover>
                          <TableCell>{template.title}</TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {template.message.length > 45 ? `${template.message.slice(0, 45)}...` : template.message}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleUseTemplate(template.message)}>
                              Use
                            </Button>
                            <Tooltip title="Delete saved message">
                              <IconButton size="small" color="error" onClick={() => handleDeleteTemplate(template.id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          <Typography variant="caption" color="text.secondary">
                            No saved messages yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Client Selection Table */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Grid item xs={12} md={3}>
                <Typography variant="h4">Select Recipients</Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Autocomplete
                  multiple
                  size="small"
                  options={hostelOptions}
                  value={selectedHostels}
                  onChange={handleHostelsChange}
                  getOptionLabel={(option) => option.label || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => <Chip key={option.id} label={option.label} size="small" {...getTagProps({ index })} />)
                  }
                  renderInput={(params) => <TextField {...params} label="Filter by Hostel" placeholder="Select hostels" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="search"
                  label="Search Clients"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Search />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            </Grid>

            <TableContainer sx={{ maxHeight: 440 }}>
              <Table stickyHeader aria-label="sticky table">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedFilteredClientsCount > 0 && selectedFilteredClientsCount < filteredClients.length}
                        checked={filteredClients.length > 0 && selectedFilteredClientsCount === filteredClients.length}
                        onChange={handleSelectAllClick}
                        inputProps={{ 'aria-label': 'select all clients' }}
                      />
                    </TableCell>
                    <TableCell>Client Name</TableCell>
                    <TableCell>Hostel</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Phone Number</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : filteredClients.length > 0 ? (
                    paginatedClients.map((client) => {
                      const isItemSelected = isSelected(client.phone);
                      const labelId = `enhanced-table-checkbox-${client.phone}`;

                      return (
                        <StyledTableRow
                          hover
                          onClick={(event) => handleClick(event, client.phone)}
                          role="checkbox"
                          aria-checked={isItemSelected}
                          tabIndex={-1}
                          key={client.phone}
                          selected={isItemSelected}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={isItemSelected} inputProps={{ 'aria-labelledby': labelId }} />
                          </TableCell>
                          <TableCell component="th" id={labelId} scope="row">
                            {client.fullname}
                          </TableCell>
                          <TableCell>{client.hostel}</TableCell>
                          <TableCell>{client.phone}</TableCell>
                          <TableCell>{client.username}</TableCell>
                        </StyledTableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No clients found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Pagination
              count={pageCount}
              page={page + 1}
              onChange={handleChangePage}
              color="primary"
              showFirstButton
              showLastButton
              sx={{ display: 'flex', justifyContent: 'center', p: 2 }}
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary">
                {selectedClients.length} clients selected from {filteredClients.length} matching recipients
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      </MainCard>
    </>
  );
};

export default BulkSms;
