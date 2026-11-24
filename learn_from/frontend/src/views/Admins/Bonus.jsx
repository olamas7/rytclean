import React, { useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Delete, Redeem, Save, Search } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import { ConfirmDialog } from 'utils/controls/confirmation';
import { SnackError, SnackSuccess } from 'utils/Snackbars';

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover
  },
  '& > td, & > th': {
    border: 0
  }
}));

const Bonus = () => {
  const [recipients, setRecipients] = useState([]);
  const [hostelOptions, setHostelOptions] = useState([]);
  const [savedBonusTypes, setSavedBonusTypes] = useState([]);
  const [selectedHostels, setSelectedHostels] = useState([]);
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [bonusTitle, setBonusTitle] = useState('');
  const [bonusHours, setBonusHours] = useState('');
  const [message, setMessage] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [issueRequestRef, setIssueRequestRef] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const [recipientsResponse, hostelsResponse, templatesResponse] = await Promise.all([
        axios.get('/api/api/admins/bonus-recipients'),
        axios.get('/api/login/hostels'),
        axios.get('/api/api/admins/bonus-templates')
      ]);
      setRecipients(recipientsResponse.data || []);
      setHostelOptions(
        hostelsResponse.data.code === 1 ? hostelsResponse.data.data.map((hostel) => ({ id: hostel.id, label: hostel.name })) : []
      );
      setSavedBonusTypes(templatesResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load bonus data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  const selectedHostelNames = selectedHostels.map((hostel) => hostel.label);
  const filteredRecipients = recipients.filter((recipient) => {
    const hasActiveSubscription = Number(recipient.has_active_subscription) === 1;
    const matchesSubscription =
      subscriptionFilter === 'all' ||
      (subscriptionFilter === 'subscribers' && hasActiveSubscription) ||
      (subscriptionFilter === 'non-subscribers' && !hasActiveSubscription);
    const matchesHostel = selectedHostelNames.length === 0 || selectedHostelNames.includes(recipient.hostel);
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      recipient.username?.toLowerCase().includes(normalizedSearch) ||
      recipient.fullname?.toLowerCase().includes(normalizedSearch) ||
      recipient.phone?.toLowerCase().includes(normalizedSearch);

    return matchesSubscription && matchesHostel && matchesSearch;
  });

  const pageCount = Math.max(Math.ceil(filteredRecipients.length / rowsPerPage), 1);
  const paginatedRecipients = filteredRecipients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const selectedFilteredCount = filteredRecipients.filter((recipient) => selectedRecipients.includes(recipient.username)).length;

  const handleSelectAll = (event) => {
    const filteredUsernames = filteredRecipients.map((recipient) => recipient.username);

    if (event.target.checked) {
      setSelectedRecipients([...new Set([...selectedRecipients, ...filteredUsernames])]);
      return;
    }

    setSelectedRecipients(selectedRecipients.filter((username) => !filteredUsernames.includes(username)));
  };

  const handleRecipientClick = (username) => {
    setSelectedRecipients((current) =>
      current.includes(username) ? current.filter((value) => value !== username) : [...current, username]
    );
  };

  const handleFiltersChange = (callback) => {
    callback();
    setPage(0);
  };

  const isBonusValid = Number.isInteger(Number(bonusHours)) && Number(bonusHours) > 0 && bonusTitle.trim() && message.trim();

  const handleIssueClick = () => {
    if (!isBonusValid) {
      setError('Enter a bonus title, whole number of hours, and supporting message.');
      return;
    }
    if (selectedRecipients.length === 0) {
      setError('Select at least one recipient.');
      return;
    }
    if (!issueRequestRef) {
      setIssueRequestRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    }
    setOpenConfirmDialog(true);
  };

  const handleCancelIssue = () => {
    setOpenConfirmDialog(false);
    setIssueRequestRef('');
  };

  const handleIssueBonus = async () => {
    setOpenConfirmDialog(false);
    setIssuing(true);
    try {
      const response = await axios.post('/api/api/admins/issue-bonus', {
        usernames: selectedRecipients,
        title: bonusTitle,
        hours: Number(bonusHours),
        message,
        issuedBy: localStorage.getItem('userId'),
        requestRef: issueRequestRef
      });
      const skippedCount = response.data.skipped?.length || 0;
      setSuccess(`${response.data.message}${skippedCount ? ` ${skippedCount} recipient${skippedCount === 1 ? '' : 's'} skipped.` : ''}`);
      setSelectedRecipients([]);
      setIssueRequestRef('');
      await fetchPageData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to issue the bonus.');
    } finally {
      setIssuing(false);
    }
  };

  const handleOpenTemplateDialog = () => {
    if (!bonusHours || !message.trim()) {
      setError('Enter the bonus hours and message before saving a bonus type.');
      return;
    }
    setTemplateTitle(bonusTitle);
    setOpenTemplateDialog(true);
  };

  const handleSaveBonusType = async () => {
    if (!templateTitle.trim()) {
      setError('Enter a short title for this bonus type.');
      return;
    }

    try {
      const response = await axios.post('/api/api/admins/bonus-templates', {
        title: templateTitle,
        hours: Number(bonusHours),
        message
      });
      setSavedBonusTypes((current) => [response.data.template, ...current]);
      setBonusTitle(response.data.template.title);
      setSuccess(response.data.message || 'Bonus type saved successfully.');
      setOpenTemplateDialog(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save bonus type.');
    }
  };

  const handleUseBonusType = (template) => {
    setBonusTitle(template.title);
    setBonusHours(String(template.hours));
    setMessage(template.message);
  };

  const handleDeleteBonusType = async (templateId) => {
    try {
      const response = await axios.delete(`/api/api/admins/bonus-templates/${templateId}`);
      setSavedBonusTypes((current) => current.filter((template) => template.id !== templateId));
      setSuccess(response.data.message || 'Bonus type deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete bonus type.');
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">Bonus Issuance</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <ConfirmDialog
        open={openConfirmDialog}
        handleClose={handleCancelIssue}
        onConfirm={handleIssueBonus}
        title="Confirm Bonus Issuance"
        message={`Issue ${bonusHours} bonus hour${Number(bonusHours) === 1 ? '' : 's'} to ${selectedRecipients.length} selected recipient${selectedRecipients.length === 1 ? '' : 's'}?`}
        confirmButton="Yes, Issue Bonus"
      />

      <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Save Bonus Type</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            label="Bonus Type Title"
            value={templateTitle}
            onChange={(event) => setTemplateTitle(event.target.value)}
            placeholder="e.g. Weekend Appreciation"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField fullWidth label="Bonus Hours" value={bonusHours} InputProps={{ readOnly: true }} sx={{ mb: 2 }} />
          <TextField fullWidth multiline minRows={4} label="Message Preview" value={message} InputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTemplateDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleSaveBonusType}>
            Save Bonus Type
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h4" gutterBottom>
              Bonus Settings
            </Typography>
            <TextField
              fullWidth
              label="Bonus Title"
              value={bonusTitle}
              onChange={(event) => setBonusTitle(event.target.value)}
              placeholder="e.g. Weekend Appreciation"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Bonus Hours"
              value={bonusHours}
              onChange={(event) => setBonusHours(event.target.value)}
              inputProps={{ min: 1, step: 1 }}
              helperText="Whole hours to add to each selected account."
              sx={{ mb: 2 }}
            />
            <Box sx={{ mb: 1 }}>
              <Button size="small" onClick={() => setMessage((current) => `${current} {fullname} `)}>
                Insert Fullname
              </Button>
              <Button size="small" onClick={() => setMessage((current) => `${current} {expiryDate} `)}>
                Insert Expiry Date
              </Button>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={5}
              label="Bonus Message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Explain the bonus issued to the recipient."
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" display="block" sx={{ mb: 2, textAlign: 'right' }}>
              {message.length} characters
            </Typography>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Redeem />}
              disabled={issuing || !isBonusValid || selectedRecipients.length === 0}
              onClick={handleIssueClick}
            >
              {issuing ? 'Issuing...' : `Issue to ${selectedRecipients.length} Recipients`}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Save />}
              onClick={handleOpenTemplateDialog}
              disabled={!bonusHours || !message.trim()}
              sx={{ mt: 1.5 }}
            >
              Save Bonus Type
            </Button>

            <Box sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h5">Saved Bonus Types</Typography>
                <Chip label={savedBonusTypes.length} size="small" />
              </Stack>
              <TableContainer sx={{ maxHeight: 260, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {savedBonusTypes.length > 0 ? (
                      savedBonusTypes.map((template) => (
                        <TableRow key={template.id} hover>
                          <TableCell>
                            <Typography variant="body2">{template.title}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {template.message.length > 36 ? `${template.message.slice(0, 36)}...` : template.message}
                            </Typography>
                          </TableCell>
                          <TableCell>{template.hours}</TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleUseBonusType(template)}>
                              Use
                            </Button>
                            <Tooltip title="Delete bonus type">
                              <IconButton size="small" color="error" onClick={() => handleDeleteBonusType(template.id)}>
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
                            No saved bonus types yet.
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

        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} md={3}>
                <Typography variant="h4">Select Recipients</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="bonus-status-filter-label">Account Status</InputLabel>
                  <Select
                    labelId="bonus-status-filter-label"
                    label="Account Status"
                    value={subscriptionFilter}
                    onChange={(event) => handleFiltersChange(() => setSubscriptionFilter(event.target.value))}
                  >
                    <MenuItem value="all">All Clients</MenuItem>
                    <MenuItem value="subscribers">Active Subscribers</MenuItem>
                    <MenuItem value="non-subscribers">Non-Subscribers</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Autocomplete
                  multiple
                  size="small"
                  options={hostelOptions}
                  value={selectedHostels}
                  onChange={(event, values) => handleFiltersChange(() => setSelectedHostels(values))}
                  getOptionLabel={(option) => option.label || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderTags={(values, getTagProps) =>
                    values.map((option, index) => <Chip key={option.id} label={option.label} size="small" {...getTagProps({ index })} />)
                  }
                  renderInput={(params) => <TextField {...params} label="Filter by Hostel" placeholder="Select hostels" />}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Clients"
                  value={searchTerm}
                  onChange={(event) => handleFiltersChange(() => setSearchTerm(event.target.value))}
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

            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader aria-label="bonus recipients table">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedFilteredCount > 0 && selectedFilteredCount < filteredRecipients.length}
                        checked={filteredRecipients.length > 0 && selectedFilteredCount === filteredRecipients.length}
                        onChange={handleSelectAll}
                        inputProps={{ 'aria-label': 'select all filtered recipients' }}
                      />
                    </TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Hostel</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        Loading recipients...
                      </TableCell>
                    </TableRow>
                  ) : paginatedRecipients.length > 0 ? (
                    paginatedRecipients.map((recipient) => {
                      const isSelected = selectedRecipients.includes(recipient.username);
                      const isSubscriber = Number(recipient.has_active_subscription) === 1;
                      return (
                        <StyledTableRow
                          hover
                          key={recipient.username}
                          selected={isSelected}
                          onClick={() => handleRecipientClick(recipient.username)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={isSelected} inputProps={{ 'aria-label': `select ${recipient.fullname}` }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{recipient.fullname}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {recipient.username}
                            </Typography>
                          </TableCell>
                          <TableCell>{recipient.hostel}</TableCell>
                          <TableCell>{recipient.phone}</TableCell>
                          <TableCell>
                            <Chip
                              label={isSubscriber ? 'Subscriber' : 'Non-Subscriber'}
                              color={isSubscriber ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </StyledTableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No recipients match the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Pagination
              count={pageCount}
              page={page + 1}
              onChange={(event, newPage) => setPage(newPage - 1)}
              color="primary"
              showFirstButton
              showLastButton
              sx={{ display: 'flex', justifyContent: 'center', p: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              {selectedRecipients.length} clients selected from {filteredRecipients.length} matching recipients
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      </MainCard>
    </>
  );
};

export default Bonus;
