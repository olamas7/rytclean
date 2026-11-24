## Frontend Development Style Guide

This document outlines the coding style, architecture, and libraries used in the KayFi client application.

### 1. Core Technologies & Libraries

- **Framework:** React v18+
- **UI Library:** Material-UI (MUI) v5 (`@mui/material`)
- **State Management:** Redux (`@reduxjs/toolkit`) for global state and React Context API (`useContext`) for more localized state.
- **Routing:** React Router v6 (`react-router-dom`).
- **HTTP Requests:** `axios` is the standard for API calls. `SWR` is also used.
- **Forms:** `react-hook-form` is the primary library for forms.
- **Styling:** MUI's `styled` components, SCSS modules (`.module.scss`), and global stylesheets (`style.scss`).

### 2. Architecture & Code Organization

- **Component Structure:** Components are organized into `views`, `ui-component`, and `layout`.
  **Routing:** Routes are defined in `src/routes/` with separation for `MainRoutes` and `AuthenticationRoutes`.
- **Styling:** Theme variables are in `src/assets/scss/_themes-vars.module.scss`, component overrides are in `src/themes/compStyleOverride.jsx`, and the main palette is in `src/themes/palette.jsx`.

---

### 3. Code Patterns & Examples

#### **Example 1: Creating a Form Component**

Use `react-hook-form`, `FormProvider`, and the custom `RHF` components from `utils/controls/ReactHookForms.jsx`.

```jsx
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Button, Grid } from '@mui/material';
import { RHFTextField, RHFAutocomplete } from 'utils/controls/ReactHookForms';
import { SnackSuccess, SnackError } from 'utils/Snackbars';
import SubCard from 'ui-component/cards/SubCard';
import Axios from 'axios';

export default function NewComponentForm({ data, onClose }) {
  const [snackMessage, setSnackMessage] = useState('');
  const [openSnackSuccess, setOpenSnackSuccess] = useState(false);
  const [openSnackError, setOpenSnackError] = useState(false);

  // 1. Setup useForm, with defaultValues
  const methods = useForm({
    defaultValues: {
      name: '',
      description: ''
    }
  });
  const { handleSubmit, reset } = methods;

  // 2. Handle form submission
  const onSave = (formData) => {
    Axios.post('/api/api/endpoint', formData)
      .then((res) => {
        if (res.data.code === 1) {
          setSnackMessage('Saved successfully!');
          setOpenSnackSuccess(true);
          onClose(); // Close dialog on success
        } else {
          setSnackMessage(res.data.message);
          setOpenSnackError(true);
        }
      })
      .catch(() => {
        setSnackMessage('Network Error, Please Contact System Admin');
        setOpenSnackError(true);
      });
  };

  return (
    <>
      <SnackError message={snackMessage} open={openSnackError} setOpen={setOpenSnackError} />
      <SnackSuccess message={snackMessage} open={openSnackSuccess} setOpen={setOpenSnackSuccess} />

      <SubCard title="Add New Item">
        {/* 3. Wrap form in FormProvider */}
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSave)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                {/* 4. Use RHF controls */}
                <RHFTextField name="name" label="Item Name *" rules={{ required: 'Item Name is required' }} />
              </Grid>
              <Grid item xs={12}>
                <RHFTextField name="description" label="Description" multiline rows={3} />
              </Grid>
              <Grid item xs={12} display="flex" justifyContent="flex-end">
                <Button type="submit" variant="contained" color="secondary">
                  Save
                </Button>
              </Grid>
            </Grid>
          </form>
        </FormProvider>
      </SubCard>
    </>
  );
}
```

#### **Example 2: Displaying Data in a Table with Pagination**

Use MUI's `Table` components inside a `SubCard`. Fetch data with `axios` and manage state with `useState` and `useEffect`.

```jsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  Pagination,
  Box
} from '@mui/material';
import { TuneOutlined } from '@mui/icons-material';
import Axios from 'axios';

import SubCard from 'ui-component/cards/SubCard';

const DataDisplayTable = () => {
  const [dataTable, setDataTable] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);

  const fetchItems = async () => {
    try {
      const response = await Axios.post(`/api/api/get_items`, { page });
      if (response.data) {
        setDataTable(response.data.data);
        setTotalRecords(response.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [page]); // Refetch when page changes

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  return (
    <SubCard title="Items List">
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dataTable.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell align="right">
                  <IconButton color="primary" onClick={() => handleEdit(row)}>
                    <TuneOutlined />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box display="flex" justifyContent="center" mt={2}>
        <Pagination
          count={Math.ceil(totalRecords / 20)} // Assuming 20 items per page
          page={page}
          onChange={handleChangePage}
        />
      </Box>
    </SubCard>
  );
};
```

#### **Example 3: Using Dialogs**

The project includes reusable dialog components for different screen sizes.

**Medium Dialog (`views/Hooks/dialogMedium.jsx`)**

Use this for forms or content that doesn't require the full screen.

```jsx
import React, { useState } from 'react';
import { Button } from '@mui/material';
import MediumDialog from 'views/Hooks/dialogMedium';
import MyFormComponent from './MyFormComponent';

const EditButton = ({ item }) => {
  const [openDialog, setOpenDialog] = useState(false);

  const handleOpen = () => setOpenDialog(true);
  const handleClose = () => setOpenDialog(false);

  return (
    <>
      <Button onClick={handleOpen}>Edit Item</Button>
      <MediumDialog open={openDialog} onClose={handleClose} title="Edit Item">
        <MyFormComponent data={item} onClose={handleClose} />
      </MediumDialog>
    </>
  );
};
```

**Fullscreen Dialog (`views/Hooks/dialogFullscreen.jsx`)**

Use this for complex views or when more space is needed.

```jsx
import React, { useState } from 'react';
import { Button } from '@mui/material';
import FullscreenDialog from 'views/Hooks/dialogFullscreen';
import MyComplexComponent from './MyComplexComponent';

const ViewDetailsButton = ({ item }) => {
  const [openDialog, setOpenDialog] = useState(false);

  const handleOpen = () => setOpenDialog(true);
  const handleClose = () => setOpenDialog(false);

  return (
    <>
      <Button onClick={handleOpen}>View Details</Button>
      <FullscreenDialog open={openDialog} onClose={handleClose} title="Item Details">
        <MyComplexComponent item={item} />
      </FullscreenDialog>
    </>
  );
};
```

#### **Example 4: Exporting Data to Excel**

The pattern for exporting data involves triggering a GET request to a specific backend endpoint. The backend is responsible for generating the Excel file and sending it as a download.

```jsx
import { Button } from '@mui/material';
import { DownloadOutlined } from '@mui/icons-material';

const ExportButton = ({ filters }) => {
  const handleExport = () => {
    // 1. Construct query parameters from filters
    const params = new URLSearchParams();
    if (filters.program) params.append('program', filters.program.prog_code);
    if (filters.level) params.append('level', filters.level.codes);

    // 2. Trigger the download by navigating to the export URL
    window.location.href = `/api/api/export_endpoint?${params.toString()}`;
  };

  return (
    <Button variant="contained" color="success" onClick={handleExport} startIcon={<DownloadOutlined />}>
      Export Excel
    </Button>
  );
};
```

#### **Example 5: Using a Confirmation Dialog**

Import and use the `ConfirmDialog` for actions that require user confirmation.

```jsx
import React, { useState } from 'react';
import { Button } from '@mui/material';
import { ConfirmDialog } from 'utils/controls/confirmation';

const DeleteButton = ({ onDelete }) => {
  const [openConfirm, setOpenConfirm] = useState(false);

  const handleConfirm = () => {
    onDelete();
    setOpenConfirm(false);
  };

  return (
    <>
      <Button color="error" onClick={() => setOpenConfirm(true)}>
        Delete
      </Button>

      <ConfirmDialog
        open={openConfirm}
        onConfirm={handleConfirm}
        handleClose={() => setOpenConfirm(false)}
        title="Confirm Deletion"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmButton="Delete"
      />
    </>
  );
};
```

## Important

