import { Grid, TextField, Autocomplete } from '@mui/material';
import React from 'react';
import PropTypes from 'prop-types';
import { useField } from 'formik';

function DropdownV1({ label, option, value, onChange }) {
  return (
    <Grid>
      <Autocomplete
        fullWidth
        disablePortal
        id="combo-box1"
        options={option}
        // options={option.map((option) => option.label)}
        margin="normal"
        size="small"
        value={value}
        onChange={(event, newValue) => {
          onChange(newValue); // Call the onChange callback with the selected value
        }}
        renderInput={(params) => <TextField {...params} label={label} margin="normal" />}
      />
    </Grid>
  );
}

const ACFreeSoloFormik = ({ field, form, label, options }) => {
  const { touched, errors } = form;
  const { name, value } = field;
  const isError = Boolean(touched[name] && errors[name]);

  const handleChange = (event, newValue) => {
    form.setFieldValue(name, newValue);
  };

  const handleBlur = () => {
    // If newValue is an object, take the option's value, otherwise take the string directly (freeSolo case)
    const finalValue = typeof newValue === 'string' ? newValue : newValue?.value || '';
    form.setFieldValue(name, finalValue);
  };

  return (
    <Autocomplete
      fullWidth
      margin="normal"
      size="small"
      freeSolo
      options={options}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      renderInput={(params) => (
        <TextField {...params} name={name} label={label} error={isError} helperText={isError ? errors[name] : ''} margin="normal" />
      )}
    />
  );
};

const ACFormik = ({ field, form, label, options }) => {
  const { touched, errors } = form;
  const { name, value } = field;
  const isError = Boolean(touched[name] && errors[name]);

  const handleChange = (event, newValue) => {
    // Set both label and id when a selection is made
    form.setFieldValue(name, newValue ? { label: newValue.label, id: newValue.id } : null);
  };

  const handleBlur = () => {
    form.setFieldTouched(name, true, true);
  };

  return (
    <Autocomplete
      fullWidth
      margin="normal"
      size="small"
      options={options}
      getOptionLabel={(option) => (option ? option.label : '')} // Handle null/undefined options
      value={value || null}
      onChange={handleChange}
      onBlur={handleBlur}
      isOptionEqualToValue={(option, value) => option.id === value?.id} // Checks equality based on `id`
      renderInput={(params) => (
        <TextField {...params} name={name} label={label} error={isError} helperText={isError ? errors[name] : ''} margin="normal" />
      )}
    />
  );
};

export { DropdownV1, ACFormik, ACFreeSoloFormik };
