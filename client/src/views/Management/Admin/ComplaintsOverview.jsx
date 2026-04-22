import { useEffect, useState } from 'react';
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { getComplaints } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const ComplaintsOverview = () => {
    const [complaints, setComplaints] = useState([]);

    useEffect(() => {
        const loadComplaints = async () => {
            const response = await getComplaints();
            if (response.code === 1) {
                setComplaints(response.data);
            }
        };

        loadComplaints();
    }, []);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Complaints Overview
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Track complaint status and assign to support teams.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Support Assignment</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {complaints.map((complaint, index) => (
                            <TableRow key={complaint.id}>
                                <TableCell>{complaint.id}</TableCell>
                                <TableCell>{complaint.customerId}</TableCell>
                                <TableCell>{complaint.category}</TableCell>
                                <TableCell>
                                    <StatusBadge label={complaint.status} size="small" />
                                </TableCell>
                                <TableCell>{index % 2 === 0 ? 'Support Team A' : 'Support Team B'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default ComplaintsOverview;
