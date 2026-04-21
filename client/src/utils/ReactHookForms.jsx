import React from 'react';
import { useController } from 'react-hook-form';
import { Autocomplete, Chip, Grid, TextField, Typography } from '@mui/material';
import { LocalizationProvider, DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/en-gb';
import dayjs from 'dayjs';
import { useState } from 'react';

const RHFTextField = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: '' // Set a default value for controlled behavior
  });

  return (
    <TextField
      {...props}
      inputRef={ref}
      label={label}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={!!error}
      helperText={error ? error.message : ''}
      fullWidth
      margin="normal"
      size="small"
      disabled={props.disabled}
    />
  );
};

const RHFAutocomplete = ({ name, control, label, options, rules = {}, ...props }) => {
  const {
    field: { onChange, onBlur, value },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: null // Default to `null` for autocomplete
  });

  const handleChange = (event, newValue) => {
    // Pass the entire selected option to the form state
    onChange(newValue || null);
  };

  return (
    <Autocomplete
      {...props}
      options={options}
      getOptionLabel={(option) => (option ? option.label : '')}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      value={value || null}
      onChange={handleChange}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={!!error}
          helperText={error ? error.message : ''}
          fullWidth
          margin="normal"
          size="small"
          disabled={props.disabled}
        />
      )}
      renderGroup={(params) => (
        <div key={params.key}>
          <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', color: 'primary.main' }}>{params.group}</Typography>
          {params.children}
        </div>
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Typography color="secondary">{option.label}</Typography>
        </li>
      )}
    />
  );
};

const RHFAutocompleteMultiple = ({ name, control, label, options, rules = {}, defaultValues = [], ...props }) => {
  const {
    field: { onChange, onBlur, value },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: defaultValues // Use passed default values
  });

  const handleChange = (event, newValue) => {
    onChange(newValue || []);
  };

  return (
    <Autocomplete
      {...props}
      multiple
      options={options}
      getOptionLabel={(option) => (option ? option.label : '')}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      value={value || []}
      onChange={handleChange}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={!!error}
          helperText={error ? error.message : ''}
          fullWidth
          margin="normal"
          size="small"
          disabled={props.disabled}
        />
      )}
      renderGroup={(params) => (
        <div key={params.key}>
          <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', color: 'primary.main' }}>{params.group}</Typography>
          {params.children}
        </div>
      )}
      renderTags={(selectedOptions, getTagProps) =>
        selectedOptions.map((option, index) => <Chip key={option.id} label={option.label} {...getTagProps({ index })} size="small" />)
      }
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Typography color="secondary">{option.label}</Typography>
        </li>
      )}
    />
  );
};

const RHFDatePicker2 = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, value, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: null // Ensure default value is null for controlled behavior
  });

  const handleChange = (date) => {
    // Format the selected date to `YYYY-MM-DD` or set it to an empty string if no date is selected
    onChange(date ? dayjs(date).format('YYYY-MM-DD') : '');
  };

  return (
    <Grid>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <DatePicker
          {...props}
          label={label}
          value={value ? dayjs(value) : null} // Parse the value to Day.js if it's present
          onChange={handleChange} // Format the value to `YYYY-MM-DD`
          onBlur={onBlur} // Mark the field as touched
          slotProps={{
            textField: {
              variant: 'outlined',
              margin: 'normal',
              size: 'small',
              error: !!error, // Display error if validation fails
              helperText: error ? error.message : '', // Show validation message
              fullWidth: true
            }
          }}
        />
      </LocalizationProvider>
    </Grid>
  );
};

const RHFDateTimePicker = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, value, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: dayjs().format('YYYY-MM-DD HH:mm:ss') // Default to the current date and time as a dayjs object
  });

  const handleChange = (date) => {
    // Ensure the value is formatted as `YYYY-MM-DD HH:mm:ss` for MySQL
    onChange(date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '');
  };

  return (
    <Grid>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <DateTimePicker
          {...props}
          label={label}
          value={value ? dayjs(value) : dayjs()} // Ensure `value` is a dayjs object
          onChange={handleChange}
          onBlur={onBlur} // Mark the field as touched
          slotProps={{
            textField: {
              variant: 'outlined',
              margin: 'normal',
              size: 'small',
              error: !!error,
              helperText: error ? error.message : '',
              fullWidth: true
            }
          }}
        />
      </LocalizationProvider>
    </Grid>
  );
};

const RHFDatePicker = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, value, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: dayjs().format('YYYY-MM-DD') // Default to the current date and time as a dayjs object
  });

  const handleChange = (date) => {
    // Ensure the value is formatted as `YYYY-MM-DD HH:mm:ss` for MySQL
    onChange(date ? dayjs(date).format('YYYY-MM-DD') : '');
  };

  return (
    <Grid>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <DatePicker
          {...props}
          label={label}
          value={value ? dayjs(value) : dayjs()} // Ensure `value` is a dayjs object
          onChange={handleChange}
          onBlur={onBlur} // Mark the field as touched
          slotProps={{
            textField: {
              variant: 'outlined',
              margin: 'normal',
              size: 'small',
              error: !!error,
              helperText: error ? error.message : '',
              fullWidth: true
            }
          }}
        />
      </LocalizationProvider>
    </Grid>
  );
};

const RHFAutocompleteFreeSolo = ({ name, control, label, options = [], rules = {} }) => {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: '' // Ensures field is never undefined
  });

  const [inputValue, setInputValue] = useState(value || '');

  const handleChange = (_, newValue) => {
    if (typeof newValue === 'string') {
      setInputValue(newValue); // Updates internal state
      onChange(newValue); // Updates React Hook Form
    } else if (newValue?.label) {
      setInputValue(newValue.label);
      onChange(newValue.label);
    }
  };

  return (
    <Autocomplete
      freeSolo
      options={options.map((option) => (typeof option === 'string' ? option : option.label))}
      value={value || ''}
      inputValue={inputValue}
      onChange={handleChange}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue); // Updates state when user types
        onChange(newInputValue); // Ensures React Hook Form captures free text input
      }}
      onBlur={onBlur} // Ensures validation runs when input loses focus
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          inputRef={ref}
          error={!!error}
          helperText={error ? error.message : ''}
          fullWidth
          margin="normal"
          size="small"
        />
      )}
    />
  );
};

export { RHFAutocomplete, RHFTextField, RHFDatePicker, RHFDateTimePicker, RHFAutocompleteMultiple, RHFAutocompleteFreeSolo };
