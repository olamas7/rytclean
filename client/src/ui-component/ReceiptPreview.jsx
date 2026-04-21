import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Divider,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Paper
} from '@mui/material';
import { Print, Receipt } from '@mui/icons-material';
import { format } from 'date-fns';
import useSWR from 'swr';
import Axios from 'axios';

const fetcher = url => Axios.get(url).then(res => res.data.data);

const ReceiptPreview = ({ open, onClose, sale, items }) => {
    const { data: facility } = useSWR('/api/admin/facility', fetcher);
    const activeShopName = localStorage.getItem('activeShopName');

    const handlePrint = () => {
        window.print();
    };

    if (!sale) return null;

    return (
        <>
            {/* Print-specific Styles */}
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #receipt-print-area, #receipt-print-area * {
                            visibility: visible;
                        }
                        #receipt-print-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 80mm;
                            margin: 0;
                            padding: 4mm;
                        }
                        @page {
                            margin: 0;
                            size: auto;
                        }
                    }
                `}
            </style>

            <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
                <DialogTitle>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Receipt color="primary" />
                        <Typography variant="h4">Receipt Preview</Typography>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'grey.100', display: 'flex', justifyContent: 'center', p: 3 }}>
                    {/* The Receipt Structure */}
                    <Paper 
                        id="receipt-print-area" 
                        elevation={3} 
                        sx={{ 
                            width: '80mm', 
                            p: 2, 
                            bgcolor: 'white', 
                            fontFamily: 'monospace',
                            color: 'black',
                            boxShadow: 'none'
                        }}
                    >
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                            <Typography variant="h4" sx={{ fontWeight: 900, textTransform: 'uppercase', fontFamily: 'monospace' }}>
                                {activeShopName || facility?.name || 'RytSales POS'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{facility?.location || 'Ghana, West Africa'}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{facility?.phone || '+233 50 000 0000'}</Typography>
                        </Box>
                        
                        <Divider sx={{ borderStyle: 'dashed', my: 1 }} />
                        
                        <Box sx={{ mb: 1 }}>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>Receipt: {sale.receipt_no || sale.sale_code}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                Date: {format(new Date(sale.transaction_date || sale.sale_date), 'dd/MM/yyyy HH:mm')}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>Cashier: {sale.cashier_name}</Typography>
                        </Box>

                        <Divider sx={{ borderStyle: 'dashed', my: 1 }} />

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px dashed #ccc' }}>
                                    <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Item</th>
                                    <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Qty</th>
                                    <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Amt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items?.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ paddingTop: '4px' }}>{item.name || item.product_name}</td>
                                        <td style={{ textAlign: 'center', paddingTop: '4px' }}>{item.quantity}</td>
                                        <td style={{ textAlign: 'right', paddingTop: '4px' }}>{Number(item.subtotal).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />

                        <Box sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Subtotal:</span>
                                <span>{Number(sale.total_amount).toFixed(2)}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Discount:</span>
                                <span>-{Number(sale.discount_amount).toFixed(2)}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, mt: 0.5, fontSize: '0.85rem' }}>
                                <span>TOTAL:</span>
                                <span>GH₵ {Number(sale.net_amount).toFixed(2)}</span>
                            </Box>
                        </Box>

                        <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />
                        
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                PAID VIA: {sale.payment_method?.toUpperCase()}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', mt: 1, fontStyle: 'italic', fontFamily: 'monospace' }}>
                                Thank you for your business!
                            </Typography>
                        </Box>
                    </Paper>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} color="inherit">Close</Button>
                    <Button 
                        variant="contained" 
                        startIcon={<Print />} 
                        onClick={handlePrint}
                        color="primary"
                    >
                        Print Receipt
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default ReceiptPreview;
