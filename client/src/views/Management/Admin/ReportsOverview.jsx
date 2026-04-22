import { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { getRevenueSummary } from 'services/mockApi';

const ReportsOverview = () => {
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
                Reports Overview
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Quick visibility into pickup completion, revenue, and customer growth trends.
            </Typography>

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Pickup Completion Report
                        </Typography>
                        <Typography variant="h4">{summary?.pickupCompletionRate || 0}%</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Revenue Report Preview
                        </Typography>
                        <Typography variant="h4">GHS {summary?.totalRevenue || 0}</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                            Customer Growth Preview
                        </Typography>
                        <Typography variant="h4">+12.5%</Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ReportsOverview;
