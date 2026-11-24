import { Box, Button } from '@mui/material';
import { ArrowBackOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const HostelOwnersDeskLink = () => {
  const navigate = useNavigate();

  return <Box sx={{ mb: 1 }}><Button size="small" startIcon={<ArrowBackOutlined />} onClick={() => navigate('/hostel-owners')}>Back to Hostel Owners Desk</Button></Box>;
};

export default HostelOwnersDeskLink;
