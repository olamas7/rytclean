import { useEffect, useState } from 'react';
import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import { getRevenueSummary } from 'services/mockApi';

const FinancialReports = () => {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        const loadSummary = async () => {
            const response = await getRevenueSummary();
            if (response.code === 1) {
                setSummary(response.data);
            }
        };

        loadSummary();
    }, []);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Financial Reports
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Revenue snapshots, collection trend placeholder, and export actions.
            </Typography>

            <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Total Revenue
                        </Typography>
                        <Typography variant="h4">GHS {summary?.totalRevenue || 0}</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Pending Payments
                        </Typography>
                        <Typography variant="h4">GHS {summary?.pendingPayments || 0}</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Paid Invoices
                        </Typography>
                        <Typography variant="h4">{summary?.paidInvoices || 0}</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Completion Rate
                        </Typography>
                        <Typography variant="h4">{summary?.pickupCompletionRate || 0}%</Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Collection Trends Chart Placeholder
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Chart integration can render monthly collection data from mock and future API feeds.
                        </Typography>
                        <Button variant="outlined" sx={{ mr: 1 }}>
                            Export PDF
                        </Button>
                        <Button variant="contained">Export CSV</Button>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default FinancialReports;
