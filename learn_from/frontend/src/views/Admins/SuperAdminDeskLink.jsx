import { Box, Button } from '@mui/material';
import { ArrowBackOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const SuperAdminDeskLink = () => {
  const navigate = useNavigate();

  return <Box sx={{ mb: 1 }}><Button size="small" startIcon={<ArrowBackOutlined />} onClick={() => navigate('/super_admins')}>Back to Super Admin Desk</Button></Box>;
};

export default SuperAdminDeskLink;
