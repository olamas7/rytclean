import { useEffect, useMemo, useState } from 'react';
import { Add } from '@mui/icons-material';
import { Alert, Box, Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { createUser, getUsers } from 'services/api/usersService';
import { getZones } from 'services/api/zonesRoutesService';
import StatusBadge from 'ui-component/StatusBadge';
import { MediumDialog } from 'utils/dialogs';
import { LdButton } from 'utils/myButtons';
import UserForm from './components/UserForm';

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [zones, setZones] = useState([]);
    const [search, setSearch] = useState('');
    const [workTitleFilter, setWorkTitleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const loadData = async () => {
        const [usersRes, zonesRes] = await Promise.all([getUsers(), getZones()]);

        if (usersRes.code === 1) {
            setUsers(usersRes.data);
        }

        if (zonesRes.code === 1) {
            setZones(zonesRes.data);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return users.filter((user) => {
            const titleMatch = workTitleFilter === 'all' ? true : user.workTitle === workTitleFilter;
            const statusMatch =
                statusFilter === 'all'
                    ? true
                    : statusFilter === 'active'
                      ? Number(user.status) === 1
                      : Number(user.status) === 0;
            const searchMatch =
                !query ||
                user.fullname.toLowerCase().includes(query) ||
                user.username.toLowerCase().includes(query) ||
                (user.driverCode || '').toLowerCase().includes(query);

            return titleMatch && statusMatch && searchMatch;
        });
    }, [users, search, workTitleFilter, statusFilter]);

    const handleCreateUser = async (values) => {
        setLoading(true);
        setFeedback(null);

        try {
            const response = await createUser(values);
            if (response.code === 1) {
                setFeedback({ type: 'success', message: response.message });
                setDialogOpen(false);
                await loadData();
                return;
            }

            setFeedback({ type: 'error', message: response.message });
        } catch (error) {
            setFeedback({ type: 'error', message: 'Unable to create user right now.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                User Manager
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Create system users by work title and keep driver resources in one place.
            </Typography>

            {feedback && (
                <Alert severity={feedback.type} sx={{ mb: 2.5 }}>
                    {feedback.message}
                </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
                <LdButton startIcon={<Add />} onClick={() => setDialogOpen(true)}>
                    Add User
                </LdButton>
            </Stack>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={5}>
                        <TextField
                            fullWidth
                            label="Search name, username, or driver code"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField select fullWidth label="Work Title" value={workTitleFilter} onChange={(event) => setWorkTitleFilter(event.target.value)}>
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="driver">Driver</MenuItem>
                            <MenuItem value="supervisor">Supervisor</MenuItem>
                            <MenuItem value="accountant">Accountant</MenuItem>
                            <MenuItem value="support">Support</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField select fullWidth label="User Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>User</TableCell>
                            <TableCell>Work Title</TableCell>
                            <TableCell>Driver Profile</TableCell>
                            <TableCell>Zone</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Typography variant="subtitle2">{user.fullname}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {user.username}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ textTransform: 'capitalize' }}>{user.workTitle}</TableCell>
                                <TableCell>
                                    {user.workTitle === 'driver' ? (
                                        <>
                                            <Typography variant="body2">{user.driverCode}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {user.vehicleNumber || '-'}
                                            </Typography>
                                        </>
                                    ) : (
                                        '-'
                                    )}
                                </TableCell>
                                <TableCell>{user.zoneName || '-'}</TableCell>
                                <TableCell>
                                    <StatusBadge label={Number(user.status) === 1 ? 'active' : 'inactive'} size="small" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            <MediumDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create User">
                <UserForm
                    open={dialogOpen}
                    zones={zones}
                    onSubmit={handleCreateUser}
                    loading={loading}
                    onCancel={() => setDialogOpen(false)}
                />
            </MediumDialog>
        </Box>
    );
};

export default UserManager;
