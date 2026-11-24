import { useEffect, useMemo, useRef, useState } from 'react';
import { Add, Edit } from '@mui/icons-material';
import { Alert, Box, Grid, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { createUser, getUsers, updateUser } from 'services/api/usersService';
import StatusBadge from 'ui-component/StatusBadge';
import { PageHeader } from 'ui-component/PageLayout';
import useInlineNavigation from 'utils/useInlineNavigation';
import { LdButton } from 'utils/myButtons';
import UserForm from './components/UserForm';
const sections = { new: { label: 'New User' }, edit: { label: 'Edit User' } };

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [workTitleFilter, setWorkTitleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [loadError, setLoadError] = useState('');
    const lock = useRef(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'User Manager', contextKeys: ['user'], blocked: loading });
    const dialogMode = inline.view === 'edit' ? 'edit' : 'create';
    const activeUser = users.find((user) => String(user.id) === inline.params.get('user')) || null;
    const [feedback, setFeedback] = useState(null);

    const loadUsers = async () => {
        setFetching(true); setLoadError('');
        try {
            const response = await getUsers();
            if (response.code !== 1) throw new Error(response.message || 'Unable to load users.');
            setUsers(response.data);
        } catch (error) { setLoadError(error.response?.data?.message || error.message); }
        finally { setFetching(false); }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return users.filter((user) => {
            const titleMatch = workTitleFilter === 'all' ? true : workTitleFilter === 'driver' ? ['driver', 'supervisor'].includes(user.workTitle) : user.workTitle === workTitleFilter;
            const statusMatch =
                statusFilter === 'all'
                    ? true
                    : statusFilter === 'active'
                      ? Number(user.status) === 1
                      : Number(user.status) === 0;
            const searchMatch = !query || user.fullname.toLowerCase().includes(query) || user.username.toLowerCase().includes(query);

            return titleMatch && statusMatch && searchMatch;
        });
    }, [users, search, workTitleFilter, statusFilter]);

    const openCreateDialog = () => {
        setFeedback(null);
        inline.open('new');
    };

    const openEditDialog = (user) => {
        setFeedback(null);
        inline.open('edit', { user: user.id });
    };

    const handleSubmit = async (values) => {
        if (lock.current || (dialogMode === 'edit' && !activeUser)) return;
        lock.current = true;
        setLoading(true);
        setFeedback(null);

        try {
            const response =
                dialogMode === 'edit' && activeUser
                    ? await updateUser(activeUser.id, {
                          fullname: values.fullname,
                          username: values.username,
                          workTitle: values.workTitle,
                          status: values.status
                      })
                    : await createUser(values);

            if (response.code === 1) {
                setFeedback({ type: 'success', message: response.message });
                inline.close();
                await loadUsers();
                return;
            }

            setFeedback({ type: 'error', message: response.message });
        } catch (error) {
            setFeedback({ type: 'error', message: `Unable to ${dialogMode === 'edit' ? 'update' : 'create'} user right now.` });
        } finally {
            lock.current = false;
            setLoading(false);
        }
    };

    if (inline.view) return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title={dialogMode === 'edit' ? 'Edit User' : 'New User'} inlineNavigation={inline.navigation} />
        {feedback && <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.message}</Alert>}
        {fetching ? <Typography role="status">Loading user data…</Typography> : loadError ? <Alert severity="error" action={<LdButton onClick={loadUsers} loading={fetching}>Retry</LdButton>}>{loadError}</Alert> : dialogMode === 'edit' && !activeUser ? <Alert severity="warning">User not found. Return to User Manager and choose a valid user.</Alert> : <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, maxWidth: 1100, mx: 'auto' }}><UserForm key={activeUser?.id || 'new'} open mode={dialogMode} initialValues={dialogMode === 'edit' ? activeUser : null} onSubmit={handleSubmit} loading={loading} onCancel={inline.back} /></Paper>}
    </Box>;

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <PageHeader title="User Manager" description="Create and maintain user accounts by work title. Driver profile details are handled separately in Driver Assignment." inlineNavigation={inline.navigation} />
            {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<LdButton onClick={loadUsers} loading={fetching}>Retry</LdButton>}>{loadError}</Alert>}

            {feedback && (
                <Alert severity={feedback.type} sx={{ mb: 2.5 }}>
                    {feedback.message}
                </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
                <LdButton startIcon={<Add />} onClick={openCreateDialog}>
                    Add User
                </LdButton>
            </Stack>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={5}>
                        <TextField fullWidth label="Search name or username" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField select fullWidth label="Work Title" value={workTitleFilter} onChange={(event) => setWorkTitleFilter(event.target.value)}>
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="driver">Driver</MenuItem>
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
                            <TableCell>Role</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Action</TableCell>
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
                                <TableCell sx={{ textTransform: 'capitalize' }}>{user.workTitle === 'supervisor' ? 'driver' : user.workTitle}</TableCell>
                                <TableCell>{user.role === 'Supervisor' ? 'Driver (legacy login)' : user.role}</TableCell>
                                <TableCell>
                                    <StatusBadge label={Number(user.status) === 1 ? 'active' : 'inactive'} size="small" />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" color="primary" onClick={() => openEditDialog(user)}>
                                        <Edit fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

        </Box>
    );
};

export default UserManager;
