import { useMemo } from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { payments } from 'mocks/data';
import StatusBadge from 'ui-component/StatusBadge';

const Invoices = () => {
    const invoices = useMemo(
        () =>
            payments.map((payment, index) => ({
                id: `INV-${index + 1001}`,
                paymentReference: payment.reference,
                customerId: payment.customerId,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                issuedAt: payment.paidAt ? payment.paidAt.slice(0, 10) : '2026-04-21'
            })),
        []
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Invoices
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Review invoice statuses and access quick action buttons.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Invoice ID</TableCell>
                            <TableCell>Payment Reference</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell>{invoice.id}</TableCell>
                                <TableCell>{invoice.paymentReference}</TableCell>
                                <TableCell>{invoice.customerId}</TableCell>
                                <TableCell>
                                    {invoice.currency} {invoice.amount}
                                </TableCell>
                                <TableCell>
                                    <StatusBadge label={invoice.status} size="small" />
                                </TableCell>
                                <TableCell>
                                    <Button size="small" variant="outlined" sx={{ mr: 1, textTransform: 'none' }}>
                                        View
                                    </Button>
                                    <Button size="small" variant="text" sx={{ textTransform: 'none' }}>
                                        Download
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default Invoices;
