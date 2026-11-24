import { Grid, Avatar, IconButton } from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useCallback, useEffect, useState, useRef } from 'react';
import Axios from 'axios';
import { Box } from '@mui/system';

import imageCompression from 'browser-image-compression';
import { SnackProgressLoading } from 'utils/Snackbars';

export default function NormalPictureUpload({ picture, pic_name, pic_folder, setPicture, widths = 300, heights = 150 }) {
  const [preview, setPreview] = useState(null); // Local preview picture
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info'); // 'info' for uploading, 'success' for completed
  const [snackbarColor, setSnackbarColor] = useState('#673AB7'); // Color theme for the snackbar
  const [thereIsPicture, setThereIsPicture] = useState('');
  const [understood, setUnderstood] = useState(false);
  const fileInputRef = useRef(null); // Reference to trigger file dialog

  const displayImage = () => {
    if (picture) {
      const imageUrl = `/api/${pic_folder}/${picture}`;
      setThereIsPicture(imageUrl); // Set server image with cache busting
      // console.log;
    }
  };

  useEffect(() => {
    displayImage();
  }, [picture]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 600,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };

    const config = {
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setUploadProgress(progress);
        setSnackbarMessage(`${progress}% Uploaded`);
        setSnackbarSeverity('info');
        setSnackbarColor('#673AB7');
        setSnackbarOpen(true);
      }
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const jpegFile = new File([compressedFile], `image.jpeg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', jpegFile);
      formData.append('pic_name', pic_name);
      formData.append('pic_folder', pic_folder);

      Axios.post('/api/uploads/passport_picture', formData, config)
        .then((res) => {
          if (res.data.code === 1) {
            setSnackbarMessage('Upload Complete');
            setPicture(res.data.data);
            setSnackbarSeverity('success');
            setSnackbarColor('green');
            setTimeout(() => {
              setSnackbarOpen(false);
            }, 3000);
            setIsButtonDisabled(false);
            setUnderstood(false);
          } else {
            setSnackbarMessage('File Must Not Exceed 5Mb');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            setIsButtonDisabled(false);
            setUnderstood(false);
          }
        })
        .catch((err) => {
          setSnackbarMessage('Error Uploading, Try Again.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          setIsButtonDisabled(false);
          setUnderstood(false);
        });
    } catch (error) {
      console.error('Image compression failed:', error);
    }
  };

  // Trigger file input when understood is true
  useEffect(() => {
    if (understood && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [understood]);

  return (
    <>
      <SnackProgressLoading
        snackbarMessage={snackbarMessage}
        snackbarSeverity={snackbarSeverity}
        snackbarColor={snackbarColor}
        uploadProgres={uploadProgress}
        open={snackbarOpen}
      />
      <Box sx={{ width: '100%' }}>
        <Grid container justifyContent="center">
          {/* Avatar + click to trigger upload */}
          <Grid item xs={12} md={12} display="grid" justifyContent="center" alignContent="center">
            <Avatar
              variant="square"
              sx={{ width: widths, height: heights, cursor: 'pointer' }}
              src={preview || (thereIsPicture && thereIsPicture !== '' ? thereIsPicture : null)}
              onClick={() => fileInputRef.current.click()}
            >
              {!thereIsPicture && !preview && <PhotoCamera />}
            </Avatar>
          </Grid>

          {/* Upload Button */}
          <Grid item xs={12} md={12} mt={2} display="flex" justifyContent="center">
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current.click()}
              disabled={isButtonDisabled}
              size="small"
            >
              Upload Picture
            </Button>

            {/* Unified hidden file input for both Avatar and Button */}
            <input hidden type="file" accept="image/*" ref={fileInputRef} onChange={handleFile} />
          </Grid>
        </Grid>
      </Box>
    </>
  );
}
