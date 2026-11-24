import { Box, Button } from '@mui/material';
import { ArrowBackOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const AgentsDeskLink = () => {
  const navigate = useNavigate();

  return <Box sx={{ mb: 1 }}><Button size="small" startIcon={<ArrowBackOutlined />} onClick={() => navigate('/agents')}>Back to Agents Desk</Button></Box>;
};

export default AgentsDeskLink;
