import React, { useState } from 'react';
import { useController, Controller } from 'react-hook-form';
import {
  Autocomplete,
  Chip,
  Grid,
  TextField,
  Typography,
  FormControlLabel,
  Switch,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  FormHelperText
} from '@mui/material';
import { LocalizationProvider, DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/en-gb';
import dayjs from 'dayjs';

const RHFTextField = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: ''
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
    defaultValue: null
  });

  const handleChange = (event, newValue) => {
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
    defaultValue: defaultValues
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

const RHFDatePicker = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, value, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: null
  });

  const handleChange = (date) => {
    onChange(date ? dayjs(date).format('YYYY-MM-DD') : '');
  };

  return (
    <Grid>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <DatePicker
          {...props}
          label={label}
          value={value ? dayjs(value) : null}
          onChange={handleChange}
          onBlur={onBlur}
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

const RHFDateTimePicker = ({ name, control, label, rules = {}, ...props }) => {
  const {
    field: { onChange, value, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: dayjs().format('YYYY-MM-DD HH:mm:ss')
  });

  const handleChange = (date) => {
    onChange(date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '');
  };

  return (
    <Grid>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <DateTimePicker
          {...props}
          label={label}
          value={value ? dayjs(value) : dayjs()}
          onChange={handleChange}
          onBlur={onBlur}
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
    defaultValue: ''
  });

  const [inputValue, setInputValue] = useState(value || '');

  const handleChange = (_, newValue) => {
    if (typeof newValue === 'string') {
      setInputValue(newValue);
      onChange(newValue);
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
        setInputValue(newInputValue);
        onChange(newInputValue);
      }}
      onBlur={onBlur}
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

const RHFRadioGroup = ({ name, control, label, options, rules = {}, ...props }) => {
  const {
    field,
    fieldState: { error }
  } = useController({
    name,
    control,
    rules,
    defaultValue: ''
  });

  return (
    <FormControl component="fieldset" error={!!error}>
      <FormLabel component="legend">{label}</FormLabel>
      <RadioGroup {...field} {...props} row>
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio />}
            label={option.label}
          />
        ))}
      </RadioGroup>
      {error && <FormHelperText>{error.message}</FormHelperText>}
    </FormControl>
  );
};

const RHFSwitch = ({ name, control, label, ...props }) => {
  return (
    <FormControlLabel
      label={label}
      control={
        <Controller
          name={name}
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Switch
              {...field}
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              {...props}
            />
          )}
        />
      }
    />
  );
};

export {
  RHFAutocomplete,
  RHFTextField,
  RHFDatePicker,
  RHFDateTimePicker,
  RHFAutocompleteMultiple,
  RHFAutocompleteFreeSolo,
  RHFSwitch,
  RHFRadioGroup
};
