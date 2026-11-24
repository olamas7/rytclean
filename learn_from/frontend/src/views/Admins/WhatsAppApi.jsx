import React, { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, FormControl,
  Grid, InputAdornment, InputLabel, MenuItem, Paper, Pagination, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { SendOutlined, Search } from '@mui/icons-material';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import WhatsAppTest from './WhatsAppTest';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import { ConfirmDialog } from 'utils/controls/confirmation';

const userFields = [
  { value: 'fullname', label: 'Full name' },
  { value: 'username', label: 'Account number' },
  { value: 'phone', label: 'Phone number' },
  { value: 'email', label: 'Email' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'room', label: 'Room' }
];

const templateKey = (template) => `${template.name}:${template.language}`;

const WhatsAppApi = () => {
  const issuedBy = localStorage.getItem('userId');
  const [tab, setTab] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [mappings, setMappings] = useState({});
  const [selectedUsernames, setSelectedUsernames] = useState([]);
  const [search, setSearch] = useState('');
  const [hostels, setHostels] = useState([]);
  const [subscriptionFilter, setSubscriptionFilter] = useState('active');
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const rowsPerPage = 100;

  const selectedTemplate = templates.find((template) => templateKey(template) === selectedTemplateKey);
  const hostelOptions = [...new Set(recipients.map((recipient) => recipient.hostel).filter(Boolean))].sort();
  const filteredRecipients = recipients.filter((recipient) => {
    const text = search.toLowerCase();
    const matchesSearch = !text || [recipient.username, recipient.fullname, recipient.phone, recipient.email]
      .some((value) => String(value || '').toLowerCase().includes(text));
    const matchesHostel = hostels.length === 0 || hostels.includes(recipient.hostel);
    const matchesSubscription = subscriptionFilter === 'all'
      || (subscriptionFilter === 'active' && Number(recipient.has_active_subscription) === 1)
      || (subscriptionFilter === 'inactive' && Number(recipient.has_active_subscription) === 0);
    return matchesSearch && matchesHostel && matchesSubscription;
  });
  const selectedVisibleCount = filteredRecipients.filter((recipient) => selectedUsernames.includes(recipient.username)).length;
  const pageCount = Math.max(1, Math.ceil(filteredRecipients.length / rowsPerPage));
  const visibleRecipients = filteredRecipients.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const hasCompleteMappings = selectedTemplate && selectedTemplate.variableSlots.every(
    (slot) => Boolean(mappings[`${slot.component}:${slot.parameterIndex}`])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesResponse, recipientsResponse] = await Promise.all([
        axios.get('/api/api/admins/whatsapp/templates', { params: { issuedBy } }),
        axios.get('/api/api/admins/whatsapp/recipients', { params: { issuedBy } })
      ]);
      setTemplates(templatesResponse.data || []);
      setRecipients(recipientsResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load WhatsApp templates or recipients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectTemplate = (value) => {
    setSelectedTemplateKey(value);
    const template = templates.find((item) => templateKey(item) === value);
    setMappings(Object.fromEntries((template?.variableSlots || []).map((slot) => [`${slot.component}:${slot.parameterIndex}`, 'fullname'])));
  };

  const toggleAllVisible = (checked) => {
    const usernames = filteredRecipients.map((recipient) => recipient.username);
    setSelectedUsernames((current) => checked
      ? [...new Set([...current, ...usernames])]
      : current.filter((username) => !usernames.includes(username)));
  };

  const toggleRecipient = (username) => {
    setSelectedUsernames((current) => current.includes(username)
      ? current.filter((value) => value !== username)
      : [...current, username]);
  };

  const sendCampaign = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const response = await axios.post('/api/api/admins/whatsapp/send-template', {
        issuedBy,
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
        mappings,
        recipientUsernames: selectedUsernames
      });
      setSuccess(response.data.message);
      if (response.data.failed?.length) setError(`${response.data.failed.length} recipients were not sent: ${response.data.failed[0].error}`);
      setSelectedUsernames([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send WhatsApp template campaign.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">WhatsApp API</Typography>}>
        <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
        <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tab label="Send Template" />
          <Tab label="Test Template" />
        </Tabs>

        {tab === 0 && (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              Select an approved Meta template, map its text variables to user fields, then choose recipients. Media headers and dynamic buttons are intentionally excluded for safe manual sending.
            </Alert>
            {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box> : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="h4" sx={{ mb: 2 }}>Template Setup</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel id="whatsapp-template-label">Approved Template</InputLabel>
                      <Select labelId="whatsapp-template-label" label="Approved Template" value={selectedTemplateKey} onChange={(event) => selectTemplate(event.target.value)}>
                        {templates.map((template) => <MenuItem key={templateKey(template)} value={templateKey(template)}>{template.name} ({template.language})</MenuItem>)}
                      </Select>
                    </FormControl>
                    {templates.length === 0 && <Alert severity="warning">No supported approved templates were returned by Meta.</Alert>}
                    {selectedTemplate && (
                      <>
                        <Typography variant="caption" color="text.secondary">{selectedTemplate.category} template</Typography>
                        <Table size="small" sx={{ mt: 1 }}>
                          <TableHead><TableRow><TableCell>Variable</TableCell><TableCell>User column</TableCell></TableRow></TableHead>
                          <TableBody>
                            {selectedTemplate.variableSlots.length === 0 ? <TableRow><TableCell colSpan={2}>This template has no text variables.</TableCell></TableRow> : selectedTemplate.variableSlots.map((slot) => {
                              const key = `${slot.component}:${slot.parameterIndex}`;
                              return <TableRow key={key}>
                                <TableCell>{slot.component} {slot.variable}</TableCell>
                                <TableCell>
                                  <Select size="small" fullWidth value={mappings[key] || ''} onChange={(event) => setMappings((current) => ({ ...current, [key]: event.target.value }))}>
                                    {userFields.map((field) => <MenuItem key={field.value} value={field.value}>{field.label}</MenuItem>)}
                                  </Select>
                                </TableCell>
                              </TableRow>;
                            })}
                          </TableBody>
                        </Table>
                      </>
                    )}
                    <Button fullWidth variant="contained" startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendOutlined />} disabled={sending || !selectedTemplate || !hasCompleteMappings || selectedUsernames.length === 0} onClick={() => setConfirmOpen(true)} sx={{ mt: 3 }}>
                      Send to {selectedUsernames.length} Recipients
                    </Button>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={4}><Typography variant="h4">Select Recipients</Typography></Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small"><InputLabel id="subscription-filter-label">Subscription</InputLabel><Select labelId="subscription-filter-label" label="Subscription" value={subscriptionFilter} onChange={(event) => { setSubscriptionFilter(event.target.value); setPage(0); }}><MenuItem value="active">Active only</MenuItem><MenuItem value="all">All users</MenuItem><MenuItem value="inactive">No active subscription</MenuItem></Select></FormControl>
                      </Grid>
                      <Grid item xs={12} md={5}><Autocomplete multiple size="small" options={hostelOptions} value={hostels} onChange={(_, value) => { setHostels(value); setPage(0); }} renderInput={(params) => <TextField {...params} label="Filter by Hostel" />} /></Grid>
                      <Grid item xs={12}><TextField fullWidth size="small" type="search" label="Search users" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} InputProps={{ endAdornment: <InputAdornment position="end"><Search /></InputAdornment> }} /></Grid>
                    </Grid>
                    <TableContainer sx={{ maxHeight: 470 }}>
                      <Table stickyHeader size="small">
                        <TableHead><TableRow>
                          <TableCell padding="checkbox"><Checkbox checked={filteredRecipients.length > 0 && selectedVisibleCount === filteredRecipients.length} indeterminate={selectedVisibleCount > 0 && selectedVisibleCount < filteredRecipients.length} onChange={(event) => toggleAllVisible(event.target.checked)} /></TableCell>
                          <TableCell>Name</TableCell><TableCell>Account</TableCell><TableCell>Hostel</TableCell><TableCell>Active subscription</TableCell>
                        </TableRow></TableHead>
                        <TableBody>{visibleRecipients.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No users match these filters.</TableCell></TableRow> : visibleRecipients.map((recipient) => <TableRow hover key={recipient.username} selected={selectedUsernames.includes(recipient.username)} onClick={() => toggleRecipient(recipient.username)} sx={{ cursor: 'pointer' }}>
                          <TableCell padding="checkbox"><Checkbox checked={selectedUsernames.includes(recipient.username)} /></TableCell>
                          <TableCell>{recipient.fullname || '-'}</TableCell><TableCell>{recipient.username}</TableCell><TableCell>{recipient.hostel || '-'}</TableCell><TableCell><Chip size="small" color={Number(recipient.has_active_subscription) ? 'success' : 'default'} label={Number(recipient.has_active_subscription) ? 'Active' : 'Inactive'} /></TableCell>
                        </TableRow>)}</TableBody>
                      </Table>
                    </TableContainer>
                    <Pagination count={pageCount} page={page + 1} onChange={(_, value) => setPage(value - 1)} sx={{ display: 'flex', justifyContent: 'center', mt: 2 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{selectedUsernames.length} users selected from {filteredRecipients.length} matching users.</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
            <ConfirmDialog open={confirmOpen} handleClose={() => setConfirmOpen(false)} onConfirm={sendCampaign} title="Confirm WhatsApp Template" confirmButton="Send Template" message={`Send ${selectedTemplate?.name || 'this template'} to ${selectedUsernames.length} selected recipients?`} />
          </>
        )}
        {tab === 1 && <WhatsAppTest embedded />}
      </MainCard>
    </>
  );
};

export default WhatsAppApi;
