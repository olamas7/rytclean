import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Stack,
  IconButton
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import Axios from 'axios';
import { SnackProgressLoading } from 'utils/Snackbars';

const DocumentUpload = ({ setFileName, folder, label = 'Upload Document' }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  
  // Snackbars state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [snackbarColor, setSnackbarColor] = useState('#673AB7');

  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setSnackbarMessage('Uploading...');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);

    const formData = new FormData();
    const pic_name = `invoice_${Date.now()}`;
    formData.append('image', file);
    formData.append('pic_name', pic_name);
    formData.append('pic_folder', folder);

    const config = {
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setUploadProgress(progress);
      },
      headers: {
        'x-access-token': localStorage.getItem('token')
      }
    };

    try {
      const res = await Axios.post('/api/uploads/passport_picture', formData, config);
      if (res.data.code === 1) {
        setUploadedFile(file.name);
        setFileName(res.data.data); // Return the saved filename to parent
        setSnackbarMessage('Upload Successful');
        setSnackbarSeverity('success');
        setSnackbarColor('green');
      } else {
        setSnackbarMessage(res.data.message || 'Upload failed');
        setSnackbarSeverity('error');
      }
    } catch (err) {
      setSnackbarMessage('Connection error during upload');
      setSnackbarSeverity('error');
    } finally {
      setLoading(false);
      setTimeout(() => setSnackbarOpen(false), 3000);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".pdf,.png,.jpg,.jpeg"
      />
      
      {!uploadedFile ? (
        <Button
          variant="outlined"
          fullWidth
          startIcon={loading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          onClick={() => fileInputRef.current.click()}
          disabled={loading}
          sx={{ py: 1.5, borderStyle: 'dashed' }}
        >
          {label}
        </Button>
      ) : (
        <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center" 
            sx={{ 
                p: 1, 
                bgcolor: 'success.light', 
                borderRadius: 1,
                color: 'success.main',
                border: '1px solid',
                borderColor: 'success.main'
            }}
        >
          <CheckCircleIcon fontSize="small" />
          <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600, noWrap: true }}>
            {uploadedFile}
          </Typography>
          <IconButton size="small" onClick={clearFile} color="inherit">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      <SnackProgressLoading
        snackbarMessage={snackbarMessage}
        snackbarSeverity={snackbarSeverity}
        snackbarColor={snackbarColor}
        uploadProgress={uploadProgress}
        open={snackbarOpen}
      />
    </Box>
  );
};

export default DocumentUpload;
