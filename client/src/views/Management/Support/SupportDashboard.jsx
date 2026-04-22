import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { getComplaints, getTickets } from 'services/mockApi';

const cardStyle = {
    p: 2.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    height: '100%'
};

const SupportDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [complaints, setComplaints] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            const [ticketsRes, complaintsRes] = await Promise.all([getTickets(), getComplaints()]);

            if (ticketsRes.code === 1) {
                setTickets(ticketsRes.data);
            }

            if (complaintsRes.code === 1) {
                setComplaints(complaintsRes.data);
            }

            setLoading(false);
        };

        loadData();
    }, []);

    const summary = useMemo(() => {
        const openTickets = tickets.filter((ticket) => ticket.status === 'open').length;
        const inProgressTickets = tickets.filter((ticket) => ticket.status === 'in progress').length;
        const resolvedTickets = tickets.filter((ticket) => ticket.status === 'resolved').length;

        return [
            { label: 'Open Tickets', value: openTickets },
            { label: 'In-progress Tickets', value: inProgressTickets },
            { label: 'Resolved Tickets', value: resolvedTickets }
        ];
    }, [tickets]);

    if (loading) {
        return (
            <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Support Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Ticket workload overview and latest complaints.
            </Typography>

            <Grid container spacing={2.5}>
                {summary.map((item) => (
                    <Grid item xs={12} md={4} key={item.label}>
                        <Paper sx={cardStyle}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {item.label}
                            </Typography>
                            <Typography variant="h4">{item.value}</Typography>
                        </Paper>
                    </Grid>
                ))}

                <Grid item xs={12}>
                    <Paper sx={{ ...cardStyle, p: 2.5 }}>
                        <Typography variant="h4" sx={{ mb: 1.25 }}>
                            Recent Complaints
                        </Typography>
                        {complaints.slice(0, 5).map((complaint) => (
                            <Typography variant="body2" key={complaint.id} sx={{ mb: 0.5 }}>
                                {complaint.id} - {complaint.category} ({complaint.status})
                            </Typography>
                        ))}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default SupportDashboard;
