export const paymentMethods = [
    { value: 'cash', label: 'Cash' }, { value: 'mobile_money', label: 'MoMo / Mobile Money' },
    { value: 'cheque', label: 'Cheque' }, { value: 'bank_wire', label: 'Bank Wire' },
    { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'other', label: 'Other' }
];
export const paymentMethodLabel = (value) => value === 'paystack' ? 'Paystack (Online)' : paymentMethods.find((method) => method.value === value)?.label || value || 'Not recorded';
export const paymentSourceLabel = (entry) => entry.source === 'paystack' ? 'Client online · Paystack' : `Staff-recorded · ${entry.collectorName || 'Staff'}`;
