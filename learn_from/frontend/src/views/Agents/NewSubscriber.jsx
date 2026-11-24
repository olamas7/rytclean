import React, { useState, useEffect } from 'react';
import { Grid, Typography, CircularProgress, Button, Card, CardContent, Box } from '@mui/material';
import { useForm, FormProvider } from 'react-hook-form';
import axios from 'axios';

import { RHFAutocomplete, RHFTextField } from 'utils/controls/ReactHookForms';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';

const planColors = [
  { bg: '#e3f2fd', text: '#1a237e' },
  { bg: '#e8f5e9', text: '#1b5e20' },
  { bg: '#fff3e0', text: '#e65100' },
  { bg: '#fbe9e7', text: '#bf360c' },
  { bg: '#ede7f6', text: '#311b92' }
];

const NewSubscriber = ({ onSuccess }) => {
  const [step, setStep] = useState(1);
  const [clientOptions, setClientOptions] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const methods = useForm({});
  const { handleSubmit, control, watch, setValue } = methods;

  const watchedClient = watch('selectedClient');

  useEffect(() => {
    setSelectedClient(watchedClient);
  }, [watchedClient]);

  useEffect(() => {
    if (selectedPlan) {
      setValue('amount', selectedPlan.amount);
    }
  }, [selectedPlan, setValue]);

  // Fetch client options
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await axios.get(`/api/api/agents/clients`);
        const options = response.data.map((client) => ({
          id: client.username,
          label: `${client.fullname} (${client.username})`,
          ...client
        }));
        setClientOptions(options);
      } catch (error) {
        setError('Failed to load clients.');
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  // Fetch subscription plans
  useEffect(() => {
    const fetchSubscriptionPlans = async () => {
      try {
        const response = await axios.get(`/api/api/agents/subscription-plans`);
        setSubscriptionPlans(response.data);
      } catch (error) {
        setError('Failed to load subscription plans.');
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchSubscriptionPlans();
  }, []);

  // Fetch payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const response = await axios.get(`/api/api/agents/payment-methods`);
        const options = response.data.map((method) => ({
          id: method.id,
          label: method.name,
          ...method
        }));
        setPaymentMethods(options);
      } catch (error) {
        setError('Failed to load payment methods.');
      } finally {
        setLoadingMethods(false);
      }
    };
    fetchPaymentMethods();
  }, []);

  const onSubmit = async (data) => {
    const { amount, paymentMethod } = data;
    const loggedInUserId = localStorage.getItem('userId');

    if (!loggedInUserId) {
      setError('You must be logged in to perform this action.');
      return;
    }
    if (!selectedClient || !selectedPlan || !paymentMethod) {
      setError('Client, Plan, and Payment Method must be selected.');
      return;
    }

    const planAmount = parseFloat(selectedPlan.amount);
    const amountPaid = parseFloat(amount);

    if (amountPaid < planAmount) {
      setError("Paying amount can't be less than subscription amount");
      return;
    }

    let pay_status = amountPaid === planAmount ? 1 : 2; // 1: Paid, 2: Partially Paid

    const payload = {
      username: selectedClient.username,
      fullname: selectedClient.fullname,
      phone: selectedClient.phone,
      plan_subs: selectedPlan.id,
      plan_amount: planAmount,
      expire_days: selectedPlan.expire_days,
      reg_by: loggedInUserId,
      amount_paid: amountPaid,
      pay_status: pay_status,
      mode_of_payment: paymentMethod.id,
      paid_to: loggedInUserId,
      plan_status: 1
    };

    try {
      setIsSubmitting(true);
      const response = await axios.post(`/api/api/agents/add-subscriber`, payload);
      onSuccess(response.data.message || 'Subscriber added successfully!');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to add subscriber.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1Client />;
      case 2:
        return <Step2Plan />;
      case 3:
        return <Step3Payment />;
      default:
        return <Step1Client />;
    }
  };

  const Step1Client = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h5">Step 1: Select Client</Typography>
      </Grid>
      <Grid item xs={12}>
        {loadingClients ? (
          <CircularProgress size={20} />
        ) : (
          <RHFAutocomplete
            name="selectedClient"
            control={control}
            label="Select Client"
            options={clientOptions}
            rules={{ required: 'Please select a client' }}
          />
        )}
      </Grid>
      {selectedClient && (
        <Grid item xs={12}>
          <Typography variant="body1">
            <strong>Phone Number:</strong> {selectedClient.username}
          </Typography>
          <Typography variant="body1">
            <strong>Full Name:</strong> {selectedClient.fullname}
          </Typography>
          <Typography variant="body1">
            <strong>Phone:</strong> {selectedClient.phone}
          </Typography>
        </Grid>
      )}
    </Grid>
  );

  const Step2Plan = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h5">Step 2: Choose a Subscription Plan</Typography>
      </Grid>
      {loadingPlans ? (
        <CircularProgress />
      ) : (
        subscriptionPlans.map((plan, index) => (
          <Grid item xs={12} sm={6} md={4} key={plan.id}>
            <Card
              onClick={() => setSelectedPlan(plan)}
              sx={{
                cursor: 'pointer',
                backgroundColor: selectedPlan?.id === plan.id ? 'primary.light' : planColors[index % planColors.length].bg,
                color: planColors[index % planColors.length].text,
                border: selectedPlan?.id === plan.id ? '2px solid' : 'none',
                borderColor: 'primary.main',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative' // Added for positioning context
              }}
            >
              <CardContent>
                <Typography variant="h6" component="div" gutterBottom>
                  {plan.plan_name}
                </Typography>
                <Typography variant="h4" sx={{ my: 1 }}>
                  GH₵{plan.amount}
                </Typography>
                <Typography variant="body2">Unlimited WiFi</Typography>
                <Typography variant="body2">Expires: {plan.expires_display}</Typography>
              </CardContent>
              {selectedPlan?.id === plan.id && (
                <Box sx={{ p: 2, position: 'absolute', bottom: 0, right: 0 }}>
                  <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setStep(3)}>
                    Next
                  </Button>
                </Box>
              )}
            </Card>
          </Grid>
        ))
      )}
    </Grid>
  );

  const Step3Payment = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h5">Step 3: Payment & Confirmation</Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="h6">Summary</Typography>
        <Typography>
          <strong>Client:</strong> {selectedClient?.fullname} ({selectedClient?.username})
        </Typography>
        <Typography>
          <strong>Plan:</strong> {selectedPlan?.plan_name} (GH₵{selectedPlan?.amount})
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        {loadingMethods ? (
          <CircularProgress size={20} />
        ) : (
          <RHFAutocomplete
            name="paymentMethod"
            control={control}
            label="Payment Method"
            options={paymentMethods}
            rules={{ required: 'Please select a payment method' }}
          />
        )}
      </Grid>
      <Grid item xs={12} md={6}>
        <RHFTextField
          name="amount"
          control={control}
          label="Amount Paying"
          type="number"
          inputProps={{ min: 0 }}
          rules={{ required: 'Amount is required' }}
        />
      </Grid>
    </Grid>
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
        <Typography variant="h4" sx={{ p: 2 }}>
          Add New Subscriber
        </Typography>
        <Box sx={{ p: 2 }}>{renderStep()}</Box>
        <Grid container justifyContent="space-between" sx={{ p: 2 }}>
          <Grid item>
            {step > 1 && (
              <Button startIcon={<ArrowBackIcon />} onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </Grid>
          <Grid item>
            {step < 3 && (
              <Button endIcon={<ArrowForwardIcon />} onClick={() => setStep(step + 1)} disabled={!selectedClient || (step === 2 && !selectedPlan)}>
                Next
              </Button>
            )}
            {step === 3 && (
              <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Save Subscription'}
              </Button>
            )}
          </Grid>
        </Grid>
      </form>
    </FormProvider>
  );
};

export default NewSubscriber;
