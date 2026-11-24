import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { SendOutlined } from '@mui/icons-material';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import { SnackError, SnackSuccess } from 'utils/Snackbars';

const emptyTest = {
  recipientPhone: '',
  customerName: '',
  accountNumber: '',
  expiryDate: ''
};

const formatDateTime = (value) => value ? value.replace('T', ' ') : '';

const WhatsAppTest = ({ embedded = false }) => {
  const [test, setTest] = useState(emptyTest);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const issuedBy = localStorage.getItem('userId');

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get('/api/api/admins/whatsapp/test-messages', { params: { issuedBy } });
      setHistory(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load WhatsApp test history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const updateTest = (field, value) => setTest((current) => ({ ...current, [field]: value }));

  const sendTest = async () => {
    setSending(true);
    try {
      const response = await axios.post('/api/api/admins/whatsapp/test-subscription-activation', {
        issuedBy,
        ...test,
        expiryDate: formatDateTime(test.expiryDate)
      });
      setSuccess(response.data.message);
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send the WhatsApp test template.');
    } finally {
      setSending(false);
    }
  };

  const previewName = test.customerName || 'John';
  const previewAccount = test.accountNumber || '0261711195';
  const previewExpiry = formatDateTime(test.expiryDate) || '2026-10-15 15:30';

  return (
    <>
      {!embedded && <SuperAdminDeskLink />}
      <MainCard title={<Typography variant="h3">WhatsApp Template Test</Typography>}>
        <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
        <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: 'primary.lighter' }}>
          <Typography variant="h4" gutterBottom>subscription_activated</Typography>
          <Typography variant="body2" color="text.secondary">
            Sends the active WhatsApp utility template to one recipient. This does not send a purchase notification automatically.
          </Typography>
        </Paper>

        <TextField
          fullWidth
          label="Recipient WhatsApp number"
          placeholder="0247016017"
          value={test.recipientPhone}
          onChange={(event) => updateTest('recipientPhone', event.target.value)}
          helperText="Enter a Ghana number with or without the 233 country code."
          sx={{ mb: 3 }}
        />

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Template variable</TableCell>
                <TableCell>Meaning</TableCell>
                <TableCell>Test value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{'{{1}}'}</TableCell>
                <TableCell>Customer name</TableCell>
                <TableCell>
                  <TextField fullWidth size="small" value={test.customerName} onChange={(event) => updateTest('customerName', event.target.value)} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{'{{2}}'}</TableCell>
                <TableCell>KayFi account number</TableCell>
                <TableCell>
                  <TextField fullWidth size="small" value={test.accountNumber} onChange={(event) => updateTest('accountNumber', event.target.value)} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{'{{3}}'}</TableCell>
                <TableCell>Subscription expiry date and time</TableCell>
                <TableCell>
                  <TextField fullWidth size="small" type="datetime-local" value={test.expiryDate} onChange={(event) => updateTest('expiryDate', event.target.value)} InputLabelProps={{ shrink: true }} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'grey.100' }}>
          <Typography variant="caption" color="text.secondary">Template preview</Typography>
          <Typography sx={{ mt: 0.75 }}>
            Hello {previewName}, your account {previewAccount} is active with unlimited data under our Fair Use Policy. It expires on {previewExpiry}. Thank you.
          </Typography>
        </Paper>

        <Button
          variant="contained"
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendOutlined />}
          disabled={sending || !test.recipientPhone || !test.customerName || !test.accountNumber || !test.expiryDate}
          onClick={sendTest}
          sx={{ mt: 3 }}
        >
          Send Test Template
        </Button>

        <Box sx={{ mt: 5 }}>
          <Typography variant="h4" sx={{ mb: 1.5 }}>Recent Test Sends</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            A submitted message has been accepted by Meta. Delivery and read status update when Meta posts the event to your webhook.
          </Alert>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recipient</TableCell>
                    <TableCell>Message ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Sent</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center">No WhatsApp test messages sent yet.</TableCell></TableRow>
                  ) : history.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>{message.recipient_phone}</TableCell>
                      <TableCell sx={{ maxWidth: 180, overflowWrap: 'anywhere' }}>{message.whatsapp_message_id || 'Not accepted by Meta'}</TableCell>
                      <TableCell>{message.status}</TableCell>
                      <TableCell>{new Date(message.created_at).toLocaleString()}</TableCell>
                      <TableCell>{message.error_message || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </MainCard>
    </>
  );
};

export default WhatsAppTest;
