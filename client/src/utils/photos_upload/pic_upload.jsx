import { Grid, Avatar, IconButton } from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useCallback, useEffect, useState, useRef } from 'react';
import Axios from 'axios';
import { Box } from '@mui/system';
import imageCompression from 'browser-image-compression';
import { SnackProgressLoading } from 'utils/Snackbars';

export default function NormalPictureUpload({ 
  picture, 
  pic_name, 
  pic_folder, 
  setPicture, 
  widths = 300, 
  heights = 150,
  onFileSelect // New prop to handle deferred upload
}) {
  const [preview, setPreview] = useState(null); // Local preview picture
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info'); // 'info' for uploading, 'success' for completed
  const [snackbarColor, setSnackbarColor] = useState('#db0726'); // Color theme for the snackbar
  const [thereIsPicture, setThereIsPicture] = useState('');
  const [understood, setUnderstood] = useState(false);
  const fileInputRef = useRef(null); // Reference to trigger file dialog

  const displayImage = () => {
    if (picture) {
      // Append a timestamp to the image URL to bust cache
      const imageUrl = `/api/${pic_folder}/${picture}?t=${new Date().getTime()}`;
      setThereIsPicture(imageUrl);
    }
  };

  useEffect(() => {
    // Only set server image if we don't have a local preview
    if (!preview) {
      displayImage();
    }
  }, [picture, preview]);

  const validateImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        const aspectRatio = width / height;

        // 1. Check dimensions
        if (width !== 600 || height !== 600) {
          return reject(`Image dimensions must be exactly 600x600 pixels. Current: ${width}x${height}`);
        }

        // 2. Check aspect ratio (redundant if 600x600, but good for logic)
        if (Math.abs(aspectRatio - 1) > 0.01) {
          return reject("Image must have a 1:1 aspect ratio (Square).");
        }

        // 3. Simple White Background Check (Check TOP corners only)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Sample areas: Top Left and Top Right (where background usually is)
        // [x, y, width, height]
        const sampleAreas = [
          ctx.getImageData(20, 20, 5, 5).data, // Top Left block
          ctx.getImageData(width - 25, 20, 5, 5).data // Top Right block
        ];

        const isWhite = sampleAreas.every(data => {
          let totalR = 0, totalG = 0, totalB = 0;
          for (let i = 0; i < data.length; i += 4) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
          }
          const count = data.length / 4;
          const avgR = totalR / count;
          const avgG = totalG / count;
          const avgB = totalB / count;
          const brightness = (avgR + avgG + avgB) / 3;

          // threshold 200/255 is ~78% white. Passport photos usually need ~220+
          return brightness > 200; 
        });

        if (!isWhite) {
          return reject("The photo background must be plain white or off-white. Please check the top corners of your photo.");
        }

        resolve();
      };
      img.onerror = () => reject("Failed to load image for validation.");
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSnackbarMessage('Validating Image...');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);

    try {
      await validateImage(file);
    } catch (error) {
      setSnackbarMessage(error);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    // If onFileSelect is provided, we skip immediate upload
    if (onFileSelect) {
      setSnackbarOpen(false);
      onFileSelect(file, previewUrl);
      return;
    }

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 600,
      useWebWorker: true,
      fileType: 'image/jpeg',
      alwaysKeepResolution: true // Ensure 600x600 is maintained
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

      const token = localStorage.getItem('token'); // Get token directly
      const headers = {
        'x-access-token': token
      };

      Axios.post('/api/uploads/passport_picture', formData, { ...config, headers })
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
        uploadProgress={uploadProgress}
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