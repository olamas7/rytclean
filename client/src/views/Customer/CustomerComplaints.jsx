import { Alert, Box } from '@mui/material';
import { PageHeader } from 'ui-component/PageLayout';

export default function CustomerComplaints() {
    return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title="Complaints / Support" description="Customer collection issues and pickup evidence." />
        <Alert severity="info">Your login must be securely linked to your customer record before online complaint submission/history can be enabled. For now, contact support with your customer ID. Staff can record the complaint in Complaints Overview; it will flag your assigned collection stop and require photo evidence. No complaint has been submitted from this page.</Alert>
    </Box>;
}
