import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
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
import { AddBusinessOutlined, DeleteOutline } from '@mui/icons-material';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import { ConfirmDialog } from 'utils/controls/confirmation';
import { SnackError, SnackSuccess } from 'utils/Snackbars';

const HostelSettings = () => {
  const [hostels, setHostels] = useState([]);
  const [newHostelName, setNewHostelName] = useState('');
  const [hostelToDelete, setHostelToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [periodSaving, setPeriodSaving] = useState(false);

  const issuedBy = localStorage.getItem('userId');

  const fetchHostels = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/api/admins/hostels', { params: { issuedBy } });
      setHostels(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch hostels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostels();
    axios.get('/api/api/admins/hostel-owner-revenue-period', { params: { issuedBy } })
      .then((response) => {
        setPeriodFrom(response.data.period?.period_start || '');
        setPeriodTo(response.data.period?.period_end || '');
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to fetch the owner revenue period.'));
  }, []);

  const handleSavePeriod = async () => {
    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      setError('Choose a valid period with the start date on or before the end date.');
      return;
    }
    setPeriodSaving(true);
    try {
      const response = await axios.put('/api/api/admins/hostel-owner-revenue-period', {
        issuedBy,
        dateFrom: periodFrom,
        dateTo: periodTo
      });
      setSuccess(response.data.message || 'Revenue period updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save the owner revenue period.');
    } finally {
      setPeriodSaving(false);
    }
  };

  const handleAddHostel = async () => {
    if (!newHostelName.trim()) {
      setError('Enter a hostel name.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post('/api/api/admins/hostels', {
        name: newHostelName,
        issuedBy
      });
      setHostels((current) => [...current, response.data.hostel].sort((a, b) => a.name.localeCompare(b.name)));
      setNewHostelName('');
      setSuccess(response.data.message || 'Hostel added successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add hostel.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!hostelToDelete) return;

    try {
      const response = await axios.delete(`/api/api/admins/hostels/${hostelToDelete.id}`, {
        data: { issuedBy }
      });
      setHostels((current) => current.filter((hostel) => hostel.id !== hostelToDelete.id));
      setSuccess(response.data.message || 'Hostel deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete hostel.');
      await fetchHostels();
    } finally {
      setHostelToDelete(null);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">Hostel Settings</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <ConfirmDialog
        open={!!hostelToDelete}
        handleClose={() => setHostelToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Hostel"
        message={`Delete ${hostelToDelete?.name || 'this hostel'}? This cannot be undone.`}
        confirmButton="Yes, Delete"
      />

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, borderColor: 'primary.light', background: 'linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)' }}>
        <Typography variant="h4" gutterBottom>Hostel Owner Revenue Period</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
          Owners can view subscription revenue only within this system-wide reporting period.
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField fullWidth type="date" label="Period From" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth type="date" label="Period To" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button fullWidth variant="contained" onClick={handleSavePeriod} disabled={periodSaving}>
              {periodSaving ? 'Saving…' : 'Save Period'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Add New Hostel
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8} md={6}>
            <TextField
              fullWidth
              label="Hostel Name"
              value={newHostelName}
              onChange={(event) => setNewHostelName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAddHostel();
              }}
              placeholder="e.g. KayFi Residence"
            />
          </Grid>
          <Grid item xs={12} sm="auto">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <AddBusinessOutlined />}
              onClick={handleAddHostel}
              disabled={saving}
            >
              {saving ? 'Adding...' : 'Add Hostel'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h4" sx={{ mb: 1.5 }}>
        Hostel List
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A hostel can only be deleted when it has no assigned clients and no hostel-owner assignments.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="hostel settings table">
            <TableHead>
              <TableRow>
                <TableCell>Hostel</TableCell>
                <TableCell align="center">Assigned Clients</TableCell>
                <TableCell align="center">Assigned Hostel Owners</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hostels.length > 0 ? (
                hostels.map((hostel) => {
                  const isAssigned = Number(hostel.client_count) > 0 || Number(hostel.owner_assignment_count) > 0;
                  const deleteHint = isAssigned
                    ? 'Remove all client and hostel-owner assignments before deleting this hostel.'
                    : 'Delete hostel';

                  return (
                    <TableRow key={hostel.id} hover>
                      <TableCell>{hostel.name}</TableCell>
                      <TableCell align="center">{hostel.client_count}</TableCell>
                      <TableCell align="center">{hostel.owner_assignment_count}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={deleteHint}>
                          <span>
                            <IconButton color="error" disabled={isAssigned} onClick={() => setHostelToDelete(hostel)}>
                              <DeleteOutline />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No hostels found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      </MainCard>
    </>
  );
};

export default HostelSettings;
