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
  Button,
  Pagination
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import AgentsDeskLink from './AgentsDeskLink';
import axios from 'axios';

import { SnackError } from 'utils/Snackbars';
import { Edit, Search, Add } from '@mui/icons-material';
import MediumDialog from 'views/Hooks/dialogMedium';
import AddClient from './AddClient';
import EditClient from './EditClient';

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover
  },
  // hide last border
  '& > td, & > th': {
    border: 0
  }
}));

const ClientsList = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;

  const handleOpenAddDialog = () => {
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
    setRefreshTrigger((prev) => prev + 1); // Trigger refresh
  };

  const handleOpenEditDialog = (client) => {
    setSelectedClientForEdit(client);
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedClientForEdit(null);
    setRefreshTrigger((prev) => prev + 1); // Trigger refresh
  };

  useEffect(() => {
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

    fetchClients();
  }, [refreshTrigger]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  const filteredClients = clients.filter(
    (client) =>
      client.fullname.toLowerCase().includes(searchTerm.toLowerCase()) || client.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageCount = Math.max(Math.ceil(filteredClients.length / rowsPerPage), 1);
  const paginatedClients = filteredClients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <AgentsDeskLink />
      <MainCard
      title={<Typography variant="h3">Clients List</Typography>}
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
          <Grid item>
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenAddDialog}>
              Add New Client
            </Button>
          </Grid>
        </Grid>
      }
    >
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />

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
                {paginatedClients.length > 0 ? (
                  paginatedClients.map((client) => (
                    <StyledTableRow key={client.username}>
                      <TableCell>
                        <Typography variant="subtitle1">{client.fullname}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {client.phone}
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
                        <IconButton color="primary" size="large" onClick={() => handleOpenEditDialog(client)}>
                          <Edit />
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

      <MediumDialog open={openAddDialog} onClose={handleCloseAddDialog}>
        <AddClient onClose={handleCloseAddDialog} />
      </MediumDialog>

      {selectedClientForEdit && (
        <MediumDialog open={openEditDialog} onClose={handleCloseEditDialog}>
          <EditClient client={selectedClientForEdit} onClose={handleCloseEditDialog} />
        </MediumDialog>
      )}
      </MainCard>
    </>
  );
};

export default ClientsList;
