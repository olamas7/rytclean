import { Box, Tab, Tabs } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from 'ui-component/PageLayout';
import BulkSms from './BulkSms';
import NotificationHistory from './NotificationHistory';

export default function SmsNotifications() {
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'history' ? 'history' : 'bulk';
    const allowed = ['Admin', 'Super Admin', 'Manager'].includes(localStorage.getItem('admin_role'));
    return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title="SMS Notifications" description="Send customer announcements and review automatic, bulk and test notifications." />
        {!allowed ? <Box role="alert">Manager or administrator access is required.</Box> : <>
            <Tabs value={tab} onChange={(_, value) => setParams({ tab: value })} aria-label="SMS notification sections" variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab value="bulk" label="Bulk SMS" id="sms-bulk-tab" aria-controls="sms-bulk-panel" />
                <Tab value="history" label="Notification History" id="sms-history-tab" aria-controls="sms-history-panel" />
            </Tabs>
            <Box role="tabpanel" id="sms-bulk-panel" aria-labelledby="sms-bulk-tab" hidden={tab !== 'bulk'}><BulkSms /></Box>
            <Box role="tabpanel" id="sms-history-panel" aria-labelledby="sms-history-tab" hidden={tab !== 'history'}>{tab === 'history' && <NotificationHistory />}</Box>
        </>}
    </Box>;
}
