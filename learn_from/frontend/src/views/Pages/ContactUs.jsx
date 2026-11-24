import React, { useState, useEffect } from 'react';
import { Grid, Typography, Card, CardContent, Button, Box, CircularProgress } from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import axios from 'axios';
import { Call as CallIcon, WhatsApp as WhatsAppIcon, Email as EmailIcon } from '@mui/icons-material';

const ContactUs = () => {
  const [contacts, setContacts] = useState({ call: '', whatsapp: '', email: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get('/api/api/wifi/contact-info');
        if (response.data.code === 1) {
          const data = response.data.data;
          setContacts({
            call: data.find((c) => c.name === 'call')?.value || '',
            whatsapp: data.find((c) => c.name === 'whatsapp')?.value || '',
            email: data.find((c) => c.name === 'email')?.value || ''
          });
        }
      } catch (error) {
        console.error('Error fetching contact info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  const handleAction = (type, value) => {
    if (!value) return;
    if (type === 'call') window.location.href = `tel:${value}`;
    if (type === 'email') window.location.href = `mailto:${value}`;
    if (type === 'whatsapp') window.open(value, '_blank');
  };

  if (loading) {
    return (
      <MainCard title="Contact Support">
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      </MainCard>
    );
  }

  return (
    <MainCard title="Contact Support">
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        We are here to help you 24/7. Choose your preferred way to reach us.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Call Card */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e3f2fd', height: '100%', transition: '0.3s', '&:hover': { transform: 'scale(1.02)' } }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ color: '#1565c0', mb: 2 }}>
                <CallIcon style={{ fontSize: 60 }} />
              </Box>
              <Typography variant="h3" gutterBottom color="#1565c0">
                Call Us
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Speak directly with our support team.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => handleAction('call', contacts.call)}
                sx={{ borderRadius: 2 }}
              >
                {contacts.call || 'Unavailable'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* WhatsApp Card */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e8f5e9', height: '100%', transition: '0.3s', '&:hover': { transform: 'scale(1.02)' } }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ color: '#2e7d32', mb: 2 }}>
                <WhatsAppIcon style={{ fontSize: 60 }} />
              </Box>
              <Typography variant="h3" gutterBottom color="#2e7d32">
                WhatsApp
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Chat with us instantly.
              </Typography>
              <Button 
                variant="contained" 
                color="success" 
                onClick={() => handleAction('whatsapp', contacts.whatsapp)}
                sx={{ borderRadius: 2, bgcolor: '#2e7d32' }}
              >
                Chat Now
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Email Card */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fff3e0', height: '100%', transition: '0.3s', '&:hover': { transform: 'scale(1.02)' } }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ color: '#ef6c00', mb: 2 }}>
                <EmailIcon style={{ fontSize: 60 }} />
              </Box>
              <Typography variant="h3" gutterBottom color="#ef6c00">
                Email Us
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Send us a detailed message.
              </Typography>
              <Button 
                variant="contained" 
                color="warning" 
                onClick={() => handleAction('email', contacts.email)}
                sx={{ borderRadius: 2, bgcolor: '#ef6c00' }}
              >
                Send Email
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </MainCard>
  );
};

export default ContactUs;
