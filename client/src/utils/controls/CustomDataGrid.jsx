import React from 'react';
import PropTypes from 'prop-types';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  InputAdornment,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Search } from '@mui/icons-material';

const normalizeOptions = (options = []) =>
  options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option
  );

const CustomDataGridToolbar = ({
  title,
  actionButton,
  filterOptions,
  filterValue,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  toolbarActions,
  searchActions
}) => {
  const normalizedFilters = normalizeOptions(filterOptions);

  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#ffffff',
        px: 2.5,
        py: 2
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1f2a3d' }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {toolbarActions}
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          {actionButton && (
            <Button
              variant={actionButton.variant || 'contained'}
              color={actionButton.color || 'primary'}
              startIcon={actionButton.icon}
              onClick={actionButton.onClick}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                px: 2.5,
                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.25)'
              }}
            >
              {actionButton.label}
            </Button>
          )}

          {normalizedFilters.length > 0 && (
            <TextField
              select
              size="small"
              value={filterValue}
              onChange={(event) => onFilterChange?.(event.target.value)}
              sx={{
                minWidth: 140,
                backgroundColor: '#f7f9fc',
                borderRadius: 1.5
              }}
            >
              {normalizedFilters.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>

        {(onSearchChange || searchValue !== undefined) && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
            <TextField
              size="small"
              value={searchValue || ''}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder || 'Search...'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Search fontSize="small" sx={{ color: '#8a98aa' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                minWidth: 240,
                backgroundColor: '#f7f9fc',
                borderRadius: 1.5
              }}
            />
            {searchActions}
          </Stack>
        )}
      </Box>
    </Box>
  );
};

const baseDataGridSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  backgroundColor: '#ffffff',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  '& .MuiDataGrid-toolbarContainer': {
    p: 0
  },
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#f6f9ff',
    borderBottom: '1px solid',
    borderColor: 'divider',
    minHeight: 50,
    maxHeight: 50
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: '#344054'
  },
  '& .MuiDataGrid-cell': {
    borderBottom: '1px solid',
    borderColor: '#eef2f6',
    py: 1.25,
    color: '#2f3b4a',
    display: 'flex',
    alignItems: 'center'
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: '#f7fbff'
  },
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
    outline: 'none'
  },
  '& .MuiDataGrid-footerContainer': {
    borderTop: '1px solid',
    borderColor: 'divider',
    backgroundColor: '#fafcff',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8
  },
  '& .MuiCheckbox-root': {
    color: '#9fb7d1',
    '&.Mui-checked': {
      color: '#3a7bd5'
    }
  }
};

const getStatusChipStyles = (status = '') => {
  const value = String(status).toLowerCase();
  if (value === 'active' || value === 'paid' || value === 'success') {
    return { backgroundColor: '#d8f5e3', color: '#1b7a3c' };
  }
  if (value === 'inactive' || value === 'failed' || value === 'error') {
    return { backgroundColor: '#ffe1e1', color: '#b42318' };
  }
  if (value === 'pending') {
    return { backgroundColor: '#fff1d6', color: '#b54708' };
  }
  return { backgroundColor: '#eef2f6', color: '#475467' };
};

const DataGridPrimaryText = ({ text, subText }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1f2937', lineHeight: 1.2 }}>
      {text}
    </Typography>
    {subText && (
      <Typography variant="caption" sx={{ color: '#8a98aa', lineHeight: 1.2 }}>
        {subText}
      </Typography>
    )}
  </Box>
);

const DataGridAvatarText = ({ name, subtitle, src }) => (
  <Stack direction="row" spacing={1.5} alignItems="center">
    <Avatar
      src={src}
      alt={name}
      sx={{ width: 34, height: 34, bgcolor: '#dbeafe', color: '#1d4ed8', fontSize: 14 }}
    >
      {name ? name.charAt(0) : ''}
    </Avatar>
    <DataGridPrimaryText text={name} subText={subtitle} />
  </Stack>
);

const DataGridStatusChip = ({ label }) => (
  <Chip
    label={label}
    size="small"
    sx={{
      textTransform: 'capitalize',
      fontWeight: 600,
      borderRadius: 1,
      height: 24,
      ...getStatusChipStyles(label)
    }}
  />
);

const DataGridIconButton = ({ icon, onClick, title, variant }) => (
  <IconButton
    onClick={onClick}
    size="small"
    title={title}
    sx={{
      border: '1px solid',
      borderColor: variant === 'primary' ? '#3a7bd5' : '#d0d5dd',
      color: variant === 'primary' ? '#3a7bd5' : '#667085',
      borderRadius: 1,
      backgroundColor: '#ffffff'
    }}
  >
    {icon}
  </IconButton>
);

const DataGridOutlinedButton = ({ label, onClick, icon }) => (
  <Button
    onClick={onClick}
    size="small"
    variant="outlined"
    startIcon={icon}
    sx={{
      textTransform: 'none',
      borderRadius: 1,
      borderColor: '#d0d5dd',
      color: '#344054',
      fontWeight: 600,
      px: 1.5
    }}
  >
    {label}
  </Button>
);

const CustomDataGrid = ({
  title,
  actionButton,
  filterOptions,
  filterValue,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  toolbarActions,
  searchActions,
  showToolbar = true,
  slots,
  slotProps,
  sx,
  rowHeight = 64,
  ...dataGridProps
}) => {
  const mergedSx = Array.isArray(sx) ? [baseDataGridSx, ...sx] : [baseDataGridSx, sx];

  const toolbarProps = {
    title,
    actionButton,
    filterOptions,
    filterValue,
    onFilterChange,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    toolbarActions,
    searchActions
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {showToolbar && <CustomDataGridToolbar {...toolbarProps} />}
      <DataGrid
        slots={slots}
        slotProps={slotProps}
        sx={mergedSx}
        rowHeight={rowHeight}
        {...dataGridProps}
      />
    </Box>
  );
};

CustomDataGridToolbar.propTypes = {
  title: PropTypes.string,
  actionButton: PropTypes.shape({
    label: PropTypes.string,
    icon: PropTypes.node,
    onClick: PropTypes.func,
    color: PropTypes.string,
    variant: PropTypes.string
  }),
  filterOptions: PropTypes.array,
  filterValue: PropTypes.any,
  onFilterChange: PropTypes.func,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  toolbarActions: PropTypes.node,
  searchActions: PropTypes.node
};

DataGridPrimaryText.propTypes = {
  text: PropTypes.string,
  subText: PropTypes.string
};

DataGridAvatarText.propTypes = {
  name: PropTypes.string,
  subtitle: PropTypes.string,
  src: PropTypes.string
};

DataGridStatusChip.propTypes = {
  label: PropTypes.string
};

DataGridIconButton.propTypes = {
  icon: PropTypes.node,
  onClick: PropTypes.func,
  title: PropTypes.string,
  variant: PropTypes.string
};

DataGridOutlinedButton.propTypes = {
  label: PropTypes.string,
  onClick: PropTypes.func,
  icon: PropTypes.node
};

CustomDataGrid.propTypes = {
  title: PropTypes.string,
  actionButton: PropTypes.shape({
    label: PropTypes.string,
    icon: PropTypes.node,
    onClick: PropTypes.func,
    color: PropTypes.string,
    variant: PropTypes.string
  }),
  filterOptions: PropTypes.array,
  filterValue: PropTypes.any,
  onFilterChange: PropTypes.func,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  toolbarActions: PropTypes.node,
  searchActions: PropTypes.node,
  showToolbar: PropTypes.bool,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  rowHeight: PropTypes.number
};

export default CustomDataGrid;
export {
  CustomDataGridToolbar,
  DataGridPrimaryText,
  DataGridAvatarText,
  DataGridStatusChip,
  DataGridIconButton,
  DataGridOutlinedButton
};
