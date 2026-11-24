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
  IconButton,
  TextField,
  InputAdornment,
  Pagination
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import axios from 'axios';

import { SnackError, SnackSuccess } from 'utils/Snackbars';
import { Search, Delete, Edit } from '@mui/icons-material';
import { ConfirmDialog } from 'utils/controls/confirmation';
import MediumDialog from 'views/Hooks/dialogMedium';
import EditClient from 'views/Agents/EditClient';

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover
  },
  // hide last border
  '& > td, & > th': {
    border: 0
  }
}));

const AdminClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState(null);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/api/agents/clients-list`);
      setClients(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch clients.');
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [refreshTrigger]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const filteredClients = clients.filter(
    (client) =>
      client.fullname.toLowerCase().includes(searchTerm.toLowerCase()) || client.username.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const pageCount = Math.max(Math.ceil(filteredClients.length / rowsPerPage), 1);
  const paginatedClients = filteredClients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  const handleDeleteClick = (username) => {
    setClientToDelete(username);
    setOpenConfirmDialog(true);
  };

  const handleOpenEditDialog = (client) => {
    setSelectedClientForEdit(client);
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedClientForEdit(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleConfirmDelete = async () => {
    setOpenConfirmDialog(false);
    try {
      const response = await axios.delete(`/api/api/admins/delete-client/${clientToDelete}`);
      setSuccess(response.data.message || 'Client deleted successfully!');
      setRefreshTrigger((prev) => prev + 1); // Trigger refresh
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete client.');
      console.error('Error deleting client:', err);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard
      title={<Typography variant="h3">Clients</Typography>}
      secondary={
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <TextField
              id="search"
              type="search"
              label="Search"
              value={searchTerm}
              onChange={handleSearchChange}
              sx={{ width: 250 }}
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
      }
    >
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <ConfirmDialog
        open={openConfirmDialog}
        handleClose={() => setOpenConfirmDialog(false)}
        onConfirm={handleConfirmDelete}
        message="Are you sure you want to delete this client? This action cannot be undone."
        title="Confirm Deletion"
        confirmButton="Yes, Delete"
      />

      {selectedClientForEdit && (
        <MediumDialog open={openEditDialog} onClose={handleCloseEditDialog}>
          <EditClient client={selectedClientForEdit} onClose={handleCloseEditDialog} />
        </MediumDialog>
      )}

      {loading ? (
        <Grid container justifyContent="center" alignItems="center" style={{ height: '200px' }}>
          <CircularProgress />
        </Grid>
      ) : (
        <Paper>
          <TableContainer>
            <Table sx={{ minWidth: 650 }} aria-label="clients table">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Current Amount</TableCell>
                  <TableCell>Subscription Date</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Subscription End Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClients.length > 0 ? (
                  paginatedClients.map((client) => (
                    <StyledTableRow key={client.username}>
                      <TableCell>
                        <Typography variant="subtitle1">{client.fullname}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {client.username}
                        </Typography>
                      </TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>
                        {client.plan_amount ? `GHS ${Number(client.plan_amount).toFixed(2)}` : 'No active subscription'}
                      </TableCell>
                      <TableCell>{client.subscription_date || 'N/A'}</TableCell>
                      <TableCell>{client.start_date || 'N/A'}</TableCell>
                      <TableCell>{client.end_date || 'N/A'}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => handleOpenEditDialog(client)}>
                          <Edit />
                        </IconButton>
                        <IconButton color="error" onClick={() => handleDeleteClick(client.username)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </StyledTableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No clients found.
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
      </MainCard>
    </>
  );
};

export default AdminClients;
