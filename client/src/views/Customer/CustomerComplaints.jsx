import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Grid,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material';
import { getCustomerComplaints } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const CUSTOMER_ID = 'CUST-001';
const complaintTypes = ['Missed Pickup', 'Damaged Bin', 'Late Pickup', 'Billing Issue', 'General Complaint'];

const CustomerComplaints = () => {
    const [history, setHistory] = useState([]);
    const [formData, setFormData] = useState({ category: 'Missed Pickup', details: '' });
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const loadComplaints = async () => {
            const response = await getCustomerComplaints(CUSTOMER_ID);
            if (response.code === 1) {
                setHistory(response.data);
            }
        };

        loadComplaints();
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setNotice('');
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!formData.details.trim()) {
            setNotice('Please enter complaint details before submitting.');
            return;
        }

        setNotice('Complaint submitted successfully (mock).');
        setFormData((prev) => ({ ...prev, details: '' }));
    };

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Complaints / Support
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Submit new issues and track ticket status.
            </Typography>

            {notice ? (
                <Alert severity={notice.includes('successfully') ? 'success' : 'warning'} sx={{ mb: 2 }}>
                    {notice}
                </Alert>
            ) : null}

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={5}>
                    <Paper
                        component="form"
                        onSubmit={handleSubmit}
                        sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                    >
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Submit Complaint
                        </Typography>
                        <Stack spacing={1.5}>
                            <TextField select fullWidth label="Category" name="category" value={formData.category} onChange={handleChange}>
                                {complaintTypes.map((type) => (
                                    <MenuItem key={type} value={type}>
                                        {type}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                fullWidth
                                multiline
                                minRows={4}
                                label="Complaint Details"
                                name="details"
                                value={formData.details}
                                onChange={handleChange}
                            />
                            <Button type="submit" variant="contained">
                                Submit Complaint
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Complaint History
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Category</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Date</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.map((complaint) => (
                                    <TableRow key={complaint.id}>
                                        <TableCell>{complaint.id}</TableCell>
                                        <TableCell>{complaint.category}</TableCell>
                                        <TableCell>
                                            <StatusBadge label={complaint.status} size="small" />
                                        </TableCell>
                                        <TableCell>{complaint.createdAt.slice(0, 10)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CustomerComplaints;
