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
  Button,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Pagination
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import axios from 'axios';

import { SnackError, SnackSuccess } from 'utils/Snackbars';
import { useForm, FormProvider } from 'react-hook-form';
import { RHFAutocomplete, RHFAutocompleteMultiple } from 'utils/controls/ReactHookForms';
import { Delete as DeleteIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { ConfirmDialog } from 'utils/controls/confirmation';

const AgentSettings = () => {
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [allHostels, setAllHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;

  // Manage Hostels Dialog State
  const [hostelDialogOpen, setHostelDialogOpen] = useState(false);
  const [currentUserForHostels, setCurrentUserForHostels] = useState(null);

  const methods = useForm();
  const { control, handleSubmit, watch, setValue, reset } = methods;
  const selectedClient = watch('client');
  const selectedRole = watch('role');
  const pageCount = Math.max(Math.ceil(agents.length / rowsPerPage), 1);
  const paginatedAgents = agents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const roleOptions = [
    { id: '12', label: 'Agent (12)' },
    { id: '14', label: 'Hostel Owner (14)' }
  ];
  const visibleHostelLimit = 3;

  // Fetch all clients for the dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await axios.get(`/api/api/agents/clients`);
        const transformedClients = response.data.map((client) => ({
          id: client.username,
          label: `${client.fullname} (${client.username})`,
          ...client
        }));
        setClients(transformedClients);
      } catch (err) {
        setError('Failed to fetch clients for dropdown.');
      }
    };
    fetchClients();
  }, []);

  // Fetch all hostels
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const response = await axios.get('/api/login/hostels');
        if (response.data.code === 1) {
          setAllHostels(response.data.data.map((h) => ({ id: h.id, label: h.name })));
        }
      } catch (err) {
        console.error('Error fetching hostels:', err);
      }
    };
    fetchHostels();
  }, []);

  // Fetch agents list with hostels
  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/api/admins/agents-details`);
      const agentsList = response.data;

      // Fetch hostels for each agent in parallel
      const agentsWithHostels = await Promise.all(
        agentsList.map(async (agent) => {
          try {
            const hRes = await axios.get(`/api/api/admins/user-hostels/${agent.username}`);
            return { ...agent, assignedHostels: hRes.data.code === 1 ? hRes.data.data : [] };
          } catch (e) {
            return { ...agent, assignedHostels: [] };
          }
        })
      );

      setAgents(agentsWithHostels);
      setPage(0);
    } catch (err) {
      setError('Failed to fetch agents list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedClient) {
      setSelectedClientInfo(selectedClient);
    } else {
      setSelectedClientInfo(null);
    }
  }, [selectedClient]);

  const onAddRole = async (data) => {
    setLoading(true);
    if (!data.client || !data.role) {
      setError('Please select a client and a role.');
      setLoading(false);
      return;
    }

    try {
      // 1. Update Role
      const roleRes = await axios.put(`/api/api/admins/update-client-role/${data.client.username}`, {
        role: data.role.id
      });

      // 2. If Hostel Owner and hostels selected, assign them
      if (data.role.id === '14' && data.hostels && data.hostels.length > 0) {
        await axios.post('/api/api/admins/assign-hostels', {
          username: data.client.username,
          hostelIds: data.hostels.map((h) => h.id)
        });
      }

      setSuccess(roleRes.data.message || 'User role updated successfully!');
      setRefreshTrigger((prev) => prev + 1);
      reset({ client: null, role: null, hostels: [] });
      setSelectedClientInfo(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user role.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHostelDialog = async (agent) => {
    setCurrentUserForHostels(agent);
    setHostelDialogOpen(true);
    // Use the already fetched hostels if available, or fetch again
    const assigned = agent.assignedHostels.map((h) => ({ id: h.id, label: h.name }));
    setValue('manage_hostels', assigned);
  };

  const handleSaveHostels = async () => {
    const selectedHostels = watch('manage_hostels') || [];
    try {
      await axios.post('/api/api/admins/assign-hostels', {
        username: currentUserForHostels.username,
        hostelIds: selectedHostels.map((h) => h.id)
      });
      setSuccess('Hostels updated successfully.');
      setHostelDialogOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError('Failed to update hostels.');
    }
  };

  const handleDeleteAgentClick = (username) => {
    setAgentToDelete(username);
    setOpenConfirmDialog(true);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  const handleConfirmDeleteAgent = async () => {
    setOpenConfirmDialog(false);
    try {
      const response = await axios.put(`/api/api/admins/update-client-role/${agentToDelete}`, {
        role: '0'
      });
      // Also clear hostels for safety
      await axios.post('/api/api/admins/assign-hostels', { username: agentToDelete, hostelIds: [] });

      setSuccess(response.data.message || 'Role removed successfully!');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove role.');
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">User Role & Hostel Settings</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <ConfirmDialog
        open={openConfirmDialog}
        handleClose={() => setOpenConfirmDialog(false)}
        onConfirm={handleConfirmDeleteAgent}
        message="Are you sure you want to remove this users special role? Their role will be set to 0."
        title="Confirm Role Removal"
        confirmButton="Yes, Remove"
      />

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onAddRole)}>
          <Grid container spacing={2} sx={{ mb: 3 }} alignItems="flex-start">
            <Grid item xs={12} md={4}>
              <RHFAutocomplete name="client" control={control} options={clients} label="Select Client" />
            </Grid>
            <Grid item xs={12} md={4}>
              <RHFAutocomplete name="role" control={control} options={roleOptions} label="Select Role" />
            </Grid>

            {selectedRole?.id === '14' && (
              <Grid item xs={12} md={4}>
                <RHFAutocompleteMultiple name="hostels" control={control} options={allHostels} label="Assign Hostels" />
              </Grid>
            )}

            <Grid item xs={12} md={selectedRole?.id === '14' ? 12 : 4}>
              <Button
                variant="contained"
                color="primary"
                type="submit"
                fullWidth={selectedRole?.id === '14'}
                disabled={loading}
                sx={{ mt: selectedRole?.id === '14' ? 0 : 1 }}
              >
                Update User Role
              </Button>
            </Grid>
          </Grid>
        </form>

        {selectedClientInfo && (
          <Paper elevation={3} sx={{ p: 2, mb: 3, borderRadius: '8px', bgcolor: '#f5f5f5' }}>
            <Typography variant="h5" gutterBottom>
              Selected Client Information:
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2">Phone Number: {selectedClientInfo.username}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2">Full Name: {selectedClientInfo.fullname}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2">Phone: {selectedClientInfo.phone}</Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>
          Current Agents & Owners
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" p={5}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Phone Number</TableCell>
                    <TableCell>Full Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell sx={{ width: 280, maxWidth: 280 }}>Assigned Hostels</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.length > 0 ? (
                    paginatedAgents.map((agent) => (
                      <TableRow key={agent.username}>
                        <TableCell>{agent.username}</TableCell>
                        <TableCell>{agent.fullname}</TableCell>
                        <TableCell>
                          <Chip
                            label={agent.role === '12' ? 'Agent' : agent.role === '14' ? 'Owner' : agent.role}
                            color={agent.role === '14' ? 'secondary' : 'primary'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ width: 280, maxWidth: 280 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 56, overflow: 'hidden' }}>
                            {agent.assignedHostels?.slice(0, visibleHostelLimit).map((h) => (
                              <Chip key={h.id} label={h.name} size="small" sx={{ maxWidth: 120 }} />
                            ))}
                            {agent.assignedHostels?.length > visibleHostelLimit && (
                              <Chip label={`+${agent.assignedHostels.length - visibleHostelLimit} more`} size="small" variant="outlined" />
                            )}
                          </Box>
                          {(!agent.assignedHostels || agent.assignedHostels.length === 0) && (
                            <Typography variant="caption" color="textSecondary">
                              None
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton color="primary" onClick={() => handleOpenHostelDialog(agent)} title="Manage Hostels">
                            <SettingsIcon />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteAgentClick(agent.username)} title="Remove Role">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No users with special roles found.
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
          </Paper>
        )}

        {/* Manage Hostels Dialog */}
        <Dialog open={hostelDialogOpen} onClose={() => setHostelDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Manage Hostels for {currentUserForHostels?.fullname}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <RHFAutocompleteMultiple name="manage_hostels" control={control} options={allHostels} label="Assigned Hostels" />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHostelDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveHostels}>
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </FormProvider>
      </MainCard>
    </>
  );
};

export default AgentSettings;
