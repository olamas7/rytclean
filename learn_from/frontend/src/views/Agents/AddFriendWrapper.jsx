import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MediumDialog from 'views/Hooks/dialogMedium';
import AddClient from './AddClient';

const AddFriendWrapper = () => {
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(true);

  const handleCloseDialog = () => {
    setOpenDialog(false);
    navigate('/dashboard/default'); // Navigate back to dashboard after closing
  };

  useEffect(() => {
    if (!openDialog) {
      // If dialog is closed by other means (e.g., pressing escape), navigate away
      navigate('/dashboard/default');
    }
  }, [openDialog, navigate]);

  return (
    <MediumDialog open={openDialog} onClose={handleCloseDialog}>
      <AddClient onClose={handleCloseDialog} />
    </MediumDialog>
  );
};

export default AddFriendWrapper;
