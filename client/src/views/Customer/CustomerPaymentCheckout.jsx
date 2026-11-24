import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { PageHeader } from 'ui-component/PageLayout';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import { formatCurrency } from 'utils/formatters';
import { printPaymentReceipt } from 'utils/accountPrinting';
import { newRequestKey } from 'services/api/billingService';
import { paymentConfiguration, lookupPaymentCustomer, initiateCustomerPayment, checkCustomerPayment, recoverCustomerPayment, submitPaymentOtp } from 'services/api/customerPaymentService';

const storageKey = 'rytcleanPaymentSession';
const sections = { pay: { label: 'Pay Customer' }, status: { label: 'Payment Status', parent: 'pay' } };
const restore = () => { try { return JSON.parse(sessionStorage.getItem(storageKey)) || null; } catch { return null; } };
const errorText = (error) => error.response?.data?.message || error.message;
export default function CustomerPaymentCheckout() {
    const [access, setAccess] = useState(restore);
    const [customerId, setCustomerId] = useState('');
    const [config, setConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [payment, setPayment] = useState(null);
    const [values, setValues] = useState({ amount: '', phone: '', email: '', provider: 'mtn', confirmed: false });
    const [otp, setOtp] = useState('');
    const lock = useRef(false);
    const requestKey = useRef(newRequestKey());
    const inline = useInlineNavigation({ sections, rootLabel: 'Customer Payment', contextKeys: ['reference'], blocked: busy });
    const reference = inline.params.get('reference') || access?.reference;
    const persist = (value) => { setAccess(value); try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Current in-memory session still works. */ } };
    const loadConfig = useCallback(async () => {
        setConfigLoading(true); setError('');
        try { setConfig(await paymentConfiguration()); } catch (err) { setError(errorText(err)); }
        finally { setConfigLoading(false); }
    }, []);
    useEffect(() => { loadConfig(); }, [loadConfig]);
    const work = async (callback) => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError('');
        try { await callback(); } catch (err) { setError(errorText(err)); }
        finally { lock.current = false; setBusy(false); }
    };
    const lookup = (event) => { event.preventDefault(); work(async () => {
        const result = await lookupPaymentCustomer(customerId);
        persist(result); setPayment(null); requestKey.current = newRequestKey();
        inline.open('pay');
    }); };
    const initiate = (event) => { event.preventDefault(); work(async () => {
        const key = access.requestKey || requestKey.current;
        // Persist the exact request key before submitting: a network timeout or
        // refresh must never turn the same action into a second charge.
        persist({ ...access, requestKey: key });
        let result;
        try { result = await initiateCustomerPayment(access.token, { ...values, requestKey: key }); }
        catch (err) {
            // These responses are returned before any provider submission.
            if ([400, 401, 404, 503].includes(err.response?.status)) persist({ ...access, requestKey: null });
            throw err;
        }
        setPayment(result); persist({ ...access, requestKey: key, reference: result.reference });
        inline.open('status', { reference: result.reference });
    }); };
    const resume = () => work(async () => {
        const result = await recoverCustomerPayment(access.token);
        setPayment(result); persist({ ...access, reference: result.reference });
        inline.open('status', { reference: result.reference });
    });
    const check = useCallback(async () => {
        if (!access?.token || !reference) return;
        setPayment(await checkCustomerPayment(access.token, reference));
    }, [access?.token, reference]);
    useEffect(() => {
        if (inline.view !== 'status' || !access?.token || !reference) return undefined;
        let active = true; let inFlight = false; let attempts = 0;
        const poll = async () => {
            if (inFlight || !active || attempts >= 60 || document.visibilityState === 'hidden') return;
            inFlight = true; attempts += 1;
            try {
                const result = await checkCustomerPayment(access.token, reference);
                if (active) { setPayment(result); if (['success', 'failed', 'review'].includes(result.status)) clearInterval(timer); }
            } catch (err) { if (active) { setError(errorText(err)); clearInterval(timer); } }
            finally { inFlight = false; }
        };
        const timer = setInterval(poll, 10000); poll();
        return () => { active = false; clearInterval(timer); };
    }, [inline.view, access?.token, reference]);
    const change = (field, value) => setValues((previous) => ({ ...previous, [field]: value, confirmed: false }));
    const unresolved = access?.reference && !['success', 'failed'].includes(payment?.status);
    const shortcode = <Alert severity="info"><Typography fontWeight={700}>You can also pay by USSD: dial *412*99#</Typography>Follow the prompts and keep your five-digit customer ID ready. USSD payments are not yet automatically received or reconciled by this app; contact the office with your payment reference if needed.</Alert>;
    return <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: 850, mx: 'auto', width: '100%' }}><Stack spacing={2}>
        <PageHeader title={inline.view ? sections[inline.view].label : 'Customer Payment'} description="Pay for a customer using their five-digit customer ID." inlineNavigation={inline.navigation} />
        {shortcode}
        {error && <Alert severity="error">{error}</Alert>}
        {configLoading ? <Typography role="status">Loading payment options…</Typography> : !config ? <LdButton onClick={loadConfig} loading={configLoading}>Retry Payment Options</LdButton> : !config.configured ? <Alert severity="warning">Online payment is not configured. Please contact the office or use the shortcode above.</Alert> : <>
            {config.environment === 'test' && <Alert severity="info">PAYSTACK TEST MODE: no real money is collected. Test transactions do not credit real customer balances.</Alert>}
            {!inline.view ? <Paper component="form" onSubmit={lookup} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}><Stack spacing={2}>
                <TextField label="Five-digit Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value.replace(/\D/g, '').slice(0, 5))} required disabled={busy} inputProps={{ inputMode: 'numeric', pattern: '[1-9][0-9]{4}', maxLength: 5 }} helperText="Enter the ID given to you by RytClean. This does not provide account-history access." />
                {access?.requestKey && <Alert severity="info">Resume your existing payment before starting another. Do not repeat a payment while confirmation is pending.</Alert>}
                <LdButton type="submit" loading={busy} disabled={!/^[1-9]\d{4}$/.test(customerId) || Boolean(access?.requestKey)}>Continue to Payment</LdButton>
                {(access?.reference || access?.requestKey) && <LdButton variant="outlined" loading={busy} onClick={resume}>Resume Existing Payment</LdButton>}
            </Stack></Paper> : !access?.token ? <Alert severity="warning">Your payment session is unavailable. Use Back to enter the customer ID again. Keep any existing payment reference and check with the office before paying again.</Alert> : inline.view === 'pay' ? <Paper component="form" onSubmit={initiate} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}><Stack spacing={2}>
                <Typography variant="h3">{access.displayName} · {access.customerId}</Typography>
                <Typography variant="body2">Confirm the customer name, ID and amount before paying.</Typography>
                {access.reference || access.requestKey ? <Alert severity="info" action={<LdButton loading={busy} onClick={resume}>Recover / View Payment</LdButton>}>A payment request was submitted from this session. Check its status before starting another. If no request was recorded, contact the office before retrying.</Alert> : <>
                    <TextField label="Amount (GHS)" value={values.amount} onChange={(event) => change('amount', event.target.value)} type="number" required inputProps={{ min: 1, max: 100000, step: '0.01' }} disabled={busy} helperText="GHS 1.00–100,000.00. You may make an advance or part payment." />
                    <TextField label="Payment Phone Number" value={values.phone} onChange={(event) => change('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} required inputProps={{ inputMode: 'numeric', pattern: '0[0-9]{9}', maxLength: 10 }} disabled={busy} helperText="Ten digits starting with 0. This wallet can belong to the person paying on the customer's behalf." />
                    <TextField label="Mobile Money Network" select value={values.provider} onChange={(event) => change('provider', event.target.value)} disabled={busy}><MenuItem value="mtn">MTN MoMo</MenuItem><MenuItem value="vod">Telecel Cash</MenuItem><MenuItem value="tgo">AT Money</MenuItem></TextField>
                    <TextField label="Payment Contact Email" type="email" value={values.email} onChange={(event) => change('email', event.target.value)} required disabled={busy} inputProps={{ maxLength: 150 }} helperText="Required by Paystack for this payment only; customer registration email remains optional." />
                    <FormControlLabel control={<Checkbox checked={values.confirmed} onChange={(event) => setValues((previous) => ({ ...previous, confirmed: event.target.checked }))} disabled={busy} />} label={`I confirm customer ${access.customerId} and the payment amount.`} />
                    <LdButton type="submit" loading={busy} disabled={!values.confirmed}>Pay {values.amount ? formatCurrency(Number(values.amount)) : 'with MoMo'}</LdButton>
                    <Typography variant="caption">Approve the request on your own phone. Never enter your wallet PIN in this app. Do not retry a charge while its result is uncertain.</Typography>
                </>}
            </Stack></Paper> : <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}><Stack spacing={2}>
                <Typography variant="h3">{access.displayName} · {access.customerId}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>Payment reference: {reference || 'Not available'}</Typography>
                {!payment ? <Typography role="status">Checking payment…</Typography> : <>
                    <Typography variant="h3">{formatCurrency(payment.amountCents / 100)}</Typography>
                    <Alert severity={payment.status === 'success' ? 'success' : ['failed', 'review'].includes(payment.status) ? 'warning' : 'info'}>{payment.status === 'success' ? payment.environment === 'test' ? 'Test payment verified. No real customer balance credited.' : payment.receipt?.reversed ? 'This payment was subsequently reversed in the office ledger. Contact the office for details.' : 'Payment verified and credited to the customer account.' : payment.status === 'failed' ? 'The provider reported this payment as failed. No receipt was issued.' : payment.message}</Alert>
                    {payment.status === 'send_otp' && <Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); work(async () => { setPayment(await submitPaymentOtp(access.token, reference, otp)); setOtp(''); }); }}><TextField label="One-time Password (OTP)" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 10))} required disabled={busy} autoComplete="one-time-code" inputProps={{ inputMode: 'numeric', pattern: '[0-9]{4,10}', maxLength: 10 }} helperText="Only the OTP sent by the payment provider. Never your wallet PIN." /><LdButton type="submit" loading={busy}>Submit OTP</LdButton></Stack>}
                    {payment.receipt && <LdButton onClick={() => { try { printPaymentReceipt(payment.customer, payment.receipt); } catch (err) { setError(err.message); } }}>{payment.environment === 'test' ? 'Print Test Confirmation' : 'Print / Save Receipt'}</LdButton>}
                </>}
                <LdButton variant="outlined" loading={busy} onClick={() => work(check)} disabled={!reference}>Check Payment Status</LdButton>
                {payment && ['success', 'failed'].includes(payment.status) && <LdButton variant="outlined" disabled={busy || unresolved} onClick={() => { persist({ ...access, reference: null, requestKey: null }); requestKey.current = newRequestKey(); setPayment(null); setValues({ amount: '', phone: '', email: '', provider: 'mtn', confirmed: false }); inline.close(); }}>Make Another Payment</LdButton>}
                <Typography variant="caption">Keep this reference. Pending or uncertain payments are not receipts. Verification may continue after you leave; do not pay again merely because approval is slow.</Typography>
            </Stack></Paper>}
        </>}
    </Stack></Box>;
}
