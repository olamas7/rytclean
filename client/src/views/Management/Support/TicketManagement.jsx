import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getComplaints, getTickets } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const TicketManagement = () => {
    const [tickets, setTickets] = useState([]);
    const [complaints, setComplaints] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    useEffect(() => {
        const loadData = async () => {
            const [ticketsRes, complaintsRes] = await Promise.all([getTickets(), getComplaints()]);

            if (ticketsRes.code === 1) {
                setTickets(ticketsRes.data);
            }

            if (complaintsRes.code === 1) {
                setComplaints(complaintsRes.data);
            }
        };

        loadData();
    }, []);

    const complaintMap = useMemo(() => {
        const map = new Map();
        complaints.forEach((complaint) => map.set(complaint.id, complaint));
        return map;
    }, [complaints]);

    const complaintTypes = useMemo(() => {
        const values = complaints.map((complaint) => complaint.category);
        return ['all', ...new Set(values)];
    }, [complaints]);

    const filtered = useMemo(
        () =>
            tickets.filter((ticket) => {
                const complaint = complaintMap.get(ticket.complaintId);
                const matchesStatus = statusFilter === 'all' ? true : ticket.status === statusFilter;
                const matchesType = typeFilter === 'all' ? true : complaint?.category === typeFilter;
                return matchesStatus && matchesType;
            }),
        [complaintMap, statusFilter, tickets, typeFilter]
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Ticket Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Filter tickets by status/type and respond to customer issues.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Ticket Status"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="open">Open</MenuItem>
                            <MenuItem value="in progress">In Progress</MenuItem>
                            <MenuItem value="resolved">Resolved</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Complaint Type"
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value)}
                        >
                            {complaintTypes.map((type) => (
                                <MenuItem key={type} value={type}>
                                    {type === 'all' ? 'All' : type}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                </Grid>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Ticket</TableCell>
                            <TableCell>Complaint Type</TableCell>
                            <TableCell>Priority</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Assigned To</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((ticket) => {
                            const complaint = complaintMap.get(ticket.complaintId);
                            return (
                                <TableRow key={ticket.id}>
                                    <TableCell>{ticket.id}</TableCell>
                                    <TableCell>{complaint?.category || '-'}</TableCell>
                                    <TableCell sx={{ textTransform: 'capitalize' }}>{ticket.priority}</TableCell>
                                    <TableCell>
                                        <StatusBadge label={ticket.status} size="small" />
                                    </TableCell>
                                    <TableCell>{ticket.assignedTo}</TableCell>
                                    <TableCell>
                                        <Grid container spacing={0.75}>
                                            <Grid item>
                                                <Button size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                                                    View Detail
                                                </Button>
                                            </Grid>
                                            <Grid item>
                                                <Button size="small" variant="text" sx={{ textTransform: 'none' }}>
                                                    Reply
                                                </Button>
                                            </Grid>
                                            <Grid item>
                                                <Button size="small" variant="contained" sx={{ textTransform: 'none' }}>
                                                    Mark Resolved
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default TicketManagement;
