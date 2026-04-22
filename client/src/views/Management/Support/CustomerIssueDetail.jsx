import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import { getComplaints, getCustomers, getTickets } from 'services/mockApi';

const ISSUE_TICKET_ID = 'TKT-5001';

const CustomerIssueDetail = () => {
    const [ticket, setTicket] = useState(null);
    const [complaint, setComplaint] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [resolutionStatus, setResolutionStatus] = useState('open');

    useEffect(() => {
        const loadData = async () => {
            const [ticketsRes, complaintsRes, customersRes] = await Promise.all([getTickets(), getComplaints(), getCustomers()]);

            if (ticketsRes.code !== 1 || complaintsRes.code !== 1 || customersRes.code !== 1) {
                return;
            }

            const selectedTicket = ticketsRes.data.find((item) => item.id === ISSUE_TICKET_ID) || ticketsRes.data[0] || null;
            const selectedComplaint = complaintsRes.data.find((item) => item.id === selectedTicket?.complaintId) || null;
            const selectedCustomer = customersRes.data.find((item) => item.id === selectedTicket?.customerId) || null;

            setTicket(selectedTicket);
            setComplaint(selectedComplaint);
            setCustomer(selectedCustomer);
            setResolutionStatus(selectedTicket?.status || 'open');
        };

        loadData();
    }, []);

    const timelineItems = useMemo(
        () => [
            { title: 'Ticket Created', text: ticket?.updatedAt ? ticket.updatedAt.slice(0, 10) : '-' },
            { title: 'Complaint Logged', text: complaint?.createdAt ? complaint.createdAt.slice(0, 10) : '-' },
            { title: 'Latest Status', text: resolutionStatus }
        ],
        [complaint?.createdAt, resolutionStatus, ticket?.updatedAt]
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Customer Issue Detail
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Detailed ticket view with issue timeline and internal handling notes.
            </Typography>

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1}>
                            <Typography variant="h4">Ticket Information</Typography>
                            <Typography variant="body2">Ticket ID: {ticket?.id || '-'}</Typography>
                            <Typography variant="body2">Customer: {customer?.fullName || '-'}</Typography>
                            <Typography variant="body2">Contact: {customer?.phone || '-'}</Typography>
                            <Typography variant="body2">Issue Type: {complaint?.category || '-'}</Typography>
                            <Typography variant="body2">Issue Details: {complaint?.message || '-'}</Typography>
                            <Typography variant="body2">Assigned To: {ticket?.assignedTo || '-'}</Typography>
                        </Stack>
                    </Paper>

                    <Paper sx={{ p: 2.5, mt: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Internal Notes
                        </Typography>
                        <TextField fullWidth multiline minRows={4} placeholder="Add internal notes for support team." />
                        <Button variant="contained" sx={{ mt: 1.5 }}>
                            Save Notes
                        </Button>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Resolution Status
                        </Typography>
                        <TextField select fullWidth value={resolutionStatus} onChange={(event) => setResolutionStatus(event.target.value)}>
                            <MenuItem value="open">Open</MenuItem>
                            <MenuItem value="in progress">In Progress</MenuItem>
                            <MenuItem value="resolved">Resolved</MenuItem>
                        </TextField>
                    </Paper>

                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Issue Timeline
                        </Typography>
                        <Timeline sx={{ p: 0 }}>
                            {timelineItems.map((item, index) => (
                                <TimelineItem key={item.title}>
                                    <TimelineSeparator>
                                        <TimelineDot />
                                        {index < timelineItems.length - 1 ? <TimelineConnector /> : null}
                                    </TimelineSeparator>
                                    <TimelineContent>
                                        <Typography variant="subtitle2">{item.title}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                            {item.text}
                                        </Typography>
                                    </TimelineContent>
                                </TimelineItem>
                            ))}
                        </Timeline>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CustomerIssueDetail;
